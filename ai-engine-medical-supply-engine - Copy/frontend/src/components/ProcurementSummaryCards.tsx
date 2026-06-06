interface ProcurementSummaryCardsProps {
  orderCycles: number;
  budgetPerCycle: number;
  totalMedicines: number;
  selectedMedicines: number;
}

function ProcurementSummaryCards({
  orderCycles,
  budgetPerCycle,
  totalMedicines,
  selectedMedicines,
}: ProcurementSummaryCardsProps) {
  const cards = [
    {
      label: 'Order Cycles',
      value: orderCycles.toString(),
      hint: 'Budget releases available for procurement execution.',
      tone: 'border-cyan-300/50 bg-cyan-100 text-cyan-900',
    },
    {
      label: 'Budget Per Cycle',
      value: budgetPerCycle.toFixed(2),
      hint: 'Spend ceiling assigned to each procurement cycle.',
      tone: 'border-brand-sand/40 bg-brand-sand text-brand-ink',
    },
    {
      label: 'Total Medicines',
      value: totalMedicines.toString(),
      hint: 'Whitelisted medicines visible in the procurement dashboard.',
      tone: 'border-slate-200 bg-white text-slate-900',
    },
    {
      label: 'Selected Medicines',
      value: selectedMedicines.toString(),
      hint: 'Medicines assigned to a cycle by the procurement agent.',
      tone: 'border-emerald-300/60 bg-emerald-100 text-emerald-900',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      {cards.map((card) => (
        <article
          key={card.label}
          className={`rounded-2xl border p-6 shadow-md xl:col-span-3 ${card.tone}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
            {card.label}
          </p>
          <p className="mt-4 text-3xl font-semibold leading-tight">{card.value}</p>
          <p className="mt-3 text-sm opacity-80">{card.hint}</p>
        </article>
      ))}
    </div>
  );
}

export default ProcurementSummaryCards;
