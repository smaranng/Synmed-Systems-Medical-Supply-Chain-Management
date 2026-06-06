interface LoaderProps {
  message?: string;
  description?: string;
}

function Loader({
  message = 'Running AI demand forecasting models...',
  description = 'Forecasts, reorder thresholds, and inventory indicators are being prepared.',
}: LoaderProps) {
  return (
    <section className="space-y-6 dashboard-fade-in">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          <div>
            <p className="text-lg font-semibold text-white">{message}</p>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/5"
          />
        ))}
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-panel backdrop-blur">
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="h-11 w-full max-w-sm animate-pulse rounded-2xl bg-white/5" />
          <div className="h-11 w-40 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-11 w-32 animate-pulse rounded-2xl bg-white/5" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-white/5"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Loader;
