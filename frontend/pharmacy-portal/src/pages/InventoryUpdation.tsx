import React, { useEffect, useState, useCallback, useRef } from 'react';
import { inventoryService, Medicine } from '../services/inventoryService';
import {
  fetchOrdersByPharma,
  getPharmaIDFromToken,
  TrackedOrder,
  OrderItem,
  resolveAmount,
} from '../services/ordertrackingService';
import { getToken } from '../services/authService';

// ─── Types ────────────────────────────────────────────────────────────────────

// Extend TrackedOrder locally to include the new flag
interface TrackedOrderExtended extends TrackedOrder {
  updatedInventoryBack?: boolean;
}

interface DeliveredItem {
  order: TrackedOrderExtended;
  item: OrderItem;
  medicine: Medicine | null;
  loading: boolean;
  error: string | null;
}

interface FieldChange {
  path: string[];
  oldValue: unknown;
  newValue: unknown;
}

const ORDER_API_URL = 'http://localhost:5205';

// ─── Mark order inventory updated ────────────────────────────────────────────

async function markInventoryUpdated(orderId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
 const res = await fetch(
  `${ORDER_API_URL}/distributor-orders/${orderId}/mark-inventory-updated`,
  { method: 'PUT', headers }
);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string[]): unknown {
  return path.reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setNestedValue<T extends object>(obj: T, path: string[], value: unknown): T {
  const clone = { ...obj } as Record<string, unknown>;
  if (path.length === 1) {
    clone[path[0]] = value;
    return clone as T;
  }
  clone[path[0]] = setNestedValue(
    (clone[path[0]] as object) ?? {},
    path.slice(1),
    value
  );
  return clone as T;
}

function detectChanges(original: Medicine, current: Medicine): FieldChange[] {
  const changes: FieldChange[] = [];
  const paths: string[][] = [
    ['medicineName'], ['composition'], ['description'], ['manufacturer'],
    ['storageCondition'], ['prescriptionRequired'], ['manufacturedDate'],
    ['expiryDate'], ['warranty'], ['batchCode'],
    ['category', 'primaryCategory'], ['category', 'therapeuticClass'], ['category', 'dosageForm'],
    ['packaging', 'quantityDescription'], ['packaging', 'mrp'], ['packaging', 'discountPercent'],
    ['packaging', 'price'], ['packaging', 'pricePerUnit'], ['packaging', 'gstRate'], ['packaging', 'hsnCode'],
    ['stock', 'unitsAvailable'], ['stock', 'threshold'], ['stock', 'allowSubQuantity'],
    ['stock', 'baseQuantity'], ['stock', 'totalSubUnits'],
  ];
  for (const path of paths) {
    const oldVal = getNestedValue(original, path);
    const newVal = getNestedValue(current, path);
    if (String(oldVal) !== String(newVal)) {
      changes.push({ path, oldValue: oldVal, newValue: newVal });
    }
  }
  return changes;
}

function buildUpdatePayload(changes: FieldChange[]): Partial<Medicine> {
  let payload: Partial<Medicine> = {};
  for (const change of changes) {
    payload = setNestedValue(payload, change.path, change.newValue);
  }
  return payload;
}

// ─── Success Popup ────────────────────────────────────────────────────────────

interface SuccessPopupProps {
  medicineName: string;
  changeCount: number;
  onClose: () => void;
}

const SuccessPopup: React.FC<SuccessPopupProps> = ({ medicineName, changeCount, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    />
    {/* Card */}
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-4 animate-[fadeUp_0.25s_ease-out]">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes popIn {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Animated checkmark circle */}
      <div
        className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center"
        style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
      >
        <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Inventory Updated!</h2>
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{medicineName}</span> has been updated
          with <span className="font-semibold text-emerald-600">{changeCount} change{changeCount > 1 ? 's' : ''}</span>.
        </p>
        <p className="text-xs text-gray-400 mt-1">This order is now marked as reconciled.</p>
      </div>

      <button
        onClick={onClose}
        className="w-full mt-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors duration-150"
      >
        Done
      </button>
    </div>
  </div>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: unknown;
  onChange: (val: unknown) => void;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  highlight?: boolean;
  readOnly?: boolean;
}

const EditField: React.FC<FieldProps> = ({
  label, value, onChange, type = 'text', options, highlight, readOnly,
}) => {
  const baseInput =
    'w-full bg-white border rounded-md px-3 py-2 text-gray-800 text-sm ' +
    'focus:outline-none focus:ring-2 transition-all duration-150 ' +
    (highlight
      ? 'border-emerald-400 ring-1 ring-emerald-100 bg-emerald-50 focus:ring-emerald-200 focus:border-emerald-500'
      : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100') +
    (readOnly ? ' opacity-50 cursor-not-allowed bg-gray-50' : '');

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold flex items-center gap-1.5">
        {label}
        {highlight && (
          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] tracking-wider border border-emerald-200">
            UPDATED
          </span>
        )}
      </label>

      {type === 'boolean' ? (
        <button
          type="button"
          onClick={() => !readOnly && onChange(!value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all duration-150 w-fit ${
            value
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-white border-gray-200 text-gray-400'
          } ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'}`}
        >
          <span className={`w-3 h-3 rounded-full ${value ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          {String(value ?? 'false')}
        </button>
      ) : type === 'select' && options ? (
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          disabled={readOnly}
          className={baseInput + ' cursor-pointer'}
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
          value={type === 'date' && value ? String(value).split('T')[0] : String(value ?? '')}
          readOnly={readOnly}
          onChange={e => {
            const v = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
            onChange(v);
          }}
          className={baseInput}
        />
      )}
    </div>
  );
};

interface SectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}
const Section: React.FC<SectionProps> = ({ title, icon, children }) => (
  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
    <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gray-50 border-b border-gray-200">
      <span className="text-base">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">{title}</h3>
    </div>
    <div className="p-5 bg-white grid grid-cols-2 md:grid-cols-3 gap-4">{children}</div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const DeliveredOrderInventoryUpdate: React.FC = () => {
  const pharmaID = getPharmaIDFromToken();

  const [deliveredItems, setDeliveredItems] = useState<DeliveredItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editedMedicine, setEditedMedicine] = useState<Medicine | null>(null);
  const originalRef = useRef<Medicine | null>(null);
  const [changes, setChanges] = useState<FieldChange[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Success popup state
  const [popup, setPopup] = useState<{
    medicineName: string;
    changeCount: number;
  } | null>(null);

  // ── Load orders — only DELIVERED and updatedInventoryBack !== true ─────────
  useEffect(() => {
    if (!pharmaID) {
      setPageError('Unable to read pharmacy ID from session. Please log in again.');
      setPageLoading(false);
      return;
    }
    (async () => {
      try {
        const orders = (await fetchOrdersByPharma(pharmaID)) as TrackedOrderExtended[];

        // ✅ DELIVERED only, and inventory not yet reconciled
        const delivered = orders.filter(
          o => o.status === 'DELIVERED' && o.updatedInventoryBack !== true
        );

        if (delivered.length === 0) {
          setPageError('No pending delivered orders require inventory update.');
          setPageLoading(false);
          return;
        }

        const items: DeliveredItem[] = delivered.flatMap(order =>
          order.items.map(item => ({
            order,
            item,
            medicine: null,
            loading: true,
            error: null,
          }))
        );
        setDeliveredItems(items);
        setPageLoading(false);

        for (let i = 0; i < items.length; i++) {
          const { item, order } = items[i];
          try {
            const med = await inventoryService.getMedicineDetails(
              item.productID_Phm,
              order.pharmaID
            );
            setDeliveredItems(prev => {
              const updated = [...prev];
              updated[i] = { ...updated[i], medicine: med, loading: false };
              return updated;
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load medicine';
            setDeliveredItems(prev => {
              const updated = [...prev];
              updated[i] = { ...updated[i], loading: false, error: msg };
              return updated;
            });
          }
        }
      } catch (err: unknown) {
        setPageError(err instanceof Error ? err.message : 'Failed to fetch orders');
        setPageLoading(false);
      }
    })();
  }, [pharmaID]);

  // ── Set up editable medicine when selection changes ───────────────────────
  useEffect(() => {
    const current = deliveredItems[selectedIdx];
    if (!current?.medicine) return;

    const med = current.medicine;
    const merged: Medicine = {
      ...med,
      stock: {
        ...med.stock,
        unitsAvailable: (med.stock?.unitsAvailable ?? 0) + current.item.quantity,
      },
    };

    originalRef.current = med;
    setEditedMedicine(merged);
    setChanges([]);
  }, [deliveredItems, selectedIdx]);

  // ── Detect changes ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!originalRef.current || !editedMedicine) return;
    setChanges(detectChanges(originalRef.current, editedMedicine));
  }, [editedMedicine]);

  // ── Field updater ─────────────────────────────────────────────────────────
  const updateField = useCallback((path: string[], value: unknown) => {
    setEditedMedicine(prev => prev ? setNestedValue(prev, path, value) : prev);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const current = deliveredItems[selectedIdx];
    if (!current?.medicine || !editedMedicine || !pharmaID) return;
    if (changes.length === 0) return;

    setSaving(true);
    try {
      // 1. Update inventory fields
      const payload = buildUpdatePayload(changes);
      await inventoryService.updateMedicine(
        current.order.pharmaID,
        current.item.productID_Phm,
        payload
      );

      // 2. Mark order as inventory-reconciled in DB
      await markInventoryUpdated(current.order._id);

      // 3. Remove this item from the list (it's now reconciled)
      setDeliveredItems(prev => {
        const updated = prev.filter((_, i) => i !== selectedIdx);
        return updated;
      });

      // Reset selection if needed
      setSelectedIdx(prev => Math.max(0, prev >= deliveredItems.length - 1 ? prev - 1 : prev));
      setEditedMedicine(null);
      originalRef.current = null;
      setChanges([]);

      // 4. Show success popup
      setPopup({
        medicineName: current.item.name,
        changeCount: changes.length,
      });
    } catch (err: unknown) {
      // Inline error — no banner, use console + a light toast approach
      console.error('Save failed:', err);
      alert(err instanceof Error ? err.message : 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Close popup ────────────────────────────────────────────────────────────
  const handleClosePopup = () => {
    setPopup(null);
    // If no more items, show the "all done" empty state
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm tracking-wide">Fetching delivered orders…</p>
        </div>
      </div>
    );
  }

  // ─── Error / empty ─────────────────────────────────────────────────────────
  if (pageError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl">
            ✅
          </div>
          <div>
            <p className="text-gray-800 font-semibold text-base mb-1">All Updated</p>
            <p className="text-gray-400 text-sm">{pageError}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── All items reconciled after saves ─────────────────────────────────────
  if (deliveredItems.length === 0 && !popup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl">
            🎉
          </div>
          <div>
            <p className="text-gray-800 font-semibold text-base mb-1">All Orders Reconciled</p>
            <p className="text-gray-400 text-sm">
              Every delivered order has been updated in inventory.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selected = deliveredItems[selectedIdx];
  const med = editedMedicine;

  return (
    <>
      {/* ── Success Popup ── */}
      {popup && (
        <SuccessPopup
          medicineName={popup.medicineName}
          changeCount={popup.changeCount}
          onClose={handleClosePopup}
        />
      )}

      <div className="min-h-screen bg-gray-50 text-gray-800">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: #f9fafb; }
          ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
          input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        `}</style>

        {/* ── Header ── */}
        <header className="static top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-base">
                📦
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight"
                  style={{ fontFamily: "'Syne', sans-serif" }}>
                  Inventory Reconciliation
                </h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                  Delivered Order · Stock Update
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Pending orders badge */}
              {deliveredItems.length > 0 && (
                <span className="text-[11px] px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-600 rounded-full font-medium">
                  {deliveredItems.length} order{deliveredItems.length > 1 ? 's' : ''} pending
                </span>
              )}
              {changes.length > 0 && (
                <span className="text-[11px] px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full font-medium">
                  {changes.length} change{changes.length > 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || changes.length === 0 || !med}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  saving || changes.length === 0 || !med
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-100 hover:-translate-y-px'
                }`}
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <><span>✓</span> Update Inventory</>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-5">

          {/* ── Order tabs ── */}
          {deliveredItems.length > 1 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                Pending Delivered Orders
              </p>
              <div className="flex flex-wrap gap-2">
                {deliveredItems.map((di, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedIdx(idx)}
                    className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-150 ${
                      idx === selectedIdx
                        ? 'bg-blue-50 border-blue-400 text-blue-600 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {di.order.orderNumber} · {di.item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Order summary card ── */}
          {selected && (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Order No.',     value: selected.order.orderNumber,                    color: 'text-gray-800' },
                  { label: 'Status',        value: selected.order.status,                         color: 'text-emerald-600' },
                  { label: 'Product (PHM)', value: selected.item.productID_Phm,                   color: 'text-blue-600' },
                  { label: 'Product (DTB)', value: selected.item.productID_Dtb,                   color: 'text-gray-500' },
                  { label: 'Qty Received',  value: `+${selected.item.quantity} units`,            color: 'text-emerald-600' },
                  { label: 'Grand Total',   value: `₹${resolveAmount(selected.order.grandTotal)}`, color: 'text-gray-800' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase tracking-widest text-gray-400">{label}</span>
                    <span className={`text-xs font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Medicine loading ── */}
          {selected?.loading && (
            <div className="flex items-center gap-3 py-10 justify-center text-gray-400 text-sm">
              <span className="w-4 h-4 border border-gray-200 border-t-blue-400 rounded-full animate-spin" />
              Loading medicine details…
            </div>
          )}

          {/* ── Medicine error ── */}
          {selected?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-500 text-sm">
              ⚠ {selected.error}
            </div>
          )}

          {/* ── Editor ── */}
          {med && !selected?.loading && !selected?.error && (
            <div className="flex flex-col gap-5">

              <Section title="Core Information" icon="💊">
                <EditField label="Medicine Name" value={med.medicineName}
                  onChange={v => updateField(['medicineName'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'medicineName')} />
                <EditField label="Composition" value={med.composition}
                  onChange={v => updateField(['composition'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'composition')} />
                <EditField label="Manufacturer" value={med.manufacturer}
                  onChange={v => updateField(['manufacturer'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'manufacturer')} />
                <EditField label="Description" value={med.description}
                  onChange={v => updateField(['description'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'description')} />
                <EditField label="Batch Code" value={med.batchCode}
                  onChange={v => updateField(['batchCode'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'batchCode')} />
                <EditField label="Storage Condition" value={med.storageCondition}
                  onChange={v => updateField(['storageCondition'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'storageCondition')} />
                <EditField label="Prescription Required" value={med.prescriptionRequired} type="boolean"
                  onChange={v => updateField(['prescriptionRequired'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'prescriptionRequired')} />
                <EditField label="Manufactured Date" value={med.manufacturedDate} type="date"
                  onChange={v => updateField(['manufacturedDate'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'manufacturedDate')} />
                <EditField label="Expiry Date" value={med.expiryDate} type="date"
                  onChange={v => updateField(['expiryDate'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'expiryDate')} />
              </Section>

              <Section title="Category" icon="🏷">
                <EditField label="Primary Category" value={med.category?.primaryCategory}
                  onChange={v => updateField(['category', 'primaryCategory'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'category.primaryCategory')} />
                <EditField label="Therapeutic Class" value={med.category?.therapeuticClass}
                  onChange={v => updateField(['category', 'therapeuticClass'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'category.therapeuticClass')} />
                <EditField label="Dosage Form" value={med.category?.dosageForm}
                  onChange={v => updateField(['category', 'dosageForm'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'category.dosageForm')} />
              </Section>

              <Section title="Packaging & Pricing" icon="💰">
                <EditField label="Qty Description" value={med.packaging?.quantityDescription}
                  onChange={v => updateField(['packaging', 'quantityDescription'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'packaging.quantityDescription')} />
                <EditField label="MRP (₹)" value={med.packaging?.mrp} type="number"
                  onChange={v => updateField(['packaging', 'mrp'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'packaging.mrp')} />
                <EditField label="Discount (%)" value={med.packaging?.discountPercent} type="number"
                  onChange={v => updateField(['packaging', 'discountPercent'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'packaging.discountPercent')} />
                <EditField label="Price (₹)" value={med.packaging?.price} type="number"
                  onChange={v => updateField(['packaging', 'price'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'packaging.price')} />
                <EditField label="Price / Unit (₹)" value={med.packaging?.pricePerUnit} type="number"
                  onChange={v => updateField(['packaging', 'pricePerUnit'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'packaging.pricePerUnit')} />
                <EditField label="GST Rate (%)" value={med.packaging?.gstRate} type="number"
                  onChange={v => updateField(['packaging', 'gstRate'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'packaging.gstRate')} />
                <EditField label="HSN Code" value={med.packaging?.hsnCode}
                  onChange={v => updateField(['packaging', 'hsnCode'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'packaging.hsnCode')} />
              </Section>

              <Section title="Stock" icon="📊">
                <div className="col-span-2 md:col-span-3">
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                    <span className="text-emerald-500 text-base mt-0.5">↑</span>
                    <div>
                      <p className="text-emerald-700 text-xs font-semibold mb-0.5">
                        Units Available auto-updated from order
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Previous stock{' '}
                        <span className="text-gray-700 font-semibold">
                          {originalRef.current?.stock?.unitsAvailable ?? 0}
                        </span>
                        {' '}+{' '}order qty{' '}
                        <span className="text-emerald-600 font-semibold">{selected?.item.quantity}</span>
                        {' '}={' '}
                        <span className="text-emerald-700 font-bold">{med.stock?.unitsAvailable}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <EditField label="Units Available" value={med.stock?.unitsAvailable} type="number"
                  onChange={v => updateField(['stock', 'unitsAvailable'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'stock.unitsAvailable')} />
                <EditField label="Threshold" value={med.stock?.threshold} type="number"
                  onChange={v => updateField(['stock', 'threshold'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'stock.threshold')} />
                <EditField label="Base Quantity" value={med.stock?.baseQuantity} type="number"
                  onChange={v => updateField(['stock', 'baseQuantity'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'stock.baseQuantity')} />
                <EditField label="Total Sub-Units" value={med.stock?.totalSubUnits} type="number"
                  onChange={v => updateField(['stock', 'totalSubUnits'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'stock.totalSubUnits')} />
                <EditField label="Allow Sub-Quantity" value={med.stock?.allowSubQuantity} type="boolean"
                  onChange={v => updateField(['stock', 'allowSubQuantity'], v)}
                  highlight={changes.some(c => c.path.join('.') === 'stock.allowSubQuantity')} />
              </Section>

              {/* Pending Changes */}
              {changes.length > 0 && (
                <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 bg-emerald-50 border-b border-emerald-200">
                    <span>📝</span>
                    <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
                      Pending Changes ({changes.length})
                    </h3>
                  </div>
                  <div className="bg-white divide-y divide-gray-100">
                    {changes.map((c, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 text-xs">
                        <span className="text-gray-400 font-medium">{c.path.join(' > ')}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-red-400 line-through">{String(c.oldValue ?? '—')}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-emerald-600 font-semibold">{String(c.newValue ?? '—')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom CTA */}
              <div className="flex justify-end pt-2 pb-8">
                <button
                  onClick={handleSave}
                  disabled={saving || changes.length === 0}
                  className={`flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-150 ${
                    saving || changes.length === 0
                      ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:shadow-emerald-200 hover:-translate-y-0.5'
                  }`}
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Saving Changes…
                    </>
                  ) : (
                    <>
                      <span className="text-base">✓</span>
                      Update Inventory
                      {changes.length > 0 && (
                        <span className="bg-emerald-600 rounded-full px-2 py-0.5 text-[11px]">
                          {changes.length}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DeliveredOrderInventoryUpdate;