import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import {
  Search, MapPin, ShoppingCart, X, AlertTriangle,
  Gift, Clock, PackageX, Package, Box,
} from "lucide-react";
import { distributorService } from "../services/distributorService";
import { medicineService, MedicineSearchResult } from "../services/medicineService";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cartService } from "../services/distributor_cartService";
import { useCartContext } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

// ─── Dosage-form → pack-unit label ───────────────────────────────────────────
const DOSAGE_LABELS: Record<string, { packUnit: string; mainUnit: string | null }> = {
  tablet:           { packUnit: "strip"  , mainUnit: "box" },
  capsule:          { packUnit: "strip", mainUnit: "box" },
  syrup:            { packUnit: "bottle" , mainUnit: null },
  injection:        { packUnit: "vial" , mainUnit: null }, 
  cream:            { packUnit: "tube" , mainUnit: null }, 
  ointment:         { packUnit: "tube"  , mainUnit: null },
  "cream/ointment": { packUnit: "tube" , mainUnit: null },
  "gel/spray":      { packUnit: "unit"   , mainUnit: null },
  gel:              { packUnit: "unit" , mainUnit: null },
  spray:            { packUnit: "unit"  , mainUnit: null },
  drops:            { packUnit: "bottle" , mainUnit: null },
  sachet:           { packUnit: "sachet" , mainUnit: "box"},
  lotion:           { packUnit: "bottle"  , mainUnit: null },
  powder:           { packUnit: "unit"   ,  mainUnit: null },
  inhaler:          { packUnit: "unit"   , mainUnit: null },
  gloves:           { packUnit: "piece" , mainUnit: "box" },
  mask:             { packUnit: "piece"  , mainUnit: "box" },
};

function getDosageLabel(dosageForm?: string): string {
  const key = (dosageForm ?? "").toLowerCase().trim();
  return DOSAGE_LABELS[key]?.packUnit ?? "unit";
}

function pluralise(unit: string, qty: number): string {
  if (qty === 1) return unit;
  if (unit === 'box') return unit + "es";
  return unit + "s";
}

function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === "object" && "$numberDecimal" in v) return parseFloat(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

type ExpiryStatus = "expired";

function getExpiryStatus(expiryDate?: string): ExpiryStatus | null {
  if (!expiryDate) return null;
  const diffDays = (new Date(expiryDate).getTime() - Date.now()) / 86_400_000;
  if (diffDays < 0) return "expired";
  return null;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "N/A";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function getPackSizeLabel(pkg: any): string | null {
  const ps  = toNum(pkg?.packSize);
  const psu = pkg?.packSizeUnit || "";
  if (ps > 0 && psu) return `${ps} ${psu}`;
  return null;
}

function buildQuantityDescription(medicine: MedicineSearchResult): string {
  if ((medicine.packaging as any)?.quantityDescription) {
    return (medicine.packaging as any).quantityDescription;
  }
  const dosageForm = medicine.category?.dosageForm ?? "";
  const pkg        = medicine.packaging as any;
  const packSizeLabel = getPackSizeLabel(pkg);
  if (packSizeLabel) {
    const ppb = toNum(pkg?.packsPerBox);
    const unit = getDosageLabel(dosageForm);
    const container = unit.charAt(0).toUpperCase() + unit.slice(1);
    let desc = `${packSizeLabel} per ${container}`;
    if (ppb > 0) desc += ` | ${ppb} ${pluralise(container, ppb)} per Box`;
    return desc;
  }
  const packsOnlyForms = ["sachet", "gloves", "mask"];
  if (packsOnlyForms.includes(dosageForm.toLowerCase())) {
    const ppb = toNum(pkg?.packsPerBox);
    if (!ppb) return "—";
    const noun = dosageForm.toLowerCase() === "sachet" ? "Sachet"
               : dosageForm.toLowerCase() === "gloves" ? "Glove"
               : "Piece";
    return `${ppb} ${noun}${ppb !== 1 ? "s" : ""} per Box`;
  }
  const upp = toNum(pkg?.unitsPerPack);
  const ppb = toNum(pkg?.packsPerBox);
  const unitNames: Record<string, { unit: string; pack: string }> = {
    tablet:  { unit: "Tablet",  pack: "Strip" },
    capsule: { unit: "Capsule", pack: "Strip" },
  };
  const names = unitNames[dosageForm.toLowerCase()] ?? { unit: "Unit", pack: "Pack" };
  const parts: string[] = [];
  if (upp > 0) parts.push(`${upp} ${names.unit}${upp !== 1 ? "s" : ""} per ${names.pack}`);
  if (ppb > 0) parts.push(`${ppb} ${names.pack}${ppb !== 1 ? "s" : ""} per Box`);
  return parts.join(" | ") || "Standard pack";
}

function getPurchaseOptions(medicine: MedicineSearchResult): Array<{ orderUnit: string; minimumOrderQuantity: number }> {
  const pkg = medicine.packaging as any;
  if (!pkg) return [];
  if (pkg.orderUnit) {
    return [{ orderUnit: pkg.orderUnit, minimumOrderQuantity: toNum(pkg.minimumOrderQuantity) || 1 }];
  }
  const purchase = pkg.purchase;
  if (!purchase) return [];
  const arr = Array.isArray(purchase) ? purchase : [purchase];
  return arr
    .filter((p: any) => p?.orderUnit)
    .map((p: any) => ({
      orderUnit: p.orderUnit,
      minimumOrderQuantity: toNum(p.minimumOrderQuantity) || 1,
    }));
}

/** Returns true if this medicine has BOTH a box price and a pack price */
function hasBothPrices(medicine: MedicineSearchResult): boolean {
  const pkg = medicine.packaging as any;
  const pricePerBox  = toNum(pkg?.pricePerBox);
  const pricePerPack = toNum(pkg?.price);
  return pricePerBox > 0 && pricePerPack > 0;
}

/**
 * Returns { box, pack } price info.
 * box  — null if no box price
 * pack — null if no pack price
 */
function getAllPrices(medicine: MedicineSearchResult): {
  box:  { price: number; mrp: number } | null;
  pack: { price: number; mrp: number } | null;
} {
  const pkg         = medicine.packaging as any;
  const pricePerBox = toNum(pkg?.pricePerBox);
  const mrpPerBox   = toNum(pkg?.mrpPerBox);
  const pricePerPack = toNum(pkg?.price);
  const mrpPerPack   = toNum(pkg?.mrpPerPack) || pricePerPack;
  return {
    box:  pricePerBox  > 0 ? { price: pricePerBox,  mrp: mrpPerBox  || pricePerBox  } : null,
    pack: pricePerPack > 0 ? { price: pricePerPack, mrp: mrpPerPack                 } : null,
  };
}

/** Effective display price — prefer per-box for box-only products */
function getDisplayPrice(medicine: MedicineSearchResult): { price: number; mrp: number; label: string } {
  const pkg = medicine.packaging as any;
  const opts = getPurchaseOptions(medicine);
  const hasBoxOnly  = opts.length > 0 && opts.every((o) => o.orderUnit === "box");
  const pricePerBox = toNum(pkg?.pricePerBox);
  const mrpPerBox   = toNum(pkg?.mrpPerBox);
  if (hasBoxOnly && pricePerBox > 0) {
    return { price: pricePerBox, mrp: mrpPerBox || pricePerBox, label: "/ box" };
  }
  const price = toNum(pkg?.price) || toNum(medicine.packaging?.price);
  const mrp   = toNum(pkg?.mrpPerPack) || toNum(medicine.packaging?.mrpPerPack) || price;
  return { price, mrp, label: "/ pack" };
}

function getAvailableStock(m: MedicineSearchResult): number {
  return (m as any).availableStock ?? m.stock?.packsAvailable ?? (m.stock as any)?.unitsAvailable ?? 0;
}

/**
 * Returns the stock quantity and unit label to display, based on order unit.
 * - orderUnit === "box"  → qty = floor(packsAvailable / packsPerBox), unit = "box"
 * - orderUnit === "pack" → qty = packsAvailable, unit = dosage-form pack label
 */
function getStockDisplay(m: MedicineSearchResult): { qty: number; unit: string } {
  const pkg = m.packaging as any;
  const opts = getPurchaseOptions(m);
  const orderUnit = opts[0]?.orderUnit ?? "pack";
  const packsAvailable = getAvailableStock(m);

  if (orderUnit === "box") {
    const packsPerBox = toNum(pkg?.packsPerBox);
    const boxes = packsPerBox > 0 ? Math.floor(packsAvailable / packsPerBox) : packsAvailable;
    return { qty: boxes, unit: "box" };
  }

  return { qty: packsAvailable, unit: getDosageLabel(m.category?.dosageForm) };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function SchemeBadge({ scheme }: { scheme: any }) {
  if (!scheme?.buyQty || !scheme?.freeQty) return null;
  return (
    <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 w-fit">
      <Gift className="w-3 h-3" />
      Buy {scheme.buyQty} {scheme.buyUnit} → Get {scheme.freeQty} {scheme.freeUnit} Free
    </div>
  );
}

function PurchaseChips({ medicine }: { medicine: MedicineSearchResult }) {
  const opts = getPurchaseOptions(medicine);
  if (opts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {opts.map((o, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5"
        >
          Min {o.minimumOrderQuantity} <span className="capitalize">{o.orderUnit}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Price display component — shows box price prominently on top, pack price
 * below in smaller text when both exist. Falls back to a single price line.
 */
function PriceBlock({
  medicine,
  compact = false,
}: {
  medicine: MedicineSearchResult;
  compact?: boolean;
}) {
  const pkg      = medicine.packaging as any;
  const discount = toNum(pkg?.discountPercent);
  const { box, pack } = getAllPrices(medicine);
  const bothExist = box !== null && pack !== null;

  if (bothExist) {
    return (
      <div className="space-y-0.5">
        {/* Box price — primary */}
        <div className={`flex items-baseline gap-1.5`}>
          <span className={`${compact ? "text-base" : "text-xl"} font-bold text-gray-900`}>
            ₹{box!.price.toFixed(2)}
          </span>
          <span className="text-xs text-gray-400">/ box</span>
          {box!.mrp > box!.price && (
            <>
              <span className="text-xs text-gray-400 line-through">₹{box!.mrp.toFixed(2)}</span>
              {discount > 0 && (
                <span className="text-xs font-semibold text-green-600">{discount}% off</span>
              )}
            </>
          )}
        </div>
        {/* Pack price — secondary */}
        <div className="flex items-baseline gap-1">
          <span className="text-xs font-semibold text-gray-500">₹{pack!.price.toFixed(2)}</span>
          <span className="text-[10px] text-gray-400">/ pack</span>
          {pack!.mrp > pack!.price && (
            <span className="text-[10px] text-gray-400 line-through">₹{pack!.mrp.toFixed(2)}</span>
          )}
        </div>
      </div>
    );
  }

  // Only one price exists — fallback
  const { price, mrp, label } = getDisplayPrice(medicine);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`${compact ? "text-base" : "text-xl"} font-bold text-gray-900`}>
        ₹{price.toFixed(2)}
      </span>
      <span className="text-xs text-gray-400">{label}</span>
      {mrp > price && (
        <>
          <span className="text-xs text-gray-400 line-through">₹{mrp.toFixed(2)}</span>
          {discount > 0 && (
            <span className="text-xs font-semibold text-green-600">{discount}% off</span>
          )}
        </>
      )}
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
interface StepperProps {
  productID: string;
  medicine: MedicineSearchResult;
  disabled?: boolean;
  maxStock?: number;
  onAdd: (medicine: MedicineSearchResult, quantity?: number) => Promise<void>;
  onRemove: (medicine: MedicineSearchResult) => Promise<void>;
  quantities: Record<string, number>;
  variant?: "card" | "modal";
}

function Stepper({ productID, medicine, disabled, maxStock, onAdd, onRemove, quantities, variant = "card" }: StepperProps) {
  const qty   = quantities[productID] ?? 0;
  const atMax = maxStock !== undefined && qty >= maxStock;
  const [addLoading, setAddLoading]       = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  const isCard = variant === "card";
  const border = isCard ? "border-red-500"  : "border-[#123B6B]";
  const text   = isCard ? "text-red-500"    : "text-[#123B6B]";
  const hover  = isCard ? "hover:bg-red-50" : "hover:bg-blue-50";

  const handleAdd = async () => {
    if (disabled || atMax || addLoading) return;
    setAddLoading(true);
    try { await onAdd(medicine); } catch (e) { console.error(e); } finally { setAddLoading(false); }
  };

  const handleRemove = async () => {
    if (removeLoading) return;
    setRemoveLoading(true);
    try { await onRemove(medicine); } catch (e) { console.error(e); } finally { setRemoveLoading(false); }
  };

  if (qty === 0) {
    return (
      <Button
        className="flex-1 bg-emerald-800 hover:bg-emerald-600 text-white font-medium"
        disabled={disabled || addLoading}
        onClick={handleAdd}
      >
        <ShoppingCart className="w-4 h-4 mr-2" />
        {addLoading ? "Adding…" : "Add to Cart"}
      </Button>
    );
  }

  return (
    <div className={`flex-1 flex items-center justify-between border-2 ${border} rounded-md overflow-hidden h-10`}>
      <button
        onClick={handleRemove}
        disabled={removeLoading}
        className={`flex-1 flex items-center justify-center ${text} font-bold text-xl ${hover} h-full disabled:opacity-40`}
      >
        {removeLoading ? "…" : "−"}
      </button>
      <span className={`flex-1 text-center font-semibold text-gray-800 select-none`}>
        {qty}
      </span>
      <button
        onClick={handleAdd}
        disabled={disabled || addLoading || atMax}
        className={`flex-1 flex items-center justify-center ${text} font-bold text-xl ${hover} h-full disabled:opacity-40`}
      >
        {addLoading ? "…" : "+"}
      </button>
    </div>
  );
}

// ─── Unit Select Popup ─────────────────────────────────────────────────────────
interface UnitSelectPopupProps {
  medicine: MedicineSearchResult;
  onSelect: (unit: "box" | "pack") => void;
  onClose: () => void;
}

function UnitSelectPopup({ medicine, onSelect, onClose }: UnitSelectPopupProps) {
  const { box, pack } = getAllPrices(medicine);
  const pkg = medicine.packaging as any;
  const packsPerBox  = toNum(pkg?.packsPerBox);
  const unitsPerPack = toNum(pkg?.unitsPerPack);
  const dosageForm   = medicine.category?.dosageForm ?? "";
  const packUnit     = getDosageLabel(dosageForm);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Select Purchase Unit</h3>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{medicine.medicineName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Box option */}
          {box && (
            <button
              onClick={() => onSelect("box")}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 rounded-xl transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                <Box className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">Per Box</p>
                {packsPerBox > 0 && (
                  <p className="text-xs text-gray-500">
                    {packsPerBox} {pluralise(packUnit, packsPerBox)} per box
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-gray-900">₹{box.price.toFixed(2)}</p>
                {box.mrp > box.price && (
                  <p className="text-xs text-gray-400 line-through">₹{box.mrp.toFixed(2)}</p>
                )}
              </div>
            </button>
          )}

          {/* Pack option */}
          {pack && (
            <button
              onClick={() => onSelect("pack")}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                <Package className="w-5 h-5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">Per Pack</p>
                {unitsPerPack > 0 && (
                  <p className="text-xs text-gray-500">
                    {unitsPerPack} {medicine.category?.dosageForm || "units"} per pack
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-gray-900">₹{pack.price.toFixed(2)}</p>
                {pack.mrp > pack.price && (
                  <p className="text-xs text-gray-400 line-through">₹{pack.mrp.toFixed(2)}</p>
                )}
              </div>
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Tap an option to add to cart
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const { distributorID } = useParams<{ distributorID: string }>();
  const distributorInfoFetchedRef = useRef(false);
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [category,   setCategory]   = useState("ALL");
  const [sortBy,     setSortBy]     = useState("name");
  const [medicines,  setMedicines]  = useState<MedicineSearchResult[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 9;

  const [selectedMedicine, setSelectedMedicine] = useState<MedicineSearchResult | null>(null);
  const [alternates, setAlternates]           = useState<MedicineSearchResult[]>([]);
  const [alternatesLoading, setAlternatesLoading] = useState(false);

  // Unit selection popup state (for products with both box & pack prices)
  const [unitSelectMedicine, setUnitSelectMedicine] = useState<MedicineSearchResult | null>(null);

  const { refetchCart, items } = useCartContext();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Track pending cart ops so we don't overwrite optimistic state on refetch
  const pendingOpsRef = useRef(0);

  const [distributorName,    setDistributorName]    = useState<string | null>(null);
  const [distributorPhone,   setDistributorPhone]   = useState<number | null>(null);
  const [distributorAddress, setDistributorAddress] = useState<string | null>(null);

  const [wsConnected, setWsConnected] = useState(false);
  const [wsError,     setWsError]     = useState<string | null>(null);
  const wsRef               = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef  = useRef<NodeJS.Timeout | null>(null);
  const refetchTimerRef     = useRef<NodeJS.Timeout | null>(null);

  const totalItems = items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;

  const categories = [
    "ALL", "Prescription Medicines", "OTC Medicines", "Chronic Care Medicines",
    "Acute Care Medicines", "Supplements & Nutrition", "Topical Medicines",
    "Injectables & Vaccines", "Medical Devices", "Surgical & Consumables",
    "Personal Care & Wellness", "FMCG",
  ];

  // ── Sync cart quantities (skip if pending local ops) ────────────────────────
  useEffect(() => {
    if (!items || pendingOpsRef.current > 0) return;
    const q: Record<string, number> = {};
    items.forEach((item: any) => { q[item.productID] = item.quantity; });
    setQuantities(q);
  }, [items]);

  // ── Debounced refetch ──────────────────────────────────────────────────────
  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchCart().finally(() => { pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1); });
    }, 600);
  }, [refetchCart]);

  // ── Distributor info ───────────────────────────────────────────────────────
  const loadDistributorInfo = async (id: string) => {
    if (distributorInfoFetchedRef.current) return;
    distributorInfoFetchedRef.current = true;
    const data = await distributorService.getDistributorById(id);
    if (!data) return;
    if (data.name)    setDistributorName(data.name);
    if (data.phone)   setDistributorPhone(data.phone);
    if (data.address) {
      setDistributorAddress(
        typeof data.address === "string"
          ? data.address
          : [data.address.line1, data.address.city, data.address.state, data.address.pincode]
              .filter(Boolean).join(", ") || null
      );
    }
  };

  useEffect(() => {
    if (distributorID) loadDistributorInfo(distributorID);
  }, [distributorID]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const applySort = (list: MedicineSearchResult[]) =>
    [...list].sort((a, b) =>
      sortBy === "price"
        ? (toNum((a.packaging as any)?.price) - toNum((b.packaging as any)?.price))
        : a.medicineName.localeCompare(b.medicineName)
    );

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const results = await medicineService.searchMedicines({
        keyword: searchTerm, category, sortBy, sortOrder: "asc", distributorID,
      });
      setMedicines(applySort(results));
    } catch (err: any) {
      alert(err.message || "Failed to search");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMedicines(); setCurrentPage(1); }, [searchTerm, category]);
  useEffect(() => { if (medicines.length > 0) setMedicines(applySort(medicines)); }, [sortBy]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) { setWsError("No token"); startPolling(); return; }
        const envHost = import.meta.env.VITE_INVENTORY_SERVICE_WS;
        const wsUrl   = envHost
          ? `${location.protocol === "https:" ? "wss:" : "ws:"}//${envHost}/ws/stock?token=${encodeURIComponent(token)}`
          : `ws://localhost:5204/ws/stock?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) { ws.close(); startPolling(); } }, 10000);
        ws.onopen  = () => { clearTimeout(timeout); setWsConnected(true); setWsError(null); if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; } };
        ws.onmessage = (e) => {
          try {
            const u = JSON.parse(e.data);
            if (u.type === "connection_established") return;
            if (["stock_update","product_update","product_created"].includes(u.type)) {
              const { productID, availableStock, reservedStock, expiryDate, stock } = u.data;
              const patch: Partial<MedicineSearchResult> = { availableStock, reservedStock, ...(expiryDate && { expiryDate }), ...(stock && { stock }) };
              setMedicines(prev => prev.map(m => m.productID === productID ? { ...m, ...patch } as MedicineSearchResult : m));
              setSelectedMedicine(prev => prev?.productID === productID ? { ...prev, ...patch } as MedicineSearchResult : prev);
            }
          } catch {}
        };
        ws.onerror = () => { setWsConnected(false); setWsError("Connection error"); };
        ws.onclose = (ev) => {
          clearTimeout(timeout); setWsConnected(false); wsRef.current = null;
          setWsError(ev.code === 1008 ? "Auth failed" : ev.code === 1006 ? "Server offline" : `Disconnected (${ev.code})`);
          startPolling();
          if (ev.code !== 1008) reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };
        wsRef.current = ws;
      } catch { startPolling(); }
    };
    connect();
    return () => {
      wsRef.current?.close(); wsRef.current = null;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollingIntervalRef.current)  clearInterval(pollingIntervalRef.current);
      if (refetchTimerRef.current)     clearTimeout(refetchTimerRef.current);
    };
  }, []);

  const startPolling = () => {
    if (pollingIntervalRef.current) return;
    pollingIntervalRef.current = setInterval(() => { if (!document.hidden && !wsConnected) fetchMedicines(); }, 30_000);
  };

  useEffect(() => {
    const onVisible = () => { if (!document.hidden && !wsConnected) fetchMedicines(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [wsConnected]);

  // ── Cart ───────────────────────────────────────────────────────────────────
  /**
   * Core add-to-cart. `selectedUnit` only used when both box & pack prices exist.
   */
  const doAddToCart = async (medicine: MedicineSearchResult, selectedUnit?: "box" | "pack", quantity = 1) => {
    const available = getAvailableStock(medicine);
    const current   = quantities[medicine.productID] ?? 0;
    if (current >= available || !medicine.distributorID) {
      if (!medicine.distributorID) alert("Distributor information missing");
      return;
    }

    const pkg          = medicine.packaging as any;
    const pricePerBox  = toNum(pkg?.pricePerBox);
    const pricePerPack = toNum(pkg?.price);

    // Resolve price based on selected unit
    let resolvedPrice: number;
    if (selectedUnit === "box" && pricePerBox > 0) {
      resolvedPrice = pricePerBox;
    } else if (selectedUnit === "pack" && pricePerPack > 0) {
      resolvedPrice = pricePerPack;
    } else {
      resolvedPrice = pricePerPack || pricePerBox;
    }

    // Optimistic update
    pendingOpsRef.current++;
    setQuantities(prev => ({ ...prev, [medicine.productID]: current + quantity }));

    try {
      await cartService.addToCart({
        productID:            medicine.productID,
        name:                 medicine.medicineName,
        price:                resolvedPrice,
        quantity,
        distributorID:        medicine.distributorID!,
        prescriptionRequired: medicine.prescriptionRequired || false,
        batchCode:            medicine.batchCode || "N/A",
        ...(selectedUnit && { orderUnit: selectedUnit }),
        ...(pkg?.pricePerUnit !== undefined && { pricePerUnit: pkg.pricePerUnit }),
      });
      scheduleRefetch();
    } catch {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      setQuantities(prev => ({ ...prev, [medicine.productID]: Math.max(0, (prev[medicine.productID] ?? 0) - quantity) }));
    }
  };

  /**
   * handleAddToCart — shows unit-select popup when both box & pack prices exist.
   */
  const handleAddToCart = async (medicine: MedicineSearchResult, quantity = 1) => {
    if (hasBothPrices(medicine)) {
      setUnitSelectMedicine(medicine);
      return;
    }
    await doAddToCart(medicine, undefined, quantity);
  };

  const handleUnitSelected = async (unit: "box" | "pack") => {
    if (!unitSelectMedicine) return;
    setUnitSelectMedicine(null);
    await doAddToCart(unitSelectMedicine, unit, 1);
  };

  const handleRemoveFromCart = async (medicine: MedicineSearchResult) => {
    const current = quantities[medicine.productID] ?? 0;
    if (current <= 0) return;
    const next = Math.max(0, current - 1);

    // Optimistic update immediately
    pendingOpsRef.current++;
    setQuantities(prev => ({ ...prev, [medicine.productID]: next }));

    try {
      // Always remove the item completely first — avoids relying on updateQuantity
      await cartService.removeItem(medicine.productID);

      // Re-add with the decremented quantity if still > 0
      if (next > 0) {
        const pkg = medicine.packaging as any;
        const price = toNum(pkg?.price) || toNum(pkg?.pricePerBox);
        await cartService.addToCart({
          productID:            medicine.productID,
          name:                 medicine.medicineName,
          price,
          quantity:             next,
          distributorID:        medicine.distributorID!,
          prescriptionRequired: medicine.prescriptionRequired || false,
          batchCode:            medicine.batchCode || "N/A",
          ...(pkg?.pricePerUnit !== undefined && { pricePerUnit: pkg.pricePerUnit }),
        });
      }

      scheduleRefetch();
    } catch {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      setQuantities(prev => ({ ...prev, [medicine.productID]: current }));
    }
  };

  // ── View Details ───────────────────────────────────────────────────────────
  const handleViewDetails = async (medicine: MedicineSearchResult) => {
    setSelectedMedicine(medicine);
    setAlternates([]);

    if (medicine.distributorID) {
      try {
        const full = await medicineService.getMedicineDetails(medicine.productID, medicine.distributorID);
        setSelectedMedicine({ ...full, availableStock: (medicine as any).availableStock });
        setMedicines(prev => prev.map(m => m.productID === medicine.productID ? { ...m, stock: full.stock } : m));
      } catch {}
    }

    if (medicine.composition) {
      setAlternatesLoading(true);
      try {
        const kw = medicine.composition
          .replace(/\(.*?\)/g, "").replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)/gi, "")
          .replace(/\d+/g, "").replace(/[^a-zA-Z\s]/g, " ").replace(/\s+/g, " ").trim()
          .split(/\s+/).slice(0, 2).join(" ");
        const results = await medicineService.searchMedicines({ keyword: kw, category: "ALL", sortBy: "name", sortOrder: "asc", distributorID: medicine.distributorID });
        setAlternates(results.filter(m => m.productID !== medicine.productID).slice(0, 6));
      } catch {} finally { setAlternatesLoading(false); }
    }
  };

  const totalPages         = Math.ceil(medicines.length / cardsPerPage);
  const paginatedMedicines = medicines.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);

  const isMedDevice = (m: MedicineSearchResult) =>
    m.category?.primaryCategory === "Medical Devices";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Search Medicines</h1>
        <div className="flex items-start justify-between gap-4">
          <div className="text-gray-600">
            {distributorName ? (
              <div className="space-y-1">
                <p>Browsing inventory from <span className="font-semibold text-emerald-600">{distributorName}</span></p>
                {distributorAddress && (
                  <p className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
                    {distributorAddress}
                  </p>
                )}
              </div>
            ) : (
              <p>Find the medicines you need from trusted distributors.</p>
            )}
          </div>
          <div className="flex items-center gap-2 group relative flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            <span className="text-xs text-gray-500">{wsConnected ? "Live updates" : "Polling mode"}</span>
            {wsError && !wsConnected && (
              <div className="absolute top-full right-0 mt-2 p-2 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {wsError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={(e) => { e.preventDefault(); fetchMedicines(); }} className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by medicine name or composition..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                {categories.map(c => <option key={c} value={c}>{c === "ALL" ? "All Categories" : c}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                <option value="name">Sort by Name</option>
                <option value="price">Sort by Price</option>
              </select>
              <Button type="submit" disabled={loading} className="bg-emerald-800 hover:bg-emerald-600 text-white">
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </form>
          <p className="text-sm text-gray-500">
            Found <span className="font-semibold text-gray-700">{medicines.length}</span> products
            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
          </p>
        </CardContent>
      </Card>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-16 text-gray-500">Searching medicines…</div>
        ) : medicines.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-500">No medicines found. Try adjusting your search.</div>
        ) : (
          paginatedMedicines.map((medicine) => {
            const availableStock = getAvailableStock(medicine);
            const threshold      = medicine.stock?.threshold ?? 0;
            const isLowStock     = availableStock <= threshold && availableStock > 0;
            const isOutOfStock   = availableStock === 0;
            const packUnit       = getDosageLabel(medicine.category?.dosageForm);
            const expiryStatus   = getExpiryStatus((medicine as any).expiryDate);
            const isExpired      = expiryStatus === "expired";
            const qtyDesc        = buildQuantityDescription(medicine);
            const pricePerUnit   = toNum((medicine.packaging as any)?.pricePerUnit);
            const isMed          = isMedDevice(medicine);
            const { qty: stockQty, unit: stockUnit } = getStockDisplay(medicine);

            return (
              <Card key={medicine.productID} className={`hover:shadow-lg transition-shadow overflow-hidden ${isExpired ? "opacity-70" : ""}`}>
                <CardContent className="p-0">
                  {/* Product Image */}
                  <div className="relative bg-white h-72 flex items-center justify-center border-b overflow-hidden">
                    {medicine.productImageURL ? (
                      <img
                        src={medicine.productImageURL}
                        alt={medicine.medicineName}
                        className="h-full w-full object-contain p-3"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.innerHTML = '<div class="text-6xl">💊</div>'; }}
                      />
                    ) : (
                      <div className="text-6xl">💊</div>
                    )}
                    <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 bg-gray-100 border rounded-full text-gray-600 shadow-sm">
                      {medicine.category?.primaryCategory}
                    </span>
                  </div>

                  <div className="p-3 space-y-1.5">
                    {/* Name + stock badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">
                        {medicine.medicineName}
                      </h3>
                      {isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 whitespace-nowrap flex-shrink-0">Out of Stock</span>
                      ) : isLowStock ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 whitespace-nowrap flex-shrink-0">
                          Low: {stockQty} {pluralise(stockUnit, stockQty)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 whitespace-nowrap flex-shrink-0">
                          {stockQty} {pluralise(stockUnit, stockQty)}
                        </span>
                      )}
                    </div>

                    {/* Quantity description */}
                    <p className="text-xs text-gray-500 leading-snug">
                      {qtyDesc !== "Standard pack" ? qtyDesc : (medicine.category?.dosageForm || "Standard pack")}
                      {pricePerUnit > 0 && (
                        <> · <span className="font-semibold text-gray-700">₹{pricePerUnit.toFixed(2)}</span> / unit</>
                      )}
                    </p>

                    {/* Purchase options (MOQ chips) */}
                    <PurchaseChips medicine={medicine} />

                    {/* Price block — box on top if both exist */}
                    <div className="pt-0.5">
                      <PriceBlock medicine={medicine} />
                    </div>

                    {/* Badges row */}
                    <div className="flex flex-wrap gap-1">
                      <SchemeBadge scheme={(medicine.packaging as any)?.scheme} />
                      {isMed && (medicine as any).warranty && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 w-fit">
                          <Package className="w-3 h-3" />
                          {(medicine as any).warranty} Warranty
                        </div>
                      )}
                      {medicine.prescriptionRequired && (
                        <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                          Rx Required
                        </span>
                      )}
                      {hasBothPrices(medicine) && (
                        <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                          Box &amp; Pack
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <Stepper
                        productID={medicine.productID}
                        medicine={medicine}
                        disabled={isOutOfStock}
                        maxStock={availableStock}
                        onAdd={handleAddToCart}
                        onRemove={handleRemoveFromCart}
                        quantities={quantities}
                        variant="card"
                      />
                      <Button variant="outline" className="px-3 text-xs" onClick={() => handleViewDetails(medicine)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4">
          <p className="text-sm text-gray-600">
            Showing {(currentPage - 1) * cardsPerPage + 1}–{Math.min(currentPage * cardsPerPage, medicines.length)} of {medicines.length} products
          </p>
          <div className="flex gap-2 items-center mr-8">
            <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />  Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-9 h-9 rounded text-sm font-medium ${currentPage === page ? "bg-emerald-800 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                {page}
              </button>
            ))}
            <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              Next  <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DETAILS MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {selectedMedicine && (() => {
        const pkg            = selectedMedicine.packaging as any;
        const availableStock = getAvailableStock(selectedMedicine);
        const packUnit       = getDosageLabel(selectedMedicine.category?.dosageForm);
        const qtyDesc        = buildQuantityDescription(selectedMedicine);
        const purchaseOpts   = getPurchaseOptions(selectedMedicine);
        const isMed          = isMedDevice(selectedMedicine);
        const packSizeLabel  = getPackSizeLabel(pkg);
        const unitsPerPack   = toNum(pkg?.unitsPerPack);
        const packsPerBox    = toNum(pkg?.packsPerBox);
        const pricePerUnit   = toNum(pkg?.pricePerUnit);
        const pricePerBox    = toNum(pkg?.pricePerBox);
        const mrpPerBox      = toNum(pkg?.mrpPerBox);
        const { box, pack }  = getAllPrices(selectedMedicine);
        const discount       = toNum(pkg?.discountPercent);
        const { qty: modalStockQty, unit: modalStockUnit } = getStockDisplay(selectedMedicine);

        // Extra fields
        const hsnCode        = (selectedMedicine as any).hsnCode || pkg?.hsnCode;
        const drugSchedule   = (selectedMedicine as any).drugSchedule;
        const drugType       = (selectedMedicine as any).drugType;
        const shelfLife      = (selectedMedicine as any).shelfLife;
        const storageCondition = (selectedMedicine as any).storageCondition;
        const batchCode      = (selectedMedicine as any).batchCode;
        const manufacturedDate = (selectedMedicine as any).manufacturedDate;
        const expiryDate     = (selectedMedicine as any).expiryDate;
        const warranty       = (selectedMedicine as any).warranty;
        const sideEffects    = (selectedMedicine as any).sideEffects;
        const usageInstructions = (selectedMedicine as any).usageInstructions || (selectedMedicine as any).directions;
        const contraindications = (selectedMedicine as any).contraindications;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">

              {/* Header */}
              <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold text-gray-900">Product Details</h2>
                <button onClick={() => setSelectedMedicine(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Image */}
                <div className="flex justify-center items-center bg-white rounded-lg border p-4 min-h-48">
                  {selectedMedicine.productImageURL ? (
                    <img
                      src={selectedMedicine.productImageURL}
                      alt={selectedMedicine.medicineName}
                      className="max-h-64 w-auto object-contain"
                      onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.innerHTML = '<div class="text-7xl">💊</div>'; }}
                    />
                  ) : (
                    <div className="text-7xl">💊</div>
                  )}
                </div>

                {/* Title block */}
                <div>
                  <h3 className="text-xl font-bold text-emerald-700">{selectedMedicine.medicineName}</h3>
                  {selectedMedicine.manufacturer && (
                    <p className="text-sm text-gray-500 mt-0.5">{selectedMedicine.manufacturer}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-0.5">{qtyDesc}</p>

                  {/* Scheme */}
                  {pkg?.scheme?.buyQty && (
                    <div className="mt-3 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                      <Gift className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">
                        Scheme: Buy {pkg.scheme.buyQty} {pkg.scheme.buyUnit} → Get {pkg.scheme.freeQty} {pkg.scheme.freeUnit} Free
                      </span>
                    </div>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 border-t pt-4">

                  {/* Composition */}
                  {selectedMedicine.composition && !isMed && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 font-medium">Composition</p>
                      <p className="text-sm font-semibold text-gray-800">{selectedMedicine.composition}</p>
                    </div>
                  )}

                  {/* Category */}
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Category</p>
                    <p className="text-sm text-gray-800">{selectedMedicine.category?.primaryCategory}</p>
                  </div>

                  {/* Dosage Form */}
                  {selectedMedicine.category?.dosageForm && !["Medical Devices","Personal Care & Wellness","FMCG"].includes(selectedMedicine.category.primaryCategory) && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Dosage Form</p>
                      <p className="text-sm text-gray-800">{selectedMedicine.category.dosageForm}</p>
                    </div>
                  )}

                  {/* Drug Schedule */}
                  {drugSchedule && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Drug Schedule</p>
                      <p className="text-sm text-gray-800">{drugSchedule}</p>
                    </div>
                  )}

                  {/* Drug Type */}
                  {drugType && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Drug Type</p>
                      <p className="text-sm text-gray-800">{drugType}</p>
                    </div>
                  )}

                  {/* ── Pricing section ── */}
                  {box && pack ? (
                    <>
                      {/* Box price */}
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Price / box</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-gray-900">₹{box.price.toFixed(2)}</span>
                          {box.mrp > box.price && (
                            <>
                              <span className="text-xs text-gray-400 line-through">₹{box.mrp.toFixed(2)}</span>
                              {discount > 0 && <span className="text-xs font-semibold text-green-600">{discount}% off</span>}
                            </>
                          )}
                        </div>
                      </div>
                      {/* Pack price */}
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Price / pack</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-gray-900">₹{pack.price.toFixed(2)}</span>
                          {pack.mrp > pack.price && (
                            <span className="text-xs text-gray-400 line-through">₹{pack.mrp.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">
                        Price{box ? " / box" : " / pack"}
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-gray-900">
                          ₹{(box?.price ?? pack?.price ?? 0).toFixed(2)}
                        </span>
                        {(() => {
                          const p = box ?? pack;
                          return p && p.mrp > p.price ? (
                            <>
                              <span className="text-xs text-gray-400 line-through">₹{p.mrp.toFixed(2)}</span>
                              {discount > 0 && <span className="text-xs font-semibold text-green-600">{discount}% off</span>}
                            </>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Per-unit price */}
                  {pricePerUnit > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Price / unit</p>
                      <p className="text-sm text-gray-800">₹{pricePerUnit.toFixed(2)}</p>
                    </div>
                  )}

                  {/* GST */}
                  {pkg?.gstRate != null && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">GST Rate</p>
                      <p className="text-sm text-gray-800">{pkg.gstRate}%</p>
                    </div>
                  )}

                  {/* HSN Code */}
                  {hsnCode && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">HSN Code</p>
                      <p className="text-sm text-gray-800">{hsnCode}</p>
                    </div>
                  )}

                  {/* Stock */}
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Stock Status</p>
                    {availableStock > 0 ? (
                      <p className="text-sm font-semibold text-green-600">
                        Available: {modalStockQty} {pluralise(modalStockUnit, modalStockQty)}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-red-600">Out of Stock</p>
                    )}
                  </div>

                  {/* Packaging details */}
                  {packSizeLabel && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Pack Size</p>
                      <p className="text-sm text-gray-800">{packSizeLabel}</p>
                    </div>
                  )}
                  {unitsPerPack > 0 && !packSizeLabel && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Units per Pack</p>
                      <p className="text-sm text-gray-800">{unitsPerPack}</p>
                    </div>
                  )}
                  {packsPerBox > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Packs per Box</p>
                      <p className="text-sm text-gray-800">{packsPerBox}</p>
                    </div>
                  )}

                  {/* Manufacturer */}
                  {selectedMedicine.manufacturer && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Manufacturer</p>
                      <p className="text-sm text-gray-800">{selectedMedicine.manufacturer}</p>
                    </div>
                  )}


                  {/* Batch Code */}
                  {batchCode && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Batch Code</p>
                      <p className="text-sm text-gray-800">{batchCode}</p>
                    </div>
                  )}

                  {/* Dates */}
                  {manufacturedDate && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Manufactured Date</p>
                      <p className="text-sm text-gray-800">{formatDate(manufacturedDate)}</p>
                    </div>
                  )}

                  {isMed ? (
                    warranty && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Warranty</p>
                        <p className="text-sm text-gray-800">{warranty}</p>
                      </div>
                    )
                  ) : (
                    expiryDate && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Expiry Date</p>
                        <p className="text-sm font-medium text-gray-800">{formatDate(expiryDate)}</p>
                      </div>
                    )
                  )}

                  {/* Shelf Life */}
                  {shelfLife && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Shelf Life</p>
                      <p className="text-sm text-gray-800">{shelfLife}</p>
                    </div>
                  )}

                  {/* Storage */}
                  {storageCondition && storageCondition !== "-" && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Storage</p>
                      <p className="text-sm text-gray-800">{storageCondition}</p>
                    </div>
                  )}
                </div>

                {/* Purchase options */}
                {purchaseOpts.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Purchase Options</p>
                    <div className="flex flex-wrap gap-2">
                      {purchaseOpts.map((o, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                          <Package className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium capitalize text-gray-700">{o.orderUnit}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500 text-xs">Min {o.minimumOrderQuantity}</span>
                          {o.orderUnit === "box" && pricePerBox > 0 && (
                            <span className="ml-1 font-semibold text-gray-800 text-xs">₹{pricePerBox.toFixed(2)}</span>
                          )}
                          {o.orderUnit === "pack" && toNum(pkg?.price) > 0 && (
                            <span className="ml-1 font-semibold text-gray-800 text-xs">₹{toNum(pkg.price).toFixed(2)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedMedicine.description && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
                    <p className="text-sm text-gray-700 leading-relaxed text-justify whitespace-pre-line">
                      {selectedMedicine.description}
                    </p>
                  </div>
                )}

                {/* Usage Instructions */}
                {usageInstructions && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Usage / Directions</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{usageInstructions}</p>
                  </div>
                )}

                {/* Side Effects */}
                {sideEffects && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Side Effects</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{sideEffects}</p>
                  </div>
                )}

                {/* Contraindications */}
                {contraindications && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contraindications</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{contraindications}</p>
                  </div>
                )}

                {/* Prescription warning */}
                {selectedMedicine.prescriptionRequired && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Prescription Required</p>
                      <p className="text-xs text-red-700">A valid prescription is needed to purchase this medicine.</p>
                    </div>
                  </div>
                )}

                {/* Distributor */}
                {distributorName && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Distributor</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Name</p>
                        <p className="text-sm font-medium text-gray-800">{distributorName}</p>
                      </div>
                      {distributorPhone && (
                        <div>
                          <p className="text-xs text-gray-400">Contact</p>
                          <a href={`tel:${distributorPhone}`} className="text-sm text-blue-600 hover:underline">{distributorPhone}</a>
                        </div>
                      )}
                      {distributorAddress && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-400">Address</p>
                          <p className="text-sm text-gray-700">{distributorAddress}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Alternates */}
                {selectedMedicine.composition && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Alternate Products</p>
                    <p className="text-xs text-gray-400 mb-3">
                      Based on: <span className="font-medium text-gray-600">{selectedMedicine.composition}</span>
                    </p>
                    {alternatesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                        <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        Searching…
                      </div>
                    ) : alternates.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No alternates found.</p>
                    ) : (
                      <div className="space-y-2">
                        {alternates.map((alt) => {
                          const { price: aPrice, mrp: aMrp } = getDisplayPrice(alt);
                          const aDiscount = toNum((alt.packaging as any)?.discountPercent);
                          const aStock    = getAvailableStock(alt);
                          const { qty: aStockQty, unit: aStockUnit } = getStockDisplay(alt);
                          return (
                            <div
                              key={alt.productID}
                              onClick={() => handleViewDetails(alt)}
                              className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-md border bg-white flex-shrink-0 flex items-center justify-center overflow-hidden">
                                {alt.productImageURL ? (
                                  <img src={alt.productImageURL} alt={alt.medicineName} className="h-full w-full object-contain"
                                    onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.innerHTML = '<span class="text-xl">💊</span>'; }} />
                                ) : <span className="text-xl">💊</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-emerald-700">{alt.medicineName}</p>
                                <p className="text-xs text-gray-400 truncate">{alt.composition}</p>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                  <span className="text-sm font-bold text-gray-800">₹{aPrice.toFixed(2)}</span>
                                  {aMrp > aPrice && <span className="text-xs text-gray-400 line-through">₹{aMrp.toFixed(2)}</span>}
                                  {aDiscount > 0 && <span className="text-xs text-green-600 font-medium">{aDiscount}% off</span>}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {aStock === 0 ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Out</span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                    {aStockQty} {pluralise(aStockUnit, aStockQty)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 border-t pt-4">
                  <Stepper
                    productID={selectedMedicine.productID}
                    medicine={selectedMedicine}
                    disabled={availableStock === 0}
                    maxStock={availableStock}
                    onAdd={handleAddToCart}
                    onRemove={handleRemoveFromCart}
                    quantities={quantities}
                    variant="modal"
                  />
                  <Button variant="outline" className="flex-1" onClick={() => setSelectedMedicine(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ UNIT SELECT POPUP ═══ */}
      {unitSelectMedicine && (
        <UnitSelectPopup
          medicine={unitSelectMedicine}
          onSelect={handleUnitSelected}
          onClose={() => setUnitSelectMedicine(null)}
        />
      )}

      {/* Floating Cart Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => navigate("/dashboard/cart")}
          className="relative bg-emerald-800 hover:bg-emerald-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition"
        >
          <ShoppingCart className="w-6 h-6" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}