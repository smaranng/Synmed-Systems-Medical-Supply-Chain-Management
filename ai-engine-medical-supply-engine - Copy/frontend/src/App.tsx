import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { InventoryResponse, fetchInventory } from './api/api';
import ProcurementPage from './pages/ProcurementPage';
import ProcurementSetupPage from './pages/ProcurementSetupPage';
import {
  getMedicineDisplayName,
  isWhitelistedMedicine,
} from './config/medicineCatalog';

type View = 'setup' | 'procurement';

function App() {
  const [view, setView] = useState<View>('setup');
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadInventory = async () => {
      try {
        setLoadingInventory(true);
        setInventoryError(null);
        const response = await fetchInventory();

        if (!cancelled) {
          setInventory(response);
        }
      } catch (error) {
        if (!cancelled) {
          setInventoryError(
            error instanceof Error ? error.message : 'Failed to fetch inventory snapshot.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingInventory(false);
        }
      }
    };

    loadInventory();
    return () => {
      cancelled = true;
    };
  }, []);

  const whitelistedInventoryItems =
    inventory?.inventory.filter((item) => isWhitelistedMedicine(item.medicine_id)) ?? [];
  const whitelistedReorderRequests =
    inventory?.reorder_requests
      .filter((item) => isWhitelistedMedicine(item.medicine_id))
      .map((item) => ({
        ...item,
        medicine_name: getMedicineDisplayName(item.medicine_id, item.medicine_name),
      })) ?? [];

  return (
    <div className="synmed-theme min-h-screen overflow-x-hidden px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section
          className="synmed-banner relative overflow-hidden rounded-3xl border border-cyan-200/50 p-6 text-white shadow-panel sm:p-8"
          style={{
            background: 'linear-gradient(120deg, #0f4c81, #0ea5a8, #34d399, #0f4c81)',
            backgroundSize: '260% 260%',
            animation: 'synmedprocai-shift 10s ease infinite',
          }}
        >
          <div className="absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/20 blur-2xl" style={{ animation: 'synmedprocai-float 5s ease-in-out infinite' }} />
          <div className="absolute -bottom-10 -left-8 h-36 w-36 rounded-full bg-cyan-100/30 blur-2xl" style={{ animation: 'synmedprocai-float 7s ease-in-out infinite' }} />
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
              <Sparkles className="h-3.5 w-3.5" />
              Smart Procurement AI
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">SynmedProcAI</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-50 sm:text-base">
              Smarter Medicine Procurement Starts Here. Forecast demand, evaluate risk, and execute
              budget-aware orders in one guided workspace.
            </p>
          </div>
        </section>

        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 shadow-panel backdrop-blur">
          <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.6fr_1fr] lg:px-10">
            <div className="space-y-4">

              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                  AI-powered forecasting and budget-aware procurement oversight for the full medicine portfolio.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Unify live demand projections, inventory thresholds, supplier pricing, and budget-constrained
                  procurement decisions in a single enterprise workspace.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-100/80">
                Inventory Status
              </p>

              {loadingInventory ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/60 p-4 text-sm text-slate-300">
                  Loading inventory snapshot...
                </div>
              ) : null}

              {inventoryError ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {inventoryError}
                </div>
              ) : null}

              {inventory ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-brand-sand p-4 text-brand-ink">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-cyan/80">
                        Medicines
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {whitelistedInventoryItems.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand-mist p-4 text-brand-ink">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-teal/80">
                        Reorder Flags
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {whitelistedReorderRequests.length}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Top reorder candidates
                    </p>
                    <div className="mt-3 space-y-3">
                      {whitelistedReorderRequests.slice(0, 3).map((item) => (
                        <div
                          key={item.medicine_id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{item.medicine_name}</p>
                            <p className="text-xs text-slate-400">{item.trigger_reason}</p>
                          </div>
                          <span className="rounded-full bg-brand-coral px-3 py-1 text-xs font-semibold text-white">
                            {item.order_quantity} units
                          </span>
                        </div>
                      ))}
                      {whitelistedReorderRequests.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                          No whitelisted medicines currently require reorder action.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setView('setup')}
            className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
              view === 'setup'
                ? 'bg-brand-sand text-brand-ink shadow-lg'
                : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
            }`}
          >
            Forecast Dashboard
          </button>
          <button
            type="button"
            onClick={() => setView('procurement')}
            className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
              view === 'procurement'
                ? 'bg-brand-mist text-brand-ink shadow-lg'
                : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
            }`}
          >
            Procurement Decisions
          </button>
        </nav>

        {view === 'setup' ? <ProcurementSetupPage /> : <ProcurementPage />}
      </div>
    </div>
  );
}

export default App;
