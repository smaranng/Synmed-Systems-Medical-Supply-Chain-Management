import { useRef, useState, useEffect } from 'react';
import { X, Printer, Loader2, Building2 } from 'lucide-react';
import { pharmacyService, PharmacyUser } from '../services/pharmacyService';
import { authService } from '../services/authService';
import { medicineService, MedicineSearchResult } from '../services/medicineService';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TaxBreakdown {
  gross: number;
  discount: number;
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
}

interface OrderItem {
  productID: string;
  name: string;
  batchCode?: string | null;   // ✅ populated by backend at order creation
  price: number;
  quantity: number;
  subQuantity?: number;
  prescriptionRequired: boolean;
  discountPercent: number;
  gstRate: number;
  hsnCode: string;
  mrp: number;
  taxBreakdown: TaxBreakdown;
  pricePerUnit?: number;
}

interface UserInfo {
  name?: string;
  email?: string;
  phone?: string;
}

interface Order {
  orderNumber: string;
  customerId: string;
  pharmaID: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  paymentMode: string;
  updatedAt: string;
  placedAt: string;
  approvedAt?: string;
  expiresAt?: string;
}

interface ViewBillModalProps {
  order: Order;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString?: string | null) {
  if (!dateString || dateString === '—') return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return (
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * FIX #1: paymentMode from backend is e.g. "PAY_AT_PHARMACY", "CASH", "UPI".
 * Previous code split on ' - ' which never exists → modeRaw was undefined → crash.
 */
function formatPayment(raw?: string) {
  if (!raw) return '—';
  // Normalise underscore-separated values like PAY_AT_PHARMACY → Pay At Pharmacy
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * FIX #6: Read item.batchCode first (set by backend at order creation),
 * then fall back to med.batchCode, then '—'.
 */
function resolveBatchCode(item: OrderItem, med?: MedicineSearchResult): string {
  return item.batchCode ?? med?.batchCode ?? '—';
}

/**
 * FIX #5: Only access fields that actually exist on MedicineSearchResult.
 */
function resolveExpiryDate(med?: MedicineSearchResult): string {
  return med?.expiryDate ?? '—';
}

function resolveMfgDate(med?: MedicineSearchResult): string {
  return med?.manufacturedDate ?? '—';
}

function resolveManufacturer(med?: MedicineSearchResult): string | null {
  return med?.manufacturer ?? null;
}

/**
 * FIX — pharmacy field mapping:
 * PharmacyUser uses contactNumber/mobile for phone, address as object or string,
 * and may have licenseNumber / gstIN at top level.
 */
function resolvePharmacyAddress(pharmacy: PharmacyUser): string {
  const addr = pharmacy.address;
  if (!addr) return '—';
  if (typeof addr === 'string') return addr;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode ?? addr.zip]
    .filter(Boolean)
    .join(', ');
}

function resolvePharmacyPhone(pharmacy: PharmacyUser): string {
  return pharmacy.contactNumber ?? pharmacy.mobile ?? pharmacy.phone ?? '—';
}

function resolvePharmacyName(pharmacy: PharmacyUser): string {
  return pharmacy.storeName ?? pharmacy.name ?? pharmacy.title ?? '—';
}

// ─── Helper: does an item have GST to display ─────────────────────────────────

function itemHasGST(item: OrderItem) {
  return item.gstRate > 0 && !!item.hsnCode;
}

// ─── Helper: resolve display total for an item ────────────────────────────────

function resolveItemTotal(item: OrderItem): number {
  const tb = item.taxBreakdown;
  if (tb?.totalAmount > 0) return tb.totalAmount;
  const computed = (tb?.taxable ?? 0) + (tb?.gst ?? 0);
  if (computed > 0) return computed;
  const gross    = tb?.gross ?? item.mrp * item.quantity;
  const discount = tb?.discount ?? 0;
  const net      = gross - discount;
  if (net > 0) return net;
  return item.price * item.quantity;
}

// ─── Helper: quantity display ─────────────────────────────────────────────────

function formatQty(item: OrderItem): { main: string; sub: string | null } {
  const sub = item.subQuantity ?? 0;
  return {
    main: String(item.quantity),
    sub: sub > 0 ? `${sub} sub-unit${sub > 1 ? 's' : ''}` : null,
  };
}

// ─── Synmed Logo SVG ──────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ViewBillModal({ order, onClose }: ViewBillModalProps) {
  const billRef = useRef<HTMLDivElement>(null);

  const [pharmacy, setPharmacy] = useState<PharmacyUser | null>(null);
  const [user, setUser]         = useState<UserInfo | null>(null);
  const [medMap, setMedMap]     = useState<Record<string, MedicineSearchResult>>({});
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // FIX #2: correct dependency array — pharmaID + item productIDs drive all fetches.
  // Serialise items to a stable string so the effect only re-runs when items actually change.
  const itemKey = order.items.map((i) => i.productID).join(',');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        // FIX #4: getCurrentUser may not exist on authService — guard it safely.
        const [pharmacyData, userData] = await Promise.all([
          pharmacyService.getPharmacyById(order.pharmaID),
          typeof (authService as any).getCurrentUser === 'function'
            ? (authService as any).getCurrentUser().catch(() => null)
            : Promise.resolve(null),
        ]);

        setPharmacy(pharmacyData);
        setUser(userData);

        // FIX #5: fetch only valid fields from MedicineSearchResult
        const results = await Promise.allSettled(
          order.items.map((item) =>
            medicineService.getMedicineDetails(item.productID, order.pharmaID)
          )
        );

        const map: Record<string, MedicineSearchResult> = {};
        results.forEach((result, idx) => {
          const productID = order.items[idx].productID;
          if (result.status === 'fulfilled') {
            map[productID] = result.value;
          } else {
            console.warn(`Medicine fetch failed for ${productID}:`, result.reason);
          }
        });
        setMedMap(map);
      } catch (err) {
        console.error('Failed to load bill data:', err);
        setFetchError('Could not load bill details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.pharmaID, itemKey]);

  // Totals
  const totalGross    = order.items.reduce((s, i) => s + (i.taxBreakdown?.gross    ?? i.mrp * i.quantity), 0);
  const totalDiscount = order.items.reduce((s, i) => s + (i.taxBreakdown?.discount ?? 0), 0);
  const totalTaxable  = order.items.reduce((s, i) => s + (i.taxBreakdown?.taxable  ?? 0), 0);
  const totalCGST     = order.items.reduce((s, i) => s + (i.taxBreakdown?.cgst     ?? 0), 0);
  const totalSGST     = order.items.reduce((s, i) => s + (i.taxBreakdown?.sgst     ?? 0), 0);
  const totalGST      = order.items.reduce((s, i) => s + (i.taxBreakdown?.gst      ?? 0), 0);

  const hasGST        = order.items.some(itemHasGST);
  const hasPricePerUnit = order.items.some((i) => i.pricePerUnit != null);

  // FIX #3: derive display fields via resolver helpers — no more undefined renders
  const pharmacyName    = pharmacy ? resolvePharmacyName(pharmacy)    : '—';
  const pharmacyAddress = pharmacy ? resolvePharmacyAddress(pharmacy) : '—';
  const pharmacyPhone   = pharmacy ? resolvePharmacyPhone(pharmacy)   : '—';
  const pharmacyLicense = pharmacy ? (pharmacy as any).licenseNumber  ?? '—' : '—';
  const pharmacyGSTIN   = pharmacy ? (pharmacy as any).gstIN          ?? ''  : '';

  const handlePrint = () => {
    const printContent = billRef.current?.innerHTML;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head>
        <title>Invoice - ${order.orderNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:'DM Sans',sans-serif; font-size:11px; color:#1a1a2e; background:#fff; }
          .bill-wrap { max-width:740px; margin:0 auto; padding:32px; }
          table { width:100%; border-collapse:collapse; }
          th,td { padding:8px 10px; text-align:left; font-size:10.5px; }
          th { background:#f0f6ff; font-weight:600; color:#0f4c81; border-bottom:2px solid #dbeafe; }
          .text-right { text-align:right; }
          .text-center { text-align:center; }
          .sub-unit-label { font-size:9px; color:#94a3b8; display:block; margin-top:2px; }
        </style>
      </head><body><div class="bill-wrap">${printContent}</div></body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

        .vbm-modal * { font-family: 'DM Sans', system-ui, sans-serif; }
        .vbm-mono { font-family: 'DM Mono', monospace !important; }

        .vbm-table th {
          background: #f0f6ff; color: #0f4c81; font-weight: 600;
          font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px;
          padding: 9px 8px; border-bottom: 2px solid #dbeafe; white-space: nowrap;
        }
        .vbm-table td {
          padding: 10px 8px; font-size: 11px; border-bottom: 1px solid #f1f5f9;
          color: #334155; vertical-align: middle; white-space: nowrap;
        }
        .vbm-table tr:last-child td { border-bottom: none; }
        .vbm-table tbody tr:hover td { background: #fafcff; }

        .vbm-gst-table th {
          background: #f8fafc; color: #475569; font-weight: 600;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
          padding: 8px 12px; border-bottom: 1px solid #e2e8f0;
        }
        .vbm-gst-table td {
          padding: 8px 12px; font-size: 11px;
          border-bottom: 1px solid #f1f5f9; color: #475569;
        }
        .vbm-gst-table tr:last-child td {
          background: #f8fafc; font-weight: 700; color: #1e293b;
          border-top: 1px solid #e2e8f0; border-bottom: none;
        }

        .vbm-badge-rx {
          display: inline-block; margin-left: 5px; padding: 1px 5px;
          font-size: 9px; font-weight: 700; color: #dc2626;
          background: #fef2f2; border: 1px solid #fca5a5;
          border-radius: 4px; vertical-align: middle; line-height: 14px;
        }

        .vbm-section-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 1px; color: #94a3b8; margin-bottom: 10px;
        }

        .vbm-meta-card {
          background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 12px; padding: 16px 20px;
        }
        .vbm-meta-card p {
          font-size: 12px; color: #475569; margin-bottom: 5px;
          display: flex; gap: 6px;
        }
        .vbm-meta-card p:last-child { margin-bottom: 0; }
        .vbm-meta-card span.label {
          color: #94a3b8; font-size: 11px; min-width: 64px; flex-shrink: 0;
        }
        .vbm-meta-card span.value { color: #1e293b; font-weight: 500; }

        .vbm-sub-unit {
          display: block; font-size: 9.5px; color: #94a3b8;
          margin-top: 2px; font-weight: 400; white-space: nowrap;
        }
      `}</style>

      <div
        className="vbm-modal fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}
      >
        <div style={{
          background: '#fff', borderRadius: 20,
          boxShadow: '0 24px 80px rgba(15,23,42,0.22)',
          width: '96vw', maxWidth: 860, maxHeight: '92vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* ── Modal Toolbar ─────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#fff',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
              <button
                onClick={handlePrint}
                disabled={loading || !pharmacy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  border: '1px solid #e2e8f0', background: '#f8fafc',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#334155',
                  opacity: loading || !pharmacy ? 0.4 : 1,
                }}
              >
                <Printer size={14} /> Print
              </button>
              <button
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 10,
                  border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer',
                }}
              >
                <X size={16} color="red" />
              </button>
            </div>
          </div>

          {/* ── Loading ───────────────────────────────────────────────────── */}
          {loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 0' }}>
              <Loader2 size={28} color="#0f4c81" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading invoice details…</p>
            </div>
          )}

          {/* ── Hard Error ────────────────────────────────────────────────── */}
          {!loading && fetchError && !pharmacy && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 }}>
              <Building2 size={36} color="#fca5a5" />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>{fetchError}</p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>Pharmacy ID: {order.pharmaID}</p>
            </div>
          )}

          {/* ── Bill Content ──────────────────────────────────────────────── */}
          {!loading && pharmacy && (
            <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1 }}>
              <div ref={billRef} style={{ padding: '24px 28px', minWidth: 0 }}>

                {/* ── Header ─────────────────────────────────────────────── */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  marginBottom: 28, gap: 20,
                }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1 }}>
                    {(pharmacy as any).logo ? (
                      <img
                        src={`http://localhost:5203${(pharmacy as any).logo}`}
                        alt={pharmacyName}
                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 28 }}>🏥</span>
                    )}
                    <div>
                      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px', margin: 0 }}>
                        {pharmacyName}
                      </h1>
                      <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.6, maxWidth: 340 }}>
                        {pharmacyAddress}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 }}>
                        {[
                          { label: 'Ph',      value: pharmacyPhone   },
                          { label: 'License', value: pharmacyLicense },
                          ...(pharmacyGSTIN ? [{ label: 'GSTIN', value: pharmacyGSTIN }] : []),
                        ].map(({ label, value }) => (
                          <span key={label} style={{ fontSize: 11, color: '#94a3b8' }}>
                            <span style={{ color: '#64748b', fontWeight: 500 }}>{label}:</span>{' '}
                            <span className="vbm-mono" style={{ color: '#334155', fontSize: 11 }}>{value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px', borderRadius: 12,
                      background: '#f0f6ff', border: '1px solid #dbeafe',
                    }}>
                      <SynmedLogo size={26} />
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#0f4c81', lineHeight: 1.1 }}>Synmed Systems</p>
                        <p style={{ fontSize: 9.5, color: '#93c5fd', marginTop: 1 }}>Powered by</p>
                      </div>
                    </div>
                    <div style={{
                      textAlign: 'right', background: '#fff7ed',
                      border: '1px solid #fed7aa', borderRadius: 8, padding: '4px 12px',
                    }}>
                      <p className="vbm-mono" style={{ fontSize: 12, fontWeight: 700, color: '#c2410c' }}>
                        {order.orderNumber}
                      </p>
                      <p style={{ fontSize: 10, color: '#fb923c', marginTop: 1 }}>Order Number</p>
                    </div>
                  </div>
                </div>

                {/* ── Title Bar ──────────────────────────────────────────── */}
                <div style={{
                  textAlign: 'center', fontSize: 11, fontWeight: 700,
                  letterSpacing: '3px', textTransform: 'uppercase',
                  color: '#0f4c81', borderTop: '2px solid #0f4c81',
                  borderBottom: '2px solid #0f4c81',
                  padding: '7px 0', marginBottom: 24,
                }}>
                  Tax Invoice / Bill of Supply
                </div>

                {/* ── Bill Meta ──────────────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                  <div className="vbm-meta-card">
                    <p className="vbm-section-label" style={{ marginBottom: 10 }}>Bill Details</p>
                    <p><span className="label">Date</span><span className="value">{formatDateTime(order.placedAt)}</span></p>
                    <p>
                      <span className="label">Payment</span>
                      {/* FIX #1: formatPayment now handles underscore-separated values correctly */}
                      <span className="value">{formatPayment(order.paymentMode)} (Paid at Pharmacy)</span>
                    </p>
                    <p>
                      <span className="label">Status</span>
                      <span style={{
                        marginLeft: -6, padding: '2px 10px', borderRadius: 20,
                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                        color: '#16a34a', fontSize: 11, fontWeight: 600,
                      }}>✓ COMPLETED</span>
                    </p>
                  </div>
                  <div className="vbm-meta-card">
                    <p className="vbm-section-label" style={{ marginBottom: 10 }}>Customer Details</p>
                    {user?.name  && <p><span className="label">Name</span><span className="value">{user.name}</span></p>}
                    {user?.phone && <p><span className="label">Phone</span><span className="value">{user.phone}</span></p>}
                    {user?.email && <p><span className="label">Email</span><span className="value">{user.email}</span></p>}
                    {!user       && <p><span className="label">Customer</span><span className="value vbm-mono" style={{ fontSize: 10.5 }}>{order.customerId}</span></p>}
                  </div>
                </div>

                {/* ── Items Table ────────────────────────────────────────── */}
                <p className="vbm-section-label">Items</p>
                <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 28, overflowX: 'auto' }}>
                  <table className="vbm-table" style={{ width: '100%', minWidth: hasGST ? 820 : 600, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 28 }}>#</th>
                        <th>Medicine</th>
                        <th>Batch</th>
                        <th>Mfg Date</th>
                        <th>Expiry</th>
                        <th style={{ textAlign: 'right' }}>MRP</th>
                        <th style={{ textAlign: 'right' }}>Disc%</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        {hasPricePerUnit && <th style={{ textAlign: 'right' }}>Price/Unit</th>}
                        {hasGST && <th style={{ textAlign: 'right' }}>GST%</th>}
                        {hasGST && <th style={{ textAlign: 'right' }}>Taxable</th>}
                        {hasGST && <th style={{ textAlign: 'right' }}>GST</th>}
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) => {
                        const med          = medMap[item.productID];
                        // FIX #6: item.batchCode first, then med fallback
                        const batchCode    = resolveBatchCode(item, med);
                        // FIX #5: only use fields that exist on MedicineSearchResult
                        const expiryDate   = resolveExpiryDate(med);
                        const mfgDate      = resolveMfgDate(med);
                        const manufacturer = resolveManufacturer(med);
                        const showItemGST  = itemHasGST(item);
                        const qty          = formatQty(item);
                        const displayTotal = resolveItemTotal(item);

                        return (
                          <tr key={item.productID}>
                            <td style={{ color: '#94a3b8', fontWeight: 500 }}>{idx + 1}</td>
                            <td>
                              <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                                {item.name}
                                {item.prescriptionRequired && (
                                  <span className="vbm-badge-rx">Rx</span>
                                )}
                              </p>
                              {manufacturer && (
                                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{manufacturer}</p>
                              )}
                            </td>
                            <td>
                              <span className="vbm-mono" style={{ fontSize: 11, color: '#334155' }}>{batchCode}</span>
                            </td>
                            <td style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(mfgDate)}</td>
                            <td style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(expiryDate)}</td>
                            <td style={{ textAlign: 'right' }} className="vbm-mono">₹{item.mrp.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', color: '#ea580c', fontWeight: 500 }}>{item.discountPercent}%</td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a', verticalAlign: 'middle' }}>
                              {qty.main}
                              {qty.sub && <span className="vbm-sub-unit">{qty.sub}</span>}
                            </td>
                            {hasPricePerUnit && (
                              <td style={{ textAlign: 'right', color: '#0f4c81', fontWeight: 500 }} className="vbm-mono">
                                {item.pricePerUnit != null ? `₹${item.pricePerUnit.toFixed(2)}` : '—'}
                              </td>
                            )}
                            {hasGST && (
                              <td style={{ textAlign: 'right', color: '#64748b' }}>
                                {showItemGST ? `${item.gstRate}%` : '—'}
                              </td>
                            )}
                            {hasGST && (
                              <td style={{ textAlign: 'right' }} className="vbm-mono">
                                {showItemGST ? `₹${(item.taxBreakdown?.taxable ?? 0).toFixed(2)}` : '—'}
                              </td>
                            )}
                            {hasGST && (
                              <td style={{ textAlign: 'right' }} className="vbm-mono">
                                {showItemGST ? `₹${(item.taxBreakdown?.gst ?? 0).toFixed(2)}` : '—'}
                              </td>
                            )}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }} className="vbm-mono">
                              ₹{displayTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Summary + GST ──────────────────────────────────────── */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: hasGST ? '1fr auto' : 'auto',
                  justifyContent: hasGST ? 'unset' : 'flex-end',
                  gap: 24, alignItems: 'start', marginBottom: 32,
                }}>
                  {hasGST && (
                    <div>
                      <p className="vbm-section-label">GST Summary</p>
                      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <table className="vbm-gst-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th>HSN</th>
                              <th style={{ textAlign: 'right' }}>Taxable</th>
                              <th style={{ textAlign: 'right' }}>CGST %</th>
                              <th style={{ textAlign: 'right' }}>CGST Amt</th>
                              <th style={{ textAlign: 'right' }}>SGST %</th>
                              <th style={{ textAlign: 'right' }}>SGST Amt</th>
                              <th style={{ textAlign: 'right' }}>Total Tax</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.filter(itemHasGST).map((item) => (
                              <tr key={item.productID}>
                                <td className="vbm-mono">{item.hsnCode}</td>
                                <td style={{ textAlign: 'right' }} className="vbm-mono">₹{(item.taxBreakdown?.taxable ?? 0).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>{item.gstRate / 2}%</td>
                                <td style={{ textAlign: 'right' }} className="vbm-mono">₹{(item.taxBreakdown?.cgst ?? 0).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>{item.gstRate / 2}%</td>
                                <td style={{ textAlign: 'right' }} className="vbm-mono">₹{(item.taxBreakdown?.sgst ?? 0).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }} className="vbm-mono">₹{(item.taxBreakdown?.gst ?? 0).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td>Total</td>
                              <td style={{ textAlign: 'right' }} className="vbm-mono">₹{totalTaxable.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>—</td>
                              <td style={{ textAlign: 'right' }} className="vbm-mono">₹{totalCGST.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>—</td>
                              <td style={{ textAlign: 'right' }} className="vbm-mono">₹{totalSGST.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }} className="vbm-mono">₹{totalGST.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={{ minWidth: 220 }}>
                    <p className="vbm-section-label">Summary</p>
                    <div style={{
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                      borderRadius: 12, overflow: 'hidden',
                    }}>
                      {[
                        { label: 'Gross Amount',  value: `₹${totalGross.toFixed(2)}`,      color: '#334155', show: true },
                        { label: 'Discount',       value: `- ₹${totalDiscount.toFixed(2)}`, color: '#ea580c', show: true },
                        { label: 'Taxable Amount', value: `₹${totalTaxable.toFixed(2)}`,    color: '#334155', show: hasGST },
                        { label: 'Total GST',      value: `₹${totalGST.toFixed(2)}`,        color: '#64748b', show: hasGST },
                        { label: 'CGST',           value: `₹${totalCGST.toFixed(2)}`,       color: '#64748b', show: hasGST },
                        { label: 'SGST',           value: `₹${totalSGST.toFixed(2)}`,       color: '#64748b', show: hasGST },
                      ].filter((row) => row.show).map(({ label, value, color }) => (
                        <div key={label} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '9px 16px', borderBottom: '1px solid #f1f5f9',
                        }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
                          <span className="vbm-mono" style={{ fontSize: 12, fontWeight: 500, color }}>{value}</span>
                        </div>
                      ))}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, #0f4c81 0%, #1a73c5 100%)',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>NET PAYABLE</span>
                        <span className="vbm-mono" style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                          ₹{order.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div style={{
                  borderTop: '1px dashed #cbd5e1', paddingTop: 20,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16,
                }}>
                  <div>
                    <p style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.8 }}>
                      This is a computer-generated invoice and does not require a physical signature.<br />
                      Goods once sold will not be taken back or exchanged. Thank you for your purchase!
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginTop: 6 }}>
                      {pharmacyName}{pharmacyGSTIN ? ` • GSTIN: ${pharmacyGSTIN}` : ''}
                    </p>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                    padding: '8px 14px', borderRadius: 10,
                    background: '#f0f6ff', border: '1px solid #dbeafe',
                  }}>
                    <SynmedLogo size={20} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#0f4c81' }}>Synmed Systems</p>
                      <p style={{ fontSize: 9.5, color: '#93c5fd' }}>Pharmacy Management</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}