interface SummaryCardsProps {
  totalMedicines: number;
  reorderCount: number;
  highestForecastMedicine: string;
  highestForecastValue: number;
  averageDemand: number;
}

function SummaryCards({
  totalMedicines,
  reorderCount,
  highestForecastMedicine,
  highestForecastValue,
  averageDemand,
}: SummaryCardsProps) {
  const cards = [
    {
      label: 'Total Medicines',
      value: totalMedicines.toString(),
      hint: 'Forecasted from the live medicine catalog',
      className: 'bg-brand-sand text-brand-ink',
    },
    {
      label: 'Medicines Requiring Reorder',
      value: reorderCount.toString(),
      hint: 'Flagged by inventory thresholds or forecast uplift',
      className: 'bg-rose-500/15 text-rose-50',
    },
    {
      label: 'Highest Forecast Medicine',
      value: highestForecastMedicine,
      hint: `Projected demand ${highestForecastValue.toFixed(2)}`,
      className: 'bg-brand-mist text-brand-ink',
    },
    {
      label: 'Average Demand',
      value: averageDemand.toFixed(2),
      hint: 'Mean last observed demand across all medicines',
      className: 'bg-white/5 text-white',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className={`rounded-[1.75rem] border border-white/10 p-5 shadow-panel ${card.className}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
            {card.label}
          </p>
          <p className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
            {card.value}
          </p>
          <p className="mt-3 text-sm opacity-80">{card.hint}</p>
        </article>
      ))}
    </div>
  );
}

export default SummaryCards;
