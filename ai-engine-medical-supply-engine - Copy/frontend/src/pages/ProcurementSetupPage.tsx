import { useEffect, useMemo, useState } from 'react';
import {
  ForecastResponse,
  InventoryResponse,
  fetchForecast,
  fetchInventory,
} from '../api/api';
import ForecastTable, { ForecastDashboardRow } from '../components/ForecastTable';
import Loader from '../components/Loader';
import StatusBadge from '../components/StatusBadge';
import SummaryCards from '../components/SummaryCards';
import {
  getMedicineDisplayName,
  isWhitelistedMedicine,
} from '../config/medicineCatalog';

function ProcurementSetupPage() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError(false);

        const [forecastResponse, inventoryResponse] = await Promise.all([
          fetchForecast(),
          fetchInventory(),
        ]);

        if (!cancelled) {
          setForecast(forecastResponse);
          setInventory(inventoryResponse);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<ForecastDashboardRow[]>(() => {
    if (!forecast) {
      return [];
    }

    const inventoryByMedicineId = new Map(
      (inventory?.inventory ?? []).map((item) => [item.medicine_id, item]),
    );

    return forecast.forecasts
      .filter((item) => isWhitelistedMedicine(item.medicine_id))
      .map((item) => {
        const inventoryItem = inventoryByMedicineId.get(item.medicine_id);
        const reorder =
          inventoryItem?.reorder ?? item.next_month_forecast > item.last_observed_quantity;
        const percentChange =
          item.last_observed_quantity === 0
            ? item.next_month_forecast === 0
              ? 0
              : 100
            : ((item.next_month_forecast - item.last_observed_quantity) /
                item.last_observed_quantity) *
              100;

        return {
          medicineId: item.medicine_id,
          medicineName: getMedicineDisplayName(
            item.medicine_id,
            item.medicine_name,
          ),
          lastObservedDemand: item.last_observed_quantity,
          forecastedDemand: item.next_month_forecast,
          percentChange,
          reorder,
          currentStock: inventoryItem?.current_stock ?? null,
          safetyStock: inventoryItem?.safety_stock ?? null,
          reorderPoint: inventoryItem?.reorder_point ?? null,
          targetStock: inventoryItem?.target_stock ?? null,
          orderQuantity: inventoryItem?.order_quantity ?? null,
        };
      });
  }, [forecast, inventory]);

  const reorderCount = useMemo(() => rows.filter((row) => row.reorder).length, [rows]);
  const highestForecastRow = useMemo(() => {
    return rows.reduce<ForecastDashboardRow | null>((highestRow, currentRow) => {
      if (!highestRow || currentRow.forecastedDemand > highestRow.forecastedDemand) {
        return currentRow;
      }

      return highestRow;
    }, null);
  }, [rows]);
  const averageDemand = useMemo(() => {
    if (rows.length === 0) {
      return 0;
    }

    return rows.reduce((total, row) => total + row.lastObservedDemand, 0) / rows.length;
  }, [rows]);
  const topReorderRows = useMemo(() => {
    return [...rows]
      .filter((row) => row.reorder)
      .sort((left, right) => {
        return (
          (right.orderQuantity ?? right.forecastedDemand) -
          (left.orderQuantity ?? left.forecastedDemand)
        );
      })
      .slice(0, 5);
  }, [rows]);
  const reorderCoverage = rows.length === 0 ? 0 : (reorderCount / rows.length) * 100;

  if (loading) {
    return <Loader />;
  }

  if (error || !forecast) {
    return (
      <section className="dashboard-fade-in rounded-[2rem] border border-amber-400/25 bg-amber-500/10 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
          Forecasting Unavailable
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          We could not load the demand forecasting workspace.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-50/90">
          Check that the FastAPI backend is running, then refresh the page to retry the demand
          forecast and inventory insight calls.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full border border-amber-200/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          Retry dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-8 dashboard-fade-in">
      <header className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-panel backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
              Demand Forecast Overview
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Enterprise demand forecasting for the approved medicine list
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              Review the whitelisted medicines, quantify forecast uplift, and surface reorder
              action from the live inventory model without leaving the dashboard.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-400/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                Forecast Dataset
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{forecast.dataset}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Last Refresh
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {new Date(forecast.generated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </header>

      <SummaryCards
        totalMedicines={rows.length}
        reorderCount={reorderCount}
        highestForecastMedicine={highestForecastRow?.medicineName ?? 'N/A'}
        highestForecastValue={highestForecastRow?.forecastedDemand ?? 0}
        averageDemand={averageDemand}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <ForecastTable rows={rows} />

        <aside className="min-w-0 space-y-6">
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-panel backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
              Inventory Insights
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Model-driven stock signals
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Reorder status uses the backend flag when available. If an inventory signal is absent,
              the dashboard falls back to comparing forecasted demand against the last observed demand.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Reorder coverage
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {reorderCoverage.toFixed(1)}%
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Inventory model fields
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Current stock, safety stock, reorder point, target stock, and suggested order
                  quantity are displayed for every medicine in the table.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-panel backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-sand">
              Priority Queue
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Medicines with the highest reorder pressure
            </h3>

            <div className="mt-6 space-y-4">
              {topReorderRows.length === 0 ? (
                <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  No medicines currently exceed the reorder threshold.
                </div>
              ) : (
                topReorderRows.map((row) => (
                  <article
                    key={row.medicineId}
                    className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-white">{row.medicineName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {row.medicineId}
                        </p>
                      </div>
                      <StatusBadge reorder={row.reorder} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Forecast vs demand</p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {row.forecastedDemand.toFixed(2)} forecast | {row.lastObservedDemand.toFixed(2)} last observed
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Suggested order quantity</p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {row.orderQuantity !== null ? row.orderQuantity.toFixed(2) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default ProcurementSetupPage;
