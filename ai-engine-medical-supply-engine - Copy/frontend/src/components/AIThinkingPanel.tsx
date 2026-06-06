import { useEffect, useMemo, useState } from 'react';
import AgentStep, { AgentReasoningStep } from './AgentStep';

interface AIThinkingPanelProps {
  steps: AgentReasoningStep[];
  streaming: boolean;
  processing: boolean;
  queuedStepCount: number;
  collapsed: boolean;
  streamSourceLabel: string;
  onToggleCollapse: () => void;
}

const THINKING_DOTS = ['.', '..', '...'] as const;

function AIThinkingPanel({
  steps,
  streaming,
  processing,
  queuedStepCount,
  collapsed,
  streamSourceLabel,
  onToggleCollapse,
}: AIThinkingPanelProps) {
  const [thinkingFrame, setThinkingFrame] = useState(0);
  const isAnalyzing = streaming || processing || queuedStepCount > 0;
  const latestStep = steps.length > 0 ? steps[steps.length - 1] : null;

  useEffect(() => {
    if (!isAnalyzing) {
      setThinkingFrame(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setThinkingFrame((currentValue) => (currentValue + 1) % THINKING_DOTS.length);
    }, 420);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAnalyzing]);

  const statusBadge = useMemo(() => {
    if (isAnalyzing) {
      return {
        label: 'Live',
        tone: 'border border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
      };
    }

    if (steps.length > 0) {
      return {
        label: 'Complete',
        tone: 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
      };
    }

    return {
      label: 'Waiting',
      tone: 'border border-white/10 bg-white/5 text-slate-200',
    };
  }, [isAnalyzing, steps.length]);

  return (
    <section className="dashboard-fade-in overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 shadow-md backdrop-blur">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
              AI Procurement Agent
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              AI Procurement Agent
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              Live decision-making based on demand, inventory, and constraints.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.tone}`}
            >
              {statusBadge.label}
            </span>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              {collapsed ? 'Expand reasoning' : 'Collapse reasoning'}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span>
            Stream source:{' '}
            <span className="font-semibold text-slate-200">{streamSourceLabel}</span>
          </span>
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <span>
            Rendered steps: <span className="font-semibold text-slate-200">{steps.length}</span>
          </span>
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <span>
            Pending queue:{' '}
            <span className="font-semibold text-slate-200">{queuedStepCount}</span>
          </span>
        </div>
      </div>

      {collapsed ? (
        <div className="px-6 py-5">
          {latestStep ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Latest step
              </p>
              <p className="mt-2 text-base font-semibold text-white">{latestStep.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{latestStep.content}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              {isAnalyzing
                ? `AI is analyzing${THINKING_DOTS[thinkingFrame]}`
                : 'The panel will populate once streamed reasoning steps arrive.'}
            </div>
          )}
        </div>
      ) : (
        <div className="dashboard-scrollbar max-h-[460px] overflow-auto px-6 py-5">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <AgentStep key={step.id} step={step} index={index} />
            ))}

            {isAnalyzing ? (
              <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-400/5 p-4">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="font-medium">
                    AI is analyzing{THINKING_DOTS[thinkingFrame]}
                  </span>
                  <span className="agent-thinking-cursor text-cyan-200">▌</span>
                </div>
              </div>
            ) : null}

            {!isAnalyzing && steps.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                Live reasoning was unavailable for this session. The final procurement payload was
                loaded directly so execution can continue without data loss.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

export default AIThinkingPanel;
