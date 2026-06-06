import os
import io
import re
from contextlib import redirect_stdout


class ProcurementEngine:
    SEPARATOR = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    FILTER_STEP_LABELS = {
        "nearest_filter": "PROXIMITY FILTER",
        "lead_time_filter": "LEAD TIME FILTER",
        "min_order_filter": "MINIMUM ORDER FILTER",
    }
    FILTER_REJECTION_REASONS = {
        "nearest_filter": "Outside the delivery radius",
        "lead_time_filter": "Lead time exceeds the allowed window",
        "min_order_filter": "Order value is below the minimum requirement",
    }
    STEP_FALLBACKS = {
        "Analyze available distributors": (
            "Reviewing the supplier pool against the current procurement constraints."
        ),
        "nearest_filter": "Filtering suppliers based on delivery feasibility.",
        "lead_time_filter": "Removing suppliers that cannot meet the lead-time window.",
        "min_order_filter": "Checking order-value compliance before scoring.",
        "Evaluate scoring": (
            "Scoring shortlisted suppliers across distance, lead time, rating, and price."
        ),
    }

    def __init__(self, distributors, pipeline, scoring_engine, audit_logger):
        self.distributors = distributors
        self.pipeline = pipeline
        self.scoring_engine = scoring_engine
        self.audit = audit_logger
        self.agent = None

        if os.getenv("DISABLE_PROCUREMENT_AGENT", "").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }:
            return

        try:
            from .agent import ProcurementAgent
        except Exception:
            try:
                from engine.agent import ProcurementAgent
            except Exception:
                return
            else:
                self.agent = ProcurementAgent()
        else:
            self.agent = ProcurementAgent()


    @staticmethod
    def _summarize_distributors(distributors):
        return [
            {
                "id": distributor["id"],
                "name": distributor["name"],
                "location": distributor["location"],
                "lead_days": distributor["lead_days"],
                "rating": distributor["rating"],
                "price_per_unit": distributor["price_per_unit"],
                "min_order_value": distributor["min_order_value"],
            }
            for distributor in distributors
        ]

    @staticmethod
    def _summarize_scored_distributors(scored):
        return [
            {
                "id": distributor["id"],
                "name": distributor["name"],
                "score": round(score, 4),
                "lead_days": distributor["lead_days"],
                "rating": distributor["rating"],
                "price_per_unit": distributor["price_per_unit"],
            }
            for distributor, score in scored
        ]

    @staticmethod
    def _index_by_id(distributors):
        return {distributor["id"]: distributor for distributor in distributors}

    @staticmethod
    def _normalize_text(text):
        return " ".join(str(text or "").replace("\r", "\n").split()).strip()

    @classmethod
    def _strip_common_prefixes(cls, text):
        cleaned = cls._normalize_text(text)
        prefixes = (
            "AGENT THOUGHT:",
            "THOUGHT:",
            "REASONING:",
            "FINAL_DECISION:",
            "FINAL DECISION:",
        )

        while cleaned:
            matched_prefix = None
            upper_cleaned = cleaned.upper()
            for prefix in prefixes:
                if upper_cleaned.startswith(prefix):
                    matched_prefix = prefix
                    cleaned = cleaned[len(prefix) :].strip()
                    break
            if matched_prefix is None:
                break

        return cleaned

    @staticmethod
    def _strip_incomplete_sentences(text):
        cleaned = str(text or "").strip()
        if not cleaned:
            return ""
        if re.search(r'[.!?]["\')\]]*$', cleaned):
            return cleaned

        sentence_matches = list(re.finditer(r'[.!?]["\')\]]*(?=\s|$)', cleaned))
        if sentence_matches:
            return cleaned[: sentence_matches[-1].end()].strip()

        return cleaned.rstrip(" ,:;-")

    @classmethod
    def _sanitize_step_thought(cls, text, fallback):
        cleaned = cls._strip_common_prefixes(text)
        cleaned = cls._strip_incomplete_sentences(cleaned)
        if not cleaned:
            return fallback

        first_sentence = re.split(r"(?<=[.!?])\s+", cleaned, maxsplit=1)[0].strip()
        if not first_sentence:
            return fallback

        if re.match(r"(?i)(?:now|next|then|first)?\s*,?\s*(?:i|we)\b", first_sentence):
            return fallback

        if len(first_sentence.split()) > 18:
            return fallback

        if first_sentence[-1] not in ".!?":
            first_sentence = first_sentence.rstrip(" ,:;-") + "."

        return first_sentence

    @classmethod
    def _extract_structured_sections(cls, text):
        raw_text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
        pattern = re.compile(
            r"(?ms)^\s*(REASONING|TRADEOFFS|FINAL_DECISION)\s*:\s*(.*?)(?=^\s*(?:REASONING|TRADEOFFS|FINAL_DECISION)\s*:|\Z)"
        )

        sections = {}
        for name, body in pattern.findall(raw_text):
            cleaned_body = cls._strip_incomplete_sentences(cls._normalize_text(body))
            if cleaned_body:
                sections[name] = cleaned_body

        return sections

    def _agent_step_sentence(self, step_key, prompt_step_name, state):
        fallback = self.STEP_FALLBACKS.get(
            step_key,
            "Reviewing the current procurement state.",
        )
        if self.agent is None:
            return fallback

        try:
            thought = self.agent.think(prompt_step_name, state)
        except Exception:
            return fallback

        return self._sanitize_step_thought(thought, fallback)

    def _build_decision_explanation(self, best, order, scored):
        lead_time = best["lead_days"]
        unit_price = f"{best['price_per_unit']:.2f}"
        explanation = (
            f"{best['name']} achieved the strongest combined score after feasibility filtering. "
            f"It can deliver {order['required_units']} units in {lead_time} days at {unit_price} per unit "
            f"while maintaining a supplier rating of {best['rating']}."
        )

        if len(scored) > 1:
            runner_up = scored[1][0]
            explanation += (
                f" It outperformed {runner_up['name']} under the current distance, lead-time, rating, and price weights."
            )

        return explanation

    def _build_reflection_fallback(self, best, scored):
        reflection = (
            f"The decision is internally consistent because {best['name']} ranked first under the active constraints and weights. "
            "The main weakness is that the model still optimizes for a single supplier with fixed weights, so split orders, supplier capacity shifts, "
            "and future pricing volatility are not tested here."
        )

        if len(scored) > 1:
            runner_up = scored[1][0]
            reflection += (
                f" A different winner could emerge if the weight on price or lead time changed relative to {runner_up['name']}."
            )

        return reflection

    def _generate_decision_explanation(self, audit_logs, context, order, best, scored):
        fallback = self._build_decision_explanation(best, order, scored)
        if self.agent is None:
            return fallback

        try:
            llm_output = self.agent.generate_reasoning(audit_logs, context, order)
        except Exception:
            return fallback

        sections = self._extract_structured_sections(llm_output)
        explanation = " ".join(
            section
            for section in (
                sections.get("REASONING"),
                sections.get("TRADEOFFS"),
                sections.get("FINAL_DECISION"),
            )
            if section
        )

        if not explanation:
            explanation = self._strip_incomplete_sentences(
                self._strip_common_prefixes(llm_output)
            )

        if not explanation or len(explanation.split()) < 10:
            return fallback

        return explanation

    def _generate_reflection(self, audit_logs, decision_summary, best, scored):
        fallback = self._build_reflection_fallback(best, scored)
        if self.agent is None:
            return fallback

        try:
            reflection = self.agent.reflect(audit_logs, decision_summary)
        except Exception:
            return fallback

        cleaned_reflection = self._strip_incomplete_sentences(
            self._normalize_text(reflection)
        )
        if not cleaned_reflection or len(cleaned_reflection.split()) < 10:
            return fallback

        return cleaned_reflection

    def _log_separator(self):
        self.audit.log(self.SEPARATOR)

    def _log_stage(self, icon, title, insight):
        self._log_separator()
        self.audit.log(f"{icon} {title}")
        self.audit.log(f"   {insight}")

    def _log_shortlist(self, distributors):
        self.audit.log(f"   Shortlist ({len(distributors)}):")
        if not distributors:
            self.audit.log("      • None")
            return

        for distributor in distributors:
            self.audit.log(f"      • {distributor['name']}")

    def _log_rejections(self, before_distributors, after_distributors, reason):
        before_by_id = self._index_by_id(before_distributors)
        after_ids = {distributor["id"] for distributor in after_distributors}
        removed_ids = [
            distributor["id"]
            for distributor in before_distributors
            if distributor["id"] not in after_ids
        ]

        for distributor_id in removed_ids:
            distributor = before_by_id[distributor_id]
            self.audit.log(f"   ✖ {distributor['name']}: {reason}")

    def _apply_filter(self, filter_func, distributors, context, order):
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            return filter_func(distributors, context, order)

    def _score_distributors(self, distributors, context, order):
        scored = []
        scoring_logs = []
        original_log = self.audit.log

        def capture_score_log(message):
            scoring_logs.append(message)

        self.audit.log = capture_score_log
        try:
            for distributor in distributors:
                score = self.scoring_engine.score(distributor, context, order)
                scored.append((distributor, score))
        finally:
            self.audit.log = original_log

        return scored, scoring_logs

    @staticmethod
    def _build_decision_summary(best, order, explanation):
        return "\n".join(
            [
                f"Selected: {best['name']}",
                f"Lead Time: {best['lead_days']} days",
                f"Quantity: {order['required_units']}",
                f"Why: {explanation}",
            ]
        )

    def process_order(self, context, order):
        distributors = list(self.distributors)

        activation_state = {
            "context": context,
            "order": order,
            "available_count": len(distributors),
            "available_distributors": self._summarize_distributors(distributors),
        }
        self._log_stage(
            "🤖",
            "AGENT ACTIVATION",
            self._agent_step_sentence(
                "Analyze available distributors",
                "Analyze available distributors",
                activation_state,
            ),
        )
        if order.get("pharmacy_id"):
            self.audit.log(f"   Pharmacy ID: {order['pharmacy_id']}")
        self.audit.log(f"   Medicine ID: {order['medicine_id']}")
        self.audit.log(f"   Required Units: {order['required_units']}")
        self._log_shortlist(distributors)

        for filter_func in self.pipeline.filters:
            stage_title = self.FILTER_STEP_LABELS.get(
                filter_func.__name__,
                filter_func.__name__.replace("_", " ").title(),
            )
            rejection_reason = self.FILTER_REJECTION_REASONS.get(
                filter_func.__name__,
                "Did not meet the active criteria",
            )
            before_distributors = list(distributors)

            self._log_stage(
                "🔍",
                stage_title,
                self._agent_step_sentence(
                    filter_func.__name__,
                    stage_title,
                    {
                        "context": context,
                        "order": order,
                        "input_count": len(before_distributors),
                        "distributors": self._summarize_distributors(before_distributors),
                    },
                ),
            )

            distributors = self._apply_filter(
                filter_func,
                before_distributors,
                context,
                order,
            )

            self.audit.log(
                f"   Remaining: {len(before_distributors)} -> {len(distributors)} suppliers"
            )
            self._log_rejections(before_distributors, distributors, rejection_reason)
            self._log_shortlist(distributors)

            if not distributors:
                self._log_separator()
                self.audit.log("⚠️ PROCUREMENT HALTED")
                self.audit.log(
                    "   No suppliers satisfied the active procurement constraints."
                )
                self._log_separator()
                return {"error": "No valid distributors found"}

        scoring_state = {
            "context": context,
            "order": order,
            "remaining_count": len(distributors),
            "weights": self.scoring_engine.weights,
            "distributors": self._summarize_distributors(distributors),
        }
        scored, scoring_logs = self._score_distributors(distributors, context, order)
        scored.sort(key=lambda item: item[1], reverse=True)

        self._log_stage(
            "📊",
            "SCORING",
            self._agent_step_sentence(
                "Evaluate scoring",
                "Evaluate scoring",
                scoring_state,
            ),
        )
        self.audit.log("   Ranked suppliers:")
        for rank, (distributor, score) in enumerate(scored, start=1):
            self.audit.log(
                "      "
                f"{rank}. {distributor['name']} | score {round(score, 4)} | "
                f"lead {distributor['lead_days']} days | price {distributor['price_per_unit']:.2f} | "
                f"rating {distributor['rating']}"
            )

        best = scored[0][0]

        reasoning_logs = list(self.audit.get_logs())
        if scoring_logs:
            reasoning_logs.append("SCORING DETAILS:")
            reasoning_logs.extend(scoring_logs)
        reasoning_logs.append(
            f"SELECTED DISTRIBUTOR: {best['name']} ({round(scored[0][1], 4)})"
        )

        explanation = self._generate_decision_explanation(
            reasoning_logs,
            context,
            order,
            best,
            scored,
        )

        self._log_separator()
        self.audit.log("🏆 FINAL DECISION")
        self.audit.log(f"   Selected: {best['name']}")
        self.audit.log(f"   Lead Time: {best['lead_days']} days")
        self.audit.log(f"   Quantity: {order['required_units']}")
        self.audit.log("")
        self.audit.log("💡 WHY:")
        self.audit.log(f"   {explanation}")

        decision_summary = self._build_decision_summary(best, order, explanation)
        reflection_logs = list(self.audit.get_logs())
        if scoring_logs:
            reflection_logs.append("SCORING DETAILS:")
            reflection_logs.extend(scoring_logs)

        reflection = self._generate_reflection(
            reflection_logs,
            decision_summary,
            best,
            scored,
        )

        self._log_separator()
        self.audit.log("🔄 AGENT REFLECTION")
        self.audit.log(f"   {reflection}")
        self._log_separator()

        audit_logs = self.audit.get_logs()
        return {
            "distributor_id": best["id"],
            "distributor_name": best["name"],
            "quantity": order["required_units"],
            "status": "PLACED",
            "audit_log": audit_logs,
            "agent_reasoning": explanation,
            "reflection": reflection,
        }
