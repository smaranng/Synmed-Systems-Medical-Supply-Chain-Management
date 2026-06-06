import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { X, Printer, Loader2, Building2 } from "lucide-react";
import { OfflineOrder } from "../services/offlineOrderService";
import { pharmacyService, PharmacyUser } from "../services/pharmacyService";

interface TaxBreakdown {
  gross?: number;
  discount?: number;
  taxable?: number;
  gst?: number;
  cgst?: number;
  sgst?: number;
  totalAmount?: number;
}

type BillOrderItem = OfflineOrder["items"][number] & {
  batchCode?: string | null;
  mrp?: number;
  discountPercent?: number;
  gstRate?: number;
  hsnCode?: string;
  taxBreakdown?: TaxBreakdown;
  pricePerUnit?: number;
};

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatPayment(raw?: string) {
  if (!raw) return "—";
  return raw.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolvePharmacyName(pharmacy: PharmacyUser | null) {
  return pharmacy?.name ?? "—";
}

function resolvePharmacyAddress(pharmacy: PharmacyUser | null) {
  if (!pharmacy?.address) return "—";
  if (typeof pharmacy.address === "string") return pharmacy.address;
  return [
    pharmacy.address.line1,
    pharmacy.address.line2,
    pharmacy.address.city,
    pharmacy.address.state,
    pharmacy.address.pincode ?? pharmacy.address.zip,
  ]
    .filter(Boolean)
    .join(", ");
}

function resolvePharmacyPhone(pharmacy: PharmacyUser | null) {
  return pharmacy?.phone ?? "—";
}

function resolvePharmacyLogoUrl(pharmacy: PharmacyUser | null) {
  const logo = (pharmacy as any)?.logo as string | undefined;
  if (!logo) return null;
  if (logo.startsWith("http://") || logo.startsWith("https://")) return logo;
  return `http://localhost:5203${logo}`;
}

function resolveItemTotal(item: BillOrderItem): number {
  const tb = item.taxBreakdown;
  if (tb?.totalAmount != null) return tb.totalAmount;
  const computed = (tb?.taxable ?? 0) + (tb?.gst ?? 0);
  if (computed > 0) return computed;
  return (item.price ?? 0) * (item.quantity ?? 0) + (item.pricePerUnit ?? 0) * (item.subQuantity ?? 0);
}

function formatQty(item: BillOrderItem) {
  const sub = item.subQuantity ?? 0;
  return {
    main: `${item.quantity ?? 0}`,
    sub: sub > 0 ? `${sub} sub-unit${sub !== 1 ? "s" : ""}` : null,
  };
}

function SynmedLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#0f4c81" />
      <path d="M8 16 L14 10 L20 16 L14 22 Z" fill="white" opacity="0.9" />
      <path d="M14 10 L20 10 L26 16 L20 22 L14 22 L20 16 Z" fill="white" opacity="0.5" />
      <rect x="13" y="13" width="6" height="6" rx="1" fill="white" />
    </svg>
  );
}

interface OfflineOrderBillModalProps {
  order: OfflineOrder;
  onClose: () => void;
}

export default function OfflineOrderBillModal({ order, onClose }: OfflineOrderBillModalProps) {
  const billRef = useRef<HTMLDivElement>(null);
  const [pharmacy, setPharmacy] = useState<PharmacyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const items = Array.isArray(order.items) ? (order.items as BillOrderItem[]) : [];
  const hasGST = items.some((item) => (item.gstRate ?? 0) > 0 || !!item.hsnCode);
  const hasPricePerUnit = items.some((item) => item.pricePerUnit != null);

  useEffect(() => {
    const loadBillData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const pharmacyId = order.pharmacyId || (order as any).pharmaID;
        const pharmacyData = pharmacyId ? await pharmacyService.getPharmacyById(pharmacyId) : null;
        setPharmacy(pharmacyData);
      } catch (err) {
        console.error("Failed to load offline order bill:", err);
        setFetchError("Could not load bill details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadBillData();
  }, [order]);

  const totalGross = items.reduce((sum, item) => sum + (item.taxBreakdown?.gross ?? ((item.mrp ?? item.price ?? 0) * (item.quantity ?? 0))), 0);
  const totalDiscount = items.reduce((sum, item) => sum + (item.taxBreakdown?.discount ?? 0), 0);
  const totalTaxable = items.reduce((sum, item) => sum + (item.taxBreakdown?.taxable ?? 0), 0);
  const totalCGST = items.reduce((sum, item) => sum + (item.taxBreakdown?.cgst ?? 0), 0);
  const totalSGST = items.reduce((sum, item) => sum + (item.taxBreakdown?.sgst ?? 0), 0);
  const totalGST = items.reduce((sum, item) => sum + (item.taxBreakdown?.gst ?? 0), 0);

  const handlePrint = () => {
    const printContent = billRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Offline Bill - ${order.orderNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'DM Sans', sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; }
          .bill-wrap { max-width: 740px; margin: 0 auto; padding: 32px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 10px; font-size: 10.5px; text-align: left; }
          th { background: #ecfdf5; font-weight: 600; color: #047857; border-bottom: 2px solid #a7f3d0; }
          .text-right { text-align: right !important; }
          .text-center { text-align: center !important; }
          .sub-unit-label { font-size: 9px; color: #94a3b8; display: block; margin-top: 2px; }
        </style>
      </head>
      <body><div class="bill-wrap">${printContent}</div></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bill Details</h2>
            <p className="text-xs text-gray-500">{order.orderNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !pharmacy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading bill details...
          </div>
        ) : fetchError ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-red-600 px-6 text-center">
            <Building2 className="w-10 h-10 mb-3 text-red-300" />
            <p className="font-semibold">{fetchError}</p>
            <p className="text-xs text-gray-500 mt-1">Pharmacy ID: {order.pharmacyId}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div ref={billRef} className="p-6">
              <div className="flex items-start justify-between gap-6 mb-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    {resolvePharmacyLogoUrl(pharmacy) ? (
                      <img
                        src={resolvePharmacyLogoUrl(pharmacy)!}
                        alt={resolvePharmacyName(pharmacy)}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">🏥</span>
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{resolvePharmacyName(pharmacy)}</h1>
                    <p className="text-sm text-gray-600 mt-1 max-w-xl">{resolvePharmacyAddress(pharmacy)}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span><span className="font-medium text-gray-600">Ph:</span> {resolvePharmacyPhone(pharmacy)}</span>
                      <span><span className="font-medium text-gray-600">License:</span> {(pharmacy as any)?.licenseNumber ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <SynmedLogo size={24} />
                    <div>
                      <p className="text-xs font-semibold text-emerald-800">Synmed Systems</p>
                      <p className="text-[10px] text-emerald-500">Powered by</p>
                    </div>
                  </div>
                  <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-left">
                    <p className="text-xs text-emerald-700 font-semibold">{order.orderNumber}</p>
                    <p className="text-[10px] text-emerald-500">Offline Order</p>
                  </div>
                </div>
              </div>

              <div className="text-center text-[11px] font-bold tracking-[3px] uppercase text-emerald-800 border-y-2 border-emerald-800 py-2 mb-6">
                Offline Purchase Bill
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Order Details</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Placed:</span> {formatDateTime(order.createdAt)}</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Payment:</span> {formatPayment(order.paymentMode)}</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Status:</span> {order.status}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Customer Details</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Name:</span> {order.customerName}</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Doctor:</span> {order.doctorName}</p>
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Mobile:</span> {order.mobileNumber}</p>
                  {order.email && <p className="text-sm text-slate-700"><span className="font-medium text-slate-500">Email:</span> {order.email}</p>}
                </div>
              </div>

              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Items</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-10 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Medicine</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">MRP</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Disc%</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                      {hasPricePerUnit && <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Price/Unit</th>}
                      {hasGST && <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">GST%</th>}
                      {hasGST && <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Taxable</th>}
                      {hasGST && <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">GST</th>}
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => {
                      const qty = formatQty(item);
                      const total = resolveItemTotal(item);
                      const isGST = (item.gstRate ?? 0) > 0 && !!item.hsnCode;
                      return (
                        <tr key={item.productID} className="hover:bg-slate-50/60">
                          <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-center text-sm text-slate-400 font-medium">{index + 1}</td>
                          <td style={{ verticalAlign: "middle" }} className="px-3 py-3">
                            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                            {item.prescriptionRequired && <span className="inline-flex mt-1 px-2 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-semibold border border-red-200">Rx</span>}
                          </td>
                          <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-right text-sm font-mono text-slate-700">₹{(item.mrp ?? item.price ?? 0).toFixed(2)}</td>
                          <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-right text-sm font-medium text-emerald-600">{item.discountPercent ?? 0}%</td>
                          <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-center text-sm font-semibold text-slate-700">
                            {qty.main}
                            {qty.sub && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{qty.sub}</span>}
                          </td>
                          {hasPricePerUnit && (
                            <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-right text-sm font-mono text-slate-700">{item.pricePerUnit != null ? `₹${item.pricePerUnit.toFixed(2)}` : "—"}</td>
                          )}
                          {hasGST && <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-right text-sm text-slate-700">{isGST ? `${item.gstRate ?? 0}%` : "—"}</td>}
                          {hasGST && <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-right text-sm font-mono text-slate-700">{isGST ? `₹${(item.taxBreakdown?.taxable ?? 0).toFixed(2)}` : "—"}</td>}
                          {hasGST && <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-right text-sm font-mono text-slate-700">{isGST ? `₹${(item.taxBreakdown?.gst ?? 0).toFixed(2)}` : "—"}</td>}
                          <td style={{ verticalAlign: "middle" }} className="px-3 py-3 text-right text-sm font-mono font-semibold text-slate-900">₹{total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {hasGST && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">GST Summary</p>
                    <div className="rounded-xl overflow-hidden border border-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">HSN</th>
                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Taxable</th>
                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">CGST</th>
                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">SGST</th>
                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total Tax</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.filter((item) => (item.gstRate ?? 0) > 0 && !!item.hsnCode).map((item) => (
                            <tr key={item.productID}>
                              <td className="px-3 py-3 text-sm font-mono text-slate-700">{item.hsnCode}</td>
                              <td className="px-3 py-3 text-right text-sm font-mono text-slate-700">₹{(item.taxBreakdown?.taxable ?? 0).toFixed(2)}</td>
                              <td className="px-3 py-3 text-right text-sm font-mono text-slate-700">₹{(item.taxBreakdown?.cgst ?? 0).toFixed(2)}</td>
                              <td className="px-3 py-3 text-right text-sm font-mono text-slate-700">₹{(item.taxBreakdown?.sgst ?? 0).toFixed(2)}</td>
                              <td className="px-3 py-3 text-right text-sm font-mono text-slate-700">₹{(item.taxBreakdown?.gst ?? 0).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-200 bg-slate-50">
                            <td className="px-3 py-3 text-sm font-semibold text-slate-700">Total</td>
                            <td className="px-3 py-3 text-right text-sm font-mono font-semibold text-slate-900">₹{totalTaxable.toFixed(2)}</td>
                            <td className="px-3 py-3 text-right text-sm font-mono font-semibold text-slate-900">₹{totalCGST.toFixed(2)}</td>
                            <td className="px-3 py-3 text-right text-sm font-mono font-semibold text-slate-900">₹{totalSGST.toFixed(2)}</td>
                            <td className="px-3 py-3 text-right text-sm font-mono font-semibold text-slate-900">₹{totalGST.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="lg:ml-auto lg:min-w-[280px]">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Summary</p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                      <span className="text-sm text-slate-500">Gross Amount</span>
                      <span className="text-sm font-mono font-medium text-slate-800">₹{totalGross.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                      <span className="text-sm text-slate-500">Discount</span>
                      <span className="text-sm font-mono font-medium text-emerald-600">− ₹{totalDiscount.toFixed(2)}</span>
                    </div>
                    {hasGST && (
                      <>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                          <span className="text-sm text-slate-500">Taxable Amount</span>
                          <span className="text-sm font-mono font-medium text-slate-800">₹{totalTaxable.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                          <span className="text-sm text-slate-500">Total GST</span>
                          <span className="text-sm font-mono font-medium text-slate-800">₹{totalGST.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-r from-emerald-700 to-teal-600 text-white">
                      <span className="text-sm font-bold uppercase tracking-wide">Net Payable</span>
                      <span className="text-base font-mono font-bold">₹{order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 mt-6 pt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    This is a computer-generated bill and does not require a signature.
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-2">
                    {resolvePharmacyName(pharmacy)}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <SynmedLogo size={20} />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Synmed Systems</p>
                    <p className="text-[10px] text-emerald-500">Pharmacy Management</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}