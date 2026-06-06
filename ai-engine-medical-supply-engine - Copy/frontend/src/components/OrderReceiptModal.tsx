import { OrderPayload, StoredOrder } from '../api/api';

type ReceiptOrder = OrderPayload | StoredOrder;

interface OrderFeedback {
  message: string;
  tone: 'success' | 'error';
}

interface OrderReceiptModalProps {
  order: ReceiptOrder | null;
  onClose: () => void;
  onConfirm?: () => void;
  confirming?: boolean;
  feedback?: OrderFeedback | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return 'Pending confirmation';
  }

  return new Date(value).toLocaleString();
}

function calculateItemTotal(orderItem: ReceiptOrder['items'][string]): number {
  return Number(
    (orderItem.taxBreakdown.taxable + orderItem.taxBreakdown.gst).toFixed(2),
  );
}

function calculateTotals(order: ReceiptOrder) {
  return Object.values(order.items).reduce(
    (totals, item) => {
      totals.gross += item.taxBreakdown.gross;
      totals.discount += item.taxBreakdown.discount;
      totals.taxable += item.taxBreakdown.taxable;
      totals.gst += item.taxBreakdown.gst;
      totals.cgst += item.taxBreakdown.cgst;
      totals.sgst += item.taxBreakdown.sgst;
      return totals;
    },
    {
      gross: 0,
      discount: 0,
      taxable: 0,
      gst: 0,
      cgst: 0,
      sgst: 0,
    },
  );
}

function OrderReceiptModal({
  order,
  onClose,
  onConfirm,
  confirming = false,
  feedback = null,
}: OrderReceiptModalProps) {
  if (!order) {
    return null;
  }

  const taxTotals = calculateTotals(order);
  const items = Object.entries(order.items);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
      <div className="dashboard-scrollbar max-h-full w-full max-w-6xl overflow-auto rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
                Order Summary
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-white">
                Procurement receipt preview
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Review the selected cycle-1 medicines, verify the tax breakdown, and confirm the
                order for persistence.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Order ID</p>
                <p className="mt-2 text-sm font-semibold text-white">{order.orderid}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Distributor</p>
                <p className="mt-2 text-sm font-semibold text-white">{order.distributorid}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pharmacy</p>
                <p className="mt-2 text-sm font-semibold text-white">{order.pharmaid}</p>
              </div>
              <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-400/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Date</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {formatDate('created_at' in order ? order.created_at : undefined)}
                </p>
              </div>
            </div>
          </div>

          {feedback ? (
            <div
              className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
                feedback.tone === 'success'
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-rose-400/30 bg-rose-500/10 text-rose-100'
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="dashboard-scrollbar overflow-auto rounded-[1.5rem] border border-white/10">
            <table className="min-w-[1320px] divide-y divide-white/10">
              <thead className="bg-slate-950/95 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-4 py-4">Medicine</th>
                  <th className="px-4 py-4">Price</th>
                  <th className="px-4 py-4">Qty</th>
                  <th className="px-4 py-4">Gross</th>
                  <th className="px-4 py-4">Discount</th>
                  <th className="px-4 py-4">Taxable</th>
                  <th className="px-4 py-4">GST</th>
                  <th className="px-4 py-4">CGST</th>
                  <th className="px-4 py-4">SGST</th>
                  <th className="px-4 py-4">MRP / Pack</th>
                  <th className="px-4 py-4">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-sm text-slate-200">
                {items.map(([itemIndex, item], rowIndex) => (
                  <tr
                    key={`${order.orderid}-${itemIndex}`}
                    className={rowIndex % 2 === 0 ? 'bg-white/[0.03]' : 'bg-transparent'}
                  >
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        HSN {item.hsnCode} | Dist ID {item.productID_Dtb} | Pharm ID{' '}
                        {item.productID_Phm}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Discount {item.discountPercent}% | GST {item.gstRate}%
                      </p>
                    </td>
                    <td className="px-4 py-4">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-4">{item.quantity}</td>
                    <td className="px-4 py-4">
                      {formatCurrency(item.taxBreakdown.gross)}
                    </td>
                    <td className="px-4 py-4">
                      {formatCurrency(item.taxBreakdown.discount)}
                    </td>
                    <td className="px-4 py-4">
                      {formatCurrency(item.taxBreakdown.taxable)}
                    </td>
                    <td className="px-4 py-4">{formatCurrency(item.taxBreakdown.gst)}</td>
                    <td className="px-4 py-4">{formatCurrency(item.taxBreakdown.cgst)}</td>
                    <td className="px-4 py-4">{formatCurrency(item.taxBreakdown.sgst)}</td>
                    <td className="px-4 py-4">{formatCurrency(item.mrpPerPack)}</td>
                    <td className="px-4 py-4 font-semibold text-brand-sand">
                      {formatCurrency(calculateItemTotal(item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Tax Breakdown
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Gross</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatCurrency(taxTotals.gross)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Discount</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatCurrency(taxTotals.discount)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Taxable</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatCurrency(taxTotals.taxable)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">GST</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatCurrency(taxTotals.gst)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">CGST</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatCurrency(taxTotals.cgst)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">SGST</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatCurrency(taxTotals.sgst)}
                  </p>
                </div>
              </div>
            </section>

            <aside className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                Final Amount
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {formatCurrency(order.totalAmount)}
              </p>
              <p className="mt-3 text-sm leading-6 text-cyan-50/90">
                Total amount is the sum of all line items after discount and GST.
              </p>
            </aside>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Close
            </button>
            {onConfirm ? (
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming}
                className="rounded-full bg-brand-sand px-5 py-3 text-sm font-semibold text-brand-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirming ? 'Confirming...' : 'Confirm Order'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderReceiptModal;
