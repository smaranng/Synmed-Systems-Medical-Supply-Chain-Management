import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ProcurementPriority,
  ProcurementReason,
  ProcurementUrgencyLevel,
} from '../api/api';
import PriorityBadge from './PriorityBadge';

export interface ProcurementDashboardRow {
  medicineId: string;
  medicineName: string;
  priority: ProcurementPriority;
  priorityScore: number;
  isCritical: boolean;
  selectedForOrder: boolean;
  orderCycle: number | null;
  reason: ProcurementReason;
  cost: number | null;
  orderQuantity: number;
  distributorId: string | null;
  distributorName: string | null;
  leadDays: number | null;
  pricePerUnit: number | null;
  currentStock: number | null;
  reorderPoint: number | null;
  daysToStockout: number | null;
  safeDeadlineDays: number | null;
  urgencyLevel: ProcurementUrgencyLevel;
  adjustedCycle: number | null;
  triggerReason: string | null;
}

type SortKey = 'decision' | 'priority' | 'cycle' | 'price';
type StatusFilter = 'all' | 'critical' | 'selected' | 'skipped';

interface ProcurementTableProps {
  rows: ProcurementDashboardRow[];
}

const PAGE_SIZES = [10, 25, 50];

function formatNumber(value: number | null, digits = 2): string {
  if (value === null) {
    return 'N/A';
  }

  return value.toFixed(digits);
}

function decisionRank(reason: ProcurementReason): number {
  if (reason === 'CRITICAL') {
    return 0;
  }

  if (reason === 'KNAPSACK') {
    return 1;
  }

  return 2;
}

function decisionLabel(reason: ProcurementReason): string {
  if (reason === 'CRITICAL') {
    return 'Critical';
  }

  if (reason === 'KNAPSACK') {
    return 'Selected (Optimal)';
  }

  return 'Skipped';
}

function decisionClassName(reason: ProcurementReason): string {
  if (reason === 'CRITICAL') {
    return 'border border-rose-300/60 bg-rose-100 text-rose-800';
  }

  if (reason === 'KNAPSACK') {
    return 'border border-amber-300/60 bg-amber-100 text-amber-800';
  }

  return 'border border-slate-200 bg-white text-slate-700';
}

function urgencyClassName(urgencyLevel: ProcurementUrgencyLevel): string {
  if (urgencyLevel === 'CRITICAL') {
    return 'border border-rose-300/60 bg-rose-100 text-rose-800';
  }

  if (urgencyLevel === 'URGENT') {
    return 'border border-amber-300/60 bg-amber-100 text-amber-800';
  }

  return 'border border-emerald-300/60 bg-emerald-100 text-emerald-800';
}

function formatDeadlineText(value: number | null): string {
  if (value === null) {
    return 'No near-term deadline';
  }

  if (value <= 0) {
    return 'Order now';
  }

  const roundedDays = value < 10 ? value.toFixed(1) : value.toFixed(0);
  return `Order within ${roundedDays} days`;
}

function ProcurementTable({ rows }: ProcurementTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('decision');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.medicineName.toLowerCase().includes(normalizedQuery) ||
        row.medicineId.toLowerCase().includes(normalizedQuery) ||
        (row.distributorName ?? '').toLowerCase().includes(normalizedQuery) ||
        (row.triggerReason ?? '').toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      if (statusFilter === 'critical' && !row.isCritical) {
        return false;
      }

      if (statusFilter === 'selected' && !row.selectedForOrder) {
        return false;
      }

      if (statusFilter === 'skipped' && row.selectedForOrder) {
        return false;
      }

      return true;
    });
  }, [deferredSearchQuery, rows, statusFilter]);

  const sortedRows = useMemo(() => {
    const nextRows = [...filteredRows];

    nextRows.sort((left, right) => {
      if (sortKey === 'price') {
        return (right.pricePerUnit ?? 0) - (left.pricePerUnit ?? 0);
      }

      if (sortKey === 'cycle') {
        const leftCycle = left.orderCycle ?? Number.POSITIVE_INFINITY;
        const rightCycle = right.orderCycle ?? Number.POSITIVE_INFINITY;

        if (leftCycle !== rightCycle) {
          return leftCycle - rightCycle;
        }
      }

      if (sortKey === 'priority') {
        if (left.priorityScore !== right.priorityScore) {
          return right.priorityScore - left.priorityScore;
        }

        return left.medicineId.localeCompare(right.medicineId);
      }

      const leftRank = decisionRank(left.reason);
      const rightRank = decisionRank(right.reason);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      if (left.priorityScore !== right.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      return left.medicineId.localeCompare(right.medicineId);
    });

    return nextRows;
  }, [filteredRows, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery, pageSize, sortKey, statusFilter]);

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
    <article className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-md backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
            Hybrid Optimization
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Deadline-aware Medicine Selection
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Review reorder medicines matched by medID in Mongo, see which items were protected as critical,
            which were selected by cycle-level knapsack optimization, and which were moved earlier
            because their safety-stock deadline cannot support a later cycle.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search medicine, ID, supplier, or reason"
              className="h-11 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
            />

            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-11 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
            >
              <option value="decision">Sort by decision</option>
              <option value="priority">Sort by priority score</option>
              <option value="cycle">Sort by order cycle</option>
              <option value="price">Sort by price</option>
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

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter('critical')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                statusFilter === 'critical'
                  ? 'border border-rose-400/30 bg-rose-500/15 text-rose-100'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              Critical only
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('selected')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                statusFilter === 'selected'
                  ? 'border border-amber-300/30 bg-amber-400/15 text-amber-100'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              Selected
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('skipped')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                statusFilter === 'skipped'
                  ? 'border border-white/10 bg-slate-200/10 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              Skipped
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                statusFilter === 'all'
                  ? 'border border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              Show all
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <p>
          Showing <span className="font-semibold text-white">{paginatedRows.length}</span> of{' '}
          <span className="font-semibold text-white">{sortedRows.length}</span> approved reorder
          medicines
        </p>
        <p>Deadlines are derived from safety stock, demand, and lead time</p>
      </div>

      <div className="dashboard-scrollbar mt-5 w-full max-w-full overflow-auto rounded-[1.5rem] border border-white/10">
        <table className="min-w-[1780px] divide-y divide-white/10">
          <thead className="sticky top-0 z-10 bg-emerald-100 backdrop-blur">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
              <th className="px-4 py-4">Medicine</th>
              <th className="px-4 py-4">ID</th>
              <th className="px-4 py-4">Decision</th>
              <th className="px-4 py-4">Urgency</th>
              <th className="px-4 py-4">Safe Deadline</th>
              <th className="px-4 py-4">Priority</th>
              <th className="px-4 py-4">Priority Score</th>
              <th className="px-4 py-4">Order Cycle</th>
              <th className="px-4 py-4">Adjusted Cycle</th>
              <th className="px-4 py-4">Price</th>
              <th className="px-4 py-4">Quantity</th>
              <th className="px-4 py-4">Distributor</th>
              <th className="px-4 py-4">Lead Time</th>
              <th className="px-4 py-4">Days to Stockout</th>
              <th className="px-4 py-4">Current Stock</th>
              <th className="px-4 py-4">Reorder Point</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-100 text-sm text-slate-700">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-4 py-16 text-center text-slate-400">
                  No reorder medicines matched the active search and filters.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr
                  key={row.medicineId}
                  className={`transition hover:bg-emerald-100/60 ${index % 2 === 0 ? 'bg-emerald-50/50' : 'bg-white'}`}
                >
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{row.medicineName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.isCritical
                        ? 'Safety-stock deadline already breached'
                        : row.triggerReason ?? 'Reorder candidate'}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{row.medicineId}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${decisionClassName(
                        row.reason,
                      )}`}
                    >
                      {decisionLabel(row.reason)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${urgencyClassName(
                        row.urgencyLevel,
                      )}`}
                    >
                      {row.urgencyLevel}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-[9rem]">
                      <p className="font-medium text-white">
                        {formatDeadlineText(row.safeDeadlineDays)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.safeDeadlineDays !== null
                          ? `${formatNumber(row.safeDeadlineDays, 2)} safe days remaining`
                          : 'Demand-driven deadline not required'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="px-4 py-4 font-semibold text-brand-sand">
                    {row.priorityScore.toFixed(4)}
                  </td>
                  <td className="px-4 py-4">
                    {row.orderCycle !== null ? `Cycle ${row.orderCycle}` : 'Unassigned'}
                  </td>
                  <td className="px-4 py-4">
                    {row.adjustedCycle !== null ? `Cycle ${row.adjustedCycle}` : 'Unassigned'}
                  </td>
                  <td className="px-4 py-4">{formatNumber(row.pricePerUnit)}</td>
                  <td className="px-4 py-4">{row.orderQuantity.toFixed(0)}</td>
                  <td className="px-4 py-4">{row.distributorName ?? 'Pending assignment'}</td>
                  <td className="px-4 py-4">
                    {row.leadDays !== null ? `${row.leadDays} days` : 'N/A'}
                  </td>
                  <td className="px-4 py-4">{formatNumber(row.daysToStockout)}</td>
                  <td className="px-4 py-4">{formatNumber(row.currentStock)}</td>
                  <td className="px-4 py-4">{formatNumber(row.reorderPoint)}</td>
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

export default ProcurementTable;
