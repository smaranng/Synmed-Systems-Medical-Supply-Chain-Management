import { StoredOrder } from '../api/api';

interface OrdersSidebarProps {
  orders: StoredOrder[];
  loading: boolean;
  error: string | null;
  selectedOrderId?: string | null;
  onSelectOrder: (order: StoredOrder) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function OrdersSidebar({
  orders,
  loading,
  error,
  selectedOrderId = null,
  onSelectOrder,
}: OrdersSidebarProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-md backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
            Orders
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Execution history</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Open any confirmed order to review the full procurement receipt.
          </p>
        </div>

        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          {orders.length}
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300">
            Loading confirmed orders...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[1.5rem] border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        {!loading && !error && orders.length === 0 ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            No confirmed orders yet. Create a cycle-1 order to populate this sidebar.
          </div>
        ) : null}

        {!loading && !error
          ? orders.map((order) => (
              <button
                key={order.orderid}
                type="button"
                onClick={() => onSelectOrder(order)}
                className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                  selectedOrderId === order.orderid
                    ? 'border-cyan-300/30 bg-cyan-400/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{order.orderid}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-200">
                    {Object.keys(order.items).length} items
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-400">{order.distributorid}</span>
                  <span className="font-semibold text-brand-sand">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
              </button>
            ))
          : null}
      </div>
    </section>
  );
}

export default OrdersSidebar;
