import os
from pathlib import Path
import json

from dotenv import load_dotenv
from openai import OpenAI


class ProcurementAgent:
    BASE_URL = "https://api.groq.com/openai/v1"
    DEFAULT_MODEL = "openai/gpt-oss-20b"
    ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
    THINK_SYSTEM_PROMPT = """
You are an AI procurement agent thinking step-by-step.
Explain what you are about to do and why.
Use concise external reasoning only.
Do not reveal chain-of-thought, hidden reasoning, or private deliberation.
Return a short natural narration prefixed with "AGENT THOUGHT:".
""".strip()
    SYSTEM_PROMPT = """
You are an AI procurement agent supporting a deterministic pharmacy procurement engine.
Use a professional procurement tone.
Do not output chain-of-thought.
Do not show reasoning steps.
Return only the final structured answer in exactly this format:

REASONING:
<clear explanation>

TRADEOFFS:
<price vs lead time vs rating>

FINAL_DECISION:
<why selected distributor is best>
""".strip()

    def __init__(self, model=None, timeout=30.0):
        load_dotenv(self.ENV_PATH)
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set.")

        configured_model = (model or self.DEFAULT_MODEL).strip()
        self.model = configured_model or self.DEFAULT_MODEL
        self.timeout = float(timeout)
        self.client = OpenAI(api_key=api_key, base_url=self.BASE_URL)

    @staticmethod
    def _stringify_audit_logs(audit_logs):
        if isinstance(audit_logs, str):
            return audit_logs
        return "\n".join(str(entry) for entry in audit_logs)

    @staticmethod
    def _stringify_state(state):
        return json.dumps(state, indent=2, default=str)

    def _call_llm(self, user_prompt, system_prompt=None):
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt or self.SYSTEM_PROMPT,
                },
                {"role": "user", "content": user_prompt},
            ],
        )
        if not response.choices or not response.choices[0].message.content:
            raise ValueError("Groq returned empty message content.")
        return response.choices[0].message.content

    def think(self, step_name, state):
        prompt = f"""
Step Name:
{step_name}

Current State:
{self._stringify_state(state)}

Explain what you are about to do and why.
Keep the narration concise, practical, and grounded in the current procurement state.
Do not provide hidden reasoning or chain-of-thought.
""".strip()
        return self._call_llm(prompt, system_prompt=self.THINK_SYSTEM_PROMPT)

    def generate_reasoning(self, audit_logs, context, order):
        audit_log_text = self._stringify_audit_logs(audit_logs)
        prompt = f"""
Use the deterministic procurement audit and request details below to explain the selected distributor.

Context:
- Pharmacy Location: {context.get("location")}
- Max Lead Days: {context.get("max_lead_days")}

Order:
- Medicine ID: {order.get("medicine_id")}
- Required Units: {order.get("required_units")}

Audit Logs:
{audit_log_text}

Return only this exact structure:

REASONING:
<clear explanation of why the filters, ranking, and selected distributor make sense>

TRADEOFFS:
<clear comparison of price, lead time, rating, and supply constraints>

FINAL_DECISION:
<why the selected distributor is the best option for this order>
""".strip()
        return self._call_llm(prompt)

    def generate_reflection(self, audit_logs):
        audit_log_text = self._stringify_audit_logs(audit_logs)
        prompt = f"""
Review the deterministic procurement audit below and assess whether the selected outcome appears internally consistent.

Audit Logs:
{audit_log_text}

Return only this exact structure:

REASONING:
<clear explanation of whether the selection logic is coherent>

TRADEOFFS:
<clear comparison of the main operational trade-offs visible in the audit>

FINAL_DECISION:
<whether the selected distributor should stand based on the audit trail>
""".strip()
        return self._call_llm(prompt)

    def suggest_actions(self, audit_logs):
        audit_log_text = self._stringify_audit_logs(audit_logs)
        prompt = f"""
Review the deterministic procurement audit below and suggest the most relevant follow-up actions for future procurement runs.

Audit Logs:
{audit_log_text}

Return only this exact structure:

REASONING:
<clear explanation of what the audit suggests should be improved or monitored>

TRADEOFFS:
<clear comparison of cost, supplier reliability, lead time, and data quality trade-offs>

FINAL_DECISION:
<the single most important next procurement action to take in future runs>
""".strip()
        return self._call_llm(prompt)

    def reflect(self, audit_logs, decision):
        audit_log_text = self._stringify_audit_logs(audit_logs)
        prompt = f"""
You are an AI procurement agent reviewing your own decision.

Decision:
{decision}

Logs:
{audit_log_text}

Answer:
1. Is this decision optimal?
2. What are the weaknesses?
3. Could a better supplier exist?
4. Should constraints be adjusted?

Be critical and analytical.
""".strip()
        return self._call_llm(prompt)