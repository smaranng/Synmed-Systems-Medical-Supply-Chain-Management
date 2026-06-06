import { Fragment, ReactNode } from 'react';

export interface AgentReasoningStep {
  id: string;
  title: string;
  content: string;
}

interface AgentStepProps {
  index: number;
  step: AgentReasoningStep;
}

const HIGHLIGHT_PATTERN =
  /(lead time|suppliers|supplier|reorder|cost|priority|budget|cycle|optimal|knapsack|critical|stockout|deadline|safety stock|inventory|demand)/gi;
const HIGHLIGHT_TERMS = new Set([
  'lead time',
  'suppliers',
  'supplier',
  'reorder',
  'cost',
  'priority',
  'budget',
  'cycle',
  'optimal',
  'knapsack',
  'critical',
  'stockout',
  'deadline',
  'safety stock',
  'inventory',
  'demand',
]);

function renderHighlightedText(text: string): ReactNode {
  return text.split(HIGHLIGHT_PATTERN).map((part, index) => {
    if (!HIGHLIGHT_TERMS.has(part.toLowerCase())) {
      return <Fragment key={index}>{part}</Fragment>;
    }

    return (
      <strong key={index} className="font-semibold text-white">
        {part}
      </strong>
    );
  });
}

function AgentStep({ index, step }: AgentStepProps) {
  return (
    <article className="agent-step-enter rounded-2xl border border-white/10 bg-slate-900/75 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-xs font-semibold text-cyan-100">
          {index + 1}
        </div>

        <div className="min-w-0">
          <p className="text-base font-semibold text-white">{renderHighlightedText(step.title)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {renderHighlightedText(step.content)}
          </p>
        </div>
      </div>
    </article>
  );
}

export default AgentStep;
