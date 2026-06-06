import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import StatusBadge from './StatusBadge';

export interface ForecastDashboardRow {
  medicineId: string;
  medicineName: string;
  lastObservedDemand: number;
  forecastedDemand: number;
  percentChange: number;
  reorder: boolean;
  currentStock: number | null;
  safetyStock: number | null;
  reorderPoint: number | null;
  targetStock: number | null;
  orderQuantity: number | null;
}

type SortKey = 'reorder' | 'forecast' | 'demand' | 'change';

interface ForecastTableProps {
  rows: ForecastDashboardRow[];
}

const PAGE_SIZES = [10, 25, 50];

function formatNumber(value: number | null): string {
  if (value === null) {
    return 'N/A';
  }

  return value.toFixed(2);
}

function ForecastTable({ rows }: ForecastTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('reorder');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => {
      return (
        row.medicineName.toLowerCase().includes(normalizedQuery) ||
        row.medicineId.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [deferredSearchQuery, rows]);

  const sortedRows = useMemo(() => {
    const nextRows = [...filteredRows];

    nextRows.sort((left, right) => {
      if (sortKey === 'forecast') {
        return right.forecastedDemand - left.forecastedDemand;
      }

      if (sortKey === 'demand') {
        return right.lastObservedDemand - left.lastObservedDemand;
      }

      if (sortKey === 'change') {
        return right.percentChange - left.percentChange;
      }

      if (left.reorder !== right.reorder) {
        return Number(right.reorder) - Number(left.reorder);
      }

      return (right.orderQuantity ?? 0) - (left.orderQuantity ?? 0);
    });

    return nextRows;
  }, [filteredRows, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery, pageSize, sortKey]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [page, pageSize, sortedRows]);

  return (
    <article className="min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-panel backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
            Demand Forecast Overview
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Medicine demand table
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Search the approved medicine catalog, sort by demand pressure, and review the
            inventory signal set produced by the forecasting and reorder models.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search medicine name or ID"
            className="h-11 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
          />

          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="h-11 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
          >
            <option value="reorder">Sort by reorder priority</option>
            <option value="forecast">Sort by forecast</option>
            <option value="demand">Sort by demand</option>
            <option value="change">Sort by % change</option>
          </select>

          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="h-11 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <p>
          Showing <span className="font-semibold text-white">{paginatedRows.length}</span> of{' '}
          <span className="font-semibold text-white">{sortedRows.length}</span> whitelisted
          medicines
        </p>
        <p>Sticky header, live search, hover states, and full-model output included</p>
      </div>

      <div className="dashboard-scrollbar mt-5 w-full max-w-full overflow-auto rounded-[1.5rem] border border-white/10">
        <table className="min-w-[1120px] divide-y divide-white/10">
          <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <th className="px-4 py-4">Medicine</th>
              <th className="px-4 py-4">ID</th>
              <th className="px-4 py-4">Last Observed</th>
              <th className="px-4 py-4">Forecast</th>
              <th className="px-4 py-4">% Change</th>
              <th className="px-4 py-4">Current Stock</th>
              <th className="px-4 py-4">Safety Stock</th>
              <th className="px-4 py-4">Reorder Point</th>
              <th className="px-4 py-4">Target Stock</th>
              <th className="px-4 py-4">Suggested Qty</th>
              <th className="px-4 py-4">Reorder Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-sm text-slate-200">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center text-slate-400">
                  No medicines matched your search.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr
                  key={row.medicineId}
                  className={`transition hover:bg-cyan-300/6 ${
                    index % 2 === 0 ? 'bg-white/[0.03]' : 'bg-transparent'
                  }`}
                >
                  <td className="px-4 py-4 font-medium text-white">{row.medicineName}</td>
                  <td className="px-4 py-4 text-slate-400">{row.medicineId}</td>
                  <td className="px-4 py-4">{formatNumber(row.lastObservedDemand)}</td>
                  <td className="px-4 py-4 font-semibold text-brand-sand">
                    {formatNumber(row.forecastedDemand)}
                  </td>
                  <td className={`px-4 py-4 font-medium ${row.percentChange >= 0 ? 'text-cyan-100' : 'text-amber-200'}`}>
                    {row.percentChange >= 0 ? '+' : ''}
                    {row.percentChange.toFixed(1)}%
                  </td>
                  <td className="px-4 py-4">{formatNumber(row.currentStock)}</td>
                  <td className="px-4 py-4">{formatNumber(row.safetyStock)}</td>
                  <td className="px-4 py-4">{formatNumber(row.reorderPoint)}</td>
                  <td className="px-4 py-4">{formatNumber(row.targetStock)}</td>
                  <td className="px-4 py-4">{formatNumber(row.orderQuantity)}</td>
                  <td className="px-4 py-4">
                    <StatusBadge reorder={row.reorder} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Page <span className="font-semibold text-white">{page}</span> of{' '}
          <span className="font-semibold text-white">{pageCount}</span>
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            disabled={page === 1}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
            disabled={page === pageCount}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </article>
  );
}

export default ForecastTable;
