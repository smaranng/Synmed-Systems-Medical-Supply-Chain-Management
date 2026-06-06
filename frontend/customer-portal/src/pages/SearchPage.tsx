import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
} from "../components/ui/Card";
import { Search, MapPin, ShoppingCart, X, AlertTriangle } from "lucide-react";
import { medicineService, MedicineSearchResult } from "../services/medicineService";
import { pharmacyService } from "../services/pharmacyService";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cartService } from "../services/cartService";
import { useCartContext } from "../context/CartContext";

// ─── Shared timing types ──────────────────────────────────────────────────────
type DayTimings = { open: string; close: string };
type WeekTimings = {
  Sunday?:    DayTimings;
  Monday?:    DayTimings;
  Tuesday?:   DayTimings;
  Wednesday?: DayTimings;
  Thursday?:  DayTimings;
  Friday?:    DayTimings;
  Saturday?:  DayTimings;
};

const DAYS: (keyof WeekTimings)[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

// ─── Time helpers ─────────────────────────────────────────────────────────────
const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const nowMins = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const todayKey = (): keyof WeekTimings => DAYS[new Date().getDay()];

function getOpenStatus(timings: WeekTimings | null | undefined): { isOpen: boolean; open: string; close: string } | null {
  if (!timings) return null;
  const t = timings[todayKey()];
  if (!t) return null;
  return { isOpen: nowMins() >= toMins(t.open) && nowMins() < toMins(t.close), open: t.open, close: t.close };
}

function isOpenNow(t: DayTimings | undefined): boolean {
  if (!t) return false;
  return nowMins() >= toMins(t.open) && nowMins() < toMins(t.close);
}

// ─── Dosage-form label map ────────────────────────────────────────────────────
const DOSAGE_LABELS: Record<string, { packUnit: string; subUnit: string | null }> = {
  tablet:   { packUnit: "Strip",  subUnit: "Tablet"  },
  capsule:  { packUnit: "Strip",  subUnit: "Capsule" },
  syrup:    { packUnit: "Bottle", subUnit: null       },
  injection:{ packUnit: "Vial",   subUnit: null       },
  cream:    { packUnit: "Tube",   subUnit: null       },
  ointment: { packUnit: "Tube",   subUnit: null       },
  "cream/ointment":{ packUnit: "Tube",   subUnit: null},
  drops:    { packUnit: "Bottle", subUnit: null       },
  sachet:   { packUnit: "Box",    subUnit: "Sachet"  },
  gloves:   { packUnit: "Box",    subUnit: "Piece"   },
  mask:     { packUnit: "Box",    subUnit: "Piece"   },
};

function getDosageLabels(dosageForm?: string): { packUnit: string; subUnit: string | null } {
  const key = (dosageForm ?? "").toLowerCase().trim();
  return DOSAGE_LABELS[key] ?? { packUnit: "Unit", subUnit: "Sub-unit" };
}

// ─── Sub-Quantity Popup ───────────────────────────────────────────────────────
interface SubQtyPopupProps {
  medicine: MedicineSearchResult;
  maxStock: number;
  packUnit: string;
  subUnit: string;
  onConfirm: (qty: number, subQty: number) => void;
  onClose: () => void;
}

function SubQtyPopup({ medicine, maxStock, packUnit, subUnit, onConfirm, onClose }: SubQtyPopupProps) {
  const baseQty = medicine.stock?.baseQuantity ?? 1;
  const availableSubUnits = medicine.stock?.totalSubUnits ?? 0;
  const [qty, setQty]       = useState<number | null>(null);
  const [subQty, setSubQty] = useState<number | null>(null);

  const handleQtyAdd = () => setQty(1);
  const handleQtyDec = () => { if (qty !== null && qty > 0) setQty(qty - 1); };
  const handleQtyInc = () => { if (qty !== null && qty < maxStock) setQty(qty + 1); };

  const handleSubQtyAdd = () => {
    setSubQty(1);
    setQty((prev) => (prev === null ? 0 : prev));
  };

  const handleSubQtyDec = () => { if (subQty !== null && subQty > 0) setSubQty(subQty - 1); };
const handleSubQtyInc = () => {
  if (subQty === null) return;
  const currentTotalSubUnits = (qty ?? 0) * baseQty + subQty;
  
  // Check if we've reached the total available sub-units
  if (currentTotalSubUnits >= availableSubUnits) return;
  
  const next = subQty + 1;
  if (next >= baseQty) {
    setSubQty(0);
    setQty((prev) => Math.min(maxStock, (prev ?? 0) + 1));
  } else {
    setSubQty(next);
  }
};

  const effectiveQty    = qty ?? 0;
  const effectiveSubQty = subQty ?? 0;
  const canConfirm      = effectiveQty > 0 || effectiveSubQty > 0;

  const StepperRow = ({
    label,
    value,
    onAdd,
    onDec,
    onInc,
    decDisabled,
    incDisabled,
    addDisabled,
  }: {
    label: string;
    value: number | null;
    onAdd: () => void;
    onDec: () => void;
    onInc: () => void;
    decDisabled?: boolean;
    incDisabled?: boolean;
    addDisabled?: boolean;
  }) => (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 w-20 flex-shrink-0">{label}</span>
      {value === null ? (
        <button
          onClick={onAdd}
          disabled={addDisabled}
          className="flex-1 h-9 rounded-md border-2 border-[#123B6B] text-[#123B6B] text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      ) : (
        <div className="flex items-center border-2 border-[#123B6B] rounded-md overflow-hidden h-9 flex-1">
          <button
            className="flex-1 flex items-center justify-center text-[#123B6B] font-bold text-lg hover:bg-blue-50 h-full disabled:opacity-40 transition-colors"
            onClick={onDec}
            disabled={decDisabled}
          >-</button>
          <span className="flex-1 text-center font-semibold text-gray-800 text-sm select-none">{value}</span>
          <button
            className="flex-1 flex items-center justify-center text-[#123B6B] font-bold text-lg hover:bg-blue-50 h-full disabled:opacity-40 transition-colors"
            onClick={onInc}
            disabled={incDisabled}
          >+</button>
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-100 w-72 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
              {medicine.medicineName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Select quantity · 1 {packUnit.toLowerCase()} = {baseQty} {subUnit.toLowerCase()}s
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <StepperRow
            label={packUnit}
            value={qty}
            onAdd={handleQtyAdd}
            onDec={handleQtyDec}
            onInc={handleQtyInc}
            decDisabled={qty === null || qty <= 0}
            incDisabled={qty !== null && qty >= maxStock}
            // Disable adding full packs if none available
            addDisabled={maxStock <= 0}
          />
          <StepperRow
              label={subUnit}
              value={subQty}
              onAdd={handleSubQtyAdd}
              onDec={handleSubQtyDec}
              onInc={handleSubQtyInc}
              decDisabled={subQty === null || subQty <= 0}
              incDisabled={
                subQty !== null && 
                ((qty ?? 0) * baseQty + subQty >= availableSubUnits)
              }
              addDisabled={availableSubUnits <= 0}
            />
        </div>

        {/* Summary */}
        {canConfirm && (
          <p className="text-xs text-gray-500 text-center">
            Total: {effectiveQty} {packUnit.toLowerCase()}{effectiveQty !== 1 ? "s" : ""}
            {effectiveSubQty > 0
              ? ` + ${effectiveSubQty} ${subUnit.toLowerCase()}${effectiveSubQty !== 1 ? "s" : ""}`
              : ""}
          </p>
        )}

        <Button
          className="w-full bg-[#18477d] hover:bg-[#0f2a54] text-white text-sm h-9 disabled:opacity-50"
          onClick={() => canConfirm && onConfirm(effectiveQty, effectiveSubQty)}
          disabled={!canConfirm}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Add to Cart
        </Button>
      </div>
    </div>,
    document.body,
  );
}

// ─── Shared stepper UI ────────────────────────────────────────────────────────
interface StepperProps {
  productID: string;
  medicine: MedicineSearchResult;
  disabled?: boolean;
  maxStock?: number;
  onAdd: (medicine: MedicineSearchResult, quantity?: number, subQuantity?: number) => Promise<void>;
  onRemove: (medicine: MedicineSearchResult) => Promise<void>;
  quantities: Record<string, number>;
  variant?: "card" | "modal";
}

function Stepper({ productID, medicine, disabled, maxStock, onAdd, onRemove, quantities, variant = "card" }: StepperProps) {
  const qty    = quantities[productID] ?? 0;
  const atMax  = maxStock !== undefined && qty >= maxStock;
  const [addLoading, setAddLoading]           = useState(false);
  const [removeLoading, setRemoveLoading]     = useState(false);
  const [showSubQtyPopup, setShowSubQtyPopup] = useState(false);
  const anyLoading = addLoading || removeLoading;

  const isCard = variant === "card";
  const border = isCard ? "border-red-500"  : "border-[#123B6B]";
  const text   = isCard ? "text-red-500"    : "text-[#123B6B]";
  const hover  = isCard ? "hover:bg-red-50" : "hover:bg-blue-50";

  const { packUnit, subUnit } = getDosageLabels(medicine.category?.dosageForm);

  const doAdd = async (quantity = 1, subQuantity?: number) => {
    setAddLoading(true);
    try { await onAdd(medicine, quantity, subQuantity); } catch (e) { console.error("Add failed", e); }
    setAddLoading(false);
  };

const handleAddClick = async () => {
  if (disabled) return;

  let allowSub = medicine.stock?.allowSubQuantity;

  if (allowSub === undefined && medicine.pharmaID) {
    try {
      const full = await medicineService.getMedicineDetails(medicine.productID, medicine.pharmaID);
      allowSub = full.stock?.allowSubQuantity;
    } catch (e) {
      console.error("Failed to fetch medicine details:", e);
    }
  }

  if (allowSub && subUnit) {
    // Always open popup for sub-unit products
    setShowSubQtyPopup(true);
  } else {
    // For non-sub-unit products, respect atMax
    if (atMax) return; // ← Keep this check here for non-sub-unit items
    doAdd();
  }
};

  const handlePopupConfirm = async (quantity: number, subQuantity: number) => {
    setShowSubQtyPopup(false);
    await doAdd(quantity, subQuantity);
  };

  const handleRemove = async () => {
    setRemoveLoading(true);
    try { await onRemove(medicine); } catch (e) { console.error("Remove failed", e); }
    setRemoveLoading(false);
  };

  return (
    <>
      {showSubQtyPopup && subUnit && (
        <SubQtyPopup
          medicine={medicine}
          maxStock={maxStock ?? 0}
          packUnit={packUnit}
          subUnit={subUnit}
          onConfirm={handlePopupConfirm}
          onClose={() => setShowSubQtyPopup(false)}
        />
      )}

      {qty === 0 ? (
        isCard ? (
          <Button
            className="flex-1 bg-[#18477d] hover:bg-[#0f2a54] font-medium"
            disabled={disabled || anyLoading}
            onClick={handleAddClick}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {addLoading ? "Adding…" : "Add to cart"}
          </Button>
        ) : (
          <Button
            className="flex-1 bg-[#18477d] hover:bg-[#0f2a54] text-white"
            disabled={disabled || anyLoading}
            onClick={handleAddClick}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {addLoading ? "Adding…" : "Add to Cart"}
          </Button>
        )
      ) : (
        <div className={`flex-1 flex items-center justify-between border-2 ${border} rounded-md overflow-hidden h-10`}>
          <button
            onClick={handleRemove}
            disabled={anyLoading}
            className={`flex-1 flex items-center justify-center ${text} font-bold text-xl ${hover} transition-colors h-full disabled:opacity-40`}
          >
            {removeLoading ? "…" : "-"}
          </button>
          <span className={`flex-1 text-center font-semibold text-gray-800 text-base select-none ${anyLoading ? "opacity-50" : ""}`}>
            {qty}
          </span>
          <button
          onClick={handleAddClick}
          disabled={disabled || anyLoading}
          className={`flex-1 flex items-center justify-center ${text} font-bold text-xl ${hover} transition-colors h-full disabled:opacity-40`}
        >
          {addLoading ? "…" : "+"}
        </button>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const { pharmaID } = useParams<{ pharmaID?: string }>();
  const pharmacyInfoFetchedRef = useRef(false);
  const [searchTerm, setSearchTerm]     = useState("");
  const [category, setCategory]         = useState("ALL");
  const [sortBy, setSortBy]             = useState("name");
  const [medicines, setMedicines]       = useState<MedicineSearchResult[]>([]);
  const [loading, setLoading]           = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineSearchResult | null>(null);
  const [currentPage, setCurrentPage]   = useState(1);
  const cardsPerPage = 9;
  const { refetchCart, items } = useCartContext();

  const [quantities, setQuantities]       = useState<Record<string, number>>({});
  const [subQuantities, setSubQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!items) return;
    const syncedQty: Record<string, number> = {};
    const syncedSubQty: Record<string, number> = {};
    items.forEach((item: { productID: string; quantity: number; subQuantity?: number }) => {
      syncedQty[item.productID] = item.quantity;
      if (item.subQuantity != null) syncedSubQty[item.productID] = item.subQuantity;
    });
    setQuantities(syncedQty);
    setSubQuantities(syncedSubQty);
  }, [items]);

  const [pharmacyName, setPharmacyName]       = useState<string | null>(null);
  const [pharmacyAddress, setPharmacyAddress] = useState<string | null>(null);
  const [pharmacyTimings, setPharmacyTimings] = useState<WeekTimings | null>(null);

  const [alternates, setAlternates]               = useState<MedicineSearchResult[]>([]);
  const [alternatesLoading, setAlternatesLoading] = useState(false);

  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError]         = useState<string | null>(null);
  const wsRef               = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef  = useRef<NodeJS.Timeout | null>(null);

  const categories = [
    "ALL", "Prescription Medicines", "OTC Medicines", "Chronic Care Medicines",
    "Acute Care Medicines", "Supplements & Nutrition", "Topical Medicines",
    "Injectables & Vaccines", "Medical Devices", "Surgical & Consumables",
    "Personal Care & Wellness", "FMCG",
  ];

  const getAvailableStock = (m: MedicineSearchResult) =>
    m.availableStock ?? m.stock?.unitsAvailable ?? 0;

  const getAvailableSubUnits = (m: MedicineSearchResult) => {
    if (m.stock?.allowSubQuantity && m.stock.totalSubUnits != 0) {
      return m.stock.totalSubUnits;
    }
    return 0;
  };

  function formatDateTime(dateString: string | undefined) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const dd   = String(date.getDate()).padStart(2, "0");
    const mm   = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }


  const loadPharmacyInfo = async (id: string) => {
    if (pharmacyInfoFetchedRef.current) return;
    pharmacyInfoFetchedRef.current = true;
    const data = await pharmacyService.getPharmacyById(id);
    if (!data) return;
    if (data.name) setPharmacyName(data.name);
    if (data.address) {
      if (typeof data.address === "string") {
        setPharmacyAddress(data.address);
      } else {
        const parts = [
          data.address.line1, data.address.line2, data.address.city,
          data.address.state,
          data.address.pincode ?? data.address.postalCode ?? data.address.zip,
        ].filter(Boolean);
        setPharmacyAddress(parts.join(", ") || null);
      }
    }
    if (data.timings) setPharmacyTimings(data.timings as WeekTimings);
  };

  useEffect(() => {
    if (!pharmaID) return;
    loadPharmacyInfo(pharmaID);
  }, [pharmaID]);

  const applySort = (list: MedicineSearchResult[]) =>
    [...list].sort((a, b) =>
      sortBy === "price"
        ? (a.packaging?.price ?? 0) - (b.packaging?.price ?? 0)
        : a.medicineName.localeCompare(b.medicineName)
    );

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const results = await medicineService.searchMedicines({
        keyword: searchTerm, category, sortBy, sortOrder: "asc", pharmaID,
      });
      setMedicines(applySort(results));
      if (!pharmaID && results.length > 0 && results[0].pharmacy) {
        const p = results[0].pharmacy;
        if (p.name) setPharmacyName(p.name ?? null);
        if (p.address) setPharmacyAddress(p.address ?? null);
        if (results[0].pharmaID && !pharmacyTimings) {
          loadPharmacyInfo(results[0].pharmaID);
        } else if (p.timings) {
          setPharmacyTimings(p.timings as WeekTimings);
        }
      }
    } catch (error: any) {
      console.error("Search failed:", error);
      alert(error.message || "Failed to search medicines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMedicines(); setCurrentPage(1); }, [searchTerm, category]);
  useEffect(() => { if (medicines.length > 0) setMedicines(applySort(medicines)); }, [sortBy]);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) { setWsError("No authentication token"); startPolling(); return; }

        const envWsHost = import.meta.env.VITE_INVENTORY_SERVICE_WS;
        const wsUrl = envWsHost
          ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${envWsHost}/ws/stock?token=${encodeURIComponent(token)}`
          : `ws://localhost:5201/ws/stock?token=${encodeURIComponent(token)}`;

        const ws = new WebSocket(wsUrl);
        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) { ws.close(); setWsError("Connection timeout"); startPolling(); }
        }, 10000);

        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          setWsConnected(true); setWsError(null);
          if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
        };

        ws.onmessage = (event) => {
          try {
            const update = JSON.parse(event.data);
            if (update.type === "connection_established") return;

            if (update.type === "stock_update" || update.type === "product_update" || update.type === "product_created") {
              const {
                productID,
                availableStock,
                reservedStock,
                displayStock,
                expiryDate,
                stock,
              } = update.data;

              const patch: Partial<MedicineSearchResult> = {
                availableStock,
                reservedStock,
                ...(displayStock  && { displayStock }),
                ...(expiryDate    && { expiryDate }),
                ...(stock && { stock }),
              };

              setMedicines((prev) =>
                prev.map((m) =>
                  m.productID === productID
                    ? { ...m, ...patch, stock: stock ? { ...m.stock, ...stock } : m.stock } as MedicineSearchResult
                    : m
                )
              );
              setSelectedMedicine((prev) =>
                prev?.productID === productID
                  ? { ...prev, ...patch, stock: stock ? { ...prev.stock, ...stock } : prev.stock } as MedicineSearchResult
                  : prev
              );
            }
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onerror  = () => { setWsConnected(false); setWsError("Connection error"); };
        ws.onclose  = (event) => {
          clearTimeout(connectionTimeout);
          setWsConnected(false); wsRef.current = null;
          setWsError(event.code === 1008 ? "Authentication failed" : event.code === 1006 ? "Server offline" : `Disconnected (${event.code})`);
          startPolling();
          if (event.code !== 1008) reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        };
        wsRef.current = ws;
      } catch {
        setWsConnected(false); setWsError("Failed to initialize"); startPolling();
      }
    };

    connectWebSocket();
    return () => {
      wsRef.current?.close(); wsRef.current = null;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const startPolling = () => {
    if (pollingIntervalRef.current) return;
    pollingIntervalRef.current = setInterval(() => {
      if (!document.hidden && !wsConnected) fetchMedicines();
    }, 30000);
  };

  useEffect(() => {
    const handleVisibilityChange = () => { if (!document.hidden && !wsConnected) fetchMedicines(); };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [wsConnected]);

  // ── Cart: add ──────────────────────────────────────────────────────────────
  const handleAddToCart = async (
    medicine: MedicineSearchResult,
    quantity = 1,
    subQuantity?: number,
  ) => {
    const available = getAvailableStock(medicine);
    const current   = quantities[medicine.productID] ?? 0;
    if (current >= available && !medicine.stock?.allowSubQuantity) return;

    if (!medicine.pharmaID) {
      alert("Unable to add to cart: Pharmacy information missing");
      return;
    }

    if (medicine.stock === undefined && medicine.pharmaID) {
      try {
        const full = await medicineService.getMedicineDetails(medicine.productID, medicine.pharmaID);
        setMedicines((prev) =>
          prev.map((m) => m.productID === medicine.productID ? { ...m, stock: full.stock } : m)
        );
      } catch (e) {
        // Non-fatal — proceed with add anyway
      }
    }

    const packDelta  = quantity > 0 ? quantity : 0;
    const subDelta   = subQuantity != null && subQuantity > 0 ? subQuantity : 0;
    const stepperDelta = packDelta > 0 ? packDelta : (subDelta > 0 ? 1 : 0);

    setQuantities((prev) => ({ ...prev, [medicine.productID]: current + stepperDelta }));
    if (subDelta > 0) {
      setSubQuantities((prev) => ({
        ...prev,
        [medicine.productID]: (prev[medicine.productID] ?? 0) + subDelta,
      }));
    }

    try {
      await cartService.addToCart({
        productID: medicine.productID,
        name: medicine.medicineName,
        batchCode: medicine.batchCode,
        price: medicine.packaging?.price ?? 0,
        quantity,
        ...(subQuantity !== undefined && subQuantity > 0 && { subQuantity }),
        ...(medicine.packaging?.pricePerUnit !== undefined && { pricePerUnit: medicine.packaging.pricePerUnit }),
        pharmaID: medicine.pharmaID,
        prescriptionRequired: medicine.prescriptionRequired || false,
      });
      await refetchCart();
    } catch (error) {
      console.error("Failed to add to cart:", error);
      setQuantities((prev) => ({
        ...prev,
        [medicine.productID]: Math.max(0, (prev[medicine.productID] ?? 0) - stepperDelta),
      }));
      if (subDelta > 0) {
        setSubQuantities((prev) => ({
          ...prev,
          [medicine.productID]: Math.max(0, (prev[medicine.productID] ?? 0) - subDelta),
        }));
      }
    }
  };

  // ── Cart: remove one ───────────────────────────────────────────────────────
  const handleRemoveFromCart = async (medicine: MedicineSearchResult) => {
    const current = quantities[medicine.productID] ?? 0;
    if (current <= 0) return;
    setQuantities((prev) => ({ ...prev, [medicine.productID]: Math.max(0, current - 1) }));
    try {
      if (current - 1 === 0) {
        await cartService.removeItem(medicine.productID);
        setSubQuantities((prev) => { const next = { ...prev }; delete next[medicine.productID]; return next; });
      } else {
        await cartService.updateQuantity(medicine.productID, current - 1);
      }
      await refetchCart();
    } catch (error) {
      console.error("Failed to remove from cart:", error);
      setQuantities((prev) => ({ ...prev, [medicine.productID]: current }));
    }
  };

  // ── Open "View Details" ────────────────────────────────────────────────────
  const handleViewDetails = async (medicine: MedicineSearchResult) => {
    setSelectedMedicine(medicine);
    setAlternates([]);

    if (!pharmacyTimings && medicine.pharmaID && !pharmacyInfoFetchedRef.current) {
      await loadPharmacyInfo(medicine.pharmaID);
    }

    if (medicine.pharmaID) {
      try {
        const full = await medicineService.getMedicineDetails(medicine.productID, medicine.pharmaID);
        const merged = { ...medicine, ...full, availableStock: medicine.availableStock };
        setSelectedMedicine(merged);
        setMedicines((prev) =>
          prev.map((m) => m.productID === medicine.productID ? { ...m, stock: full.stock } : m)
        );
      } catch (e) {
        console.error("Failed to fetch full medicine details:", e);
      }
    }

    if (medicine.composition) {
      setAlternatesLoading(true);
      try {
        const compositionKeyword = medicine.composition
          .replace(/\(.*?\)/g, "")
          .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)/gi, "")
          .replace(/\d+/g, "")
          .replace(/[^a-zA-Z\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join(" ");

        const results = await medicineService.searchMedicines({
          keyword: compositionKeyword, category: "ALL", sortBy: "name", sortOrder: "asc", pharmaID,
        });
        setAlternates(results.filter((m) => m.productID !== medicine.productID).slice(0, 6));
      } catch (e) {
        console.error("Failed to fetch alternates:", e);
      } finally {
        setAlternatesLoading(false);
      }
    }
  };

  const totalPages         = Math.ceil(medicines.length / cardsPerPage);
  const paginatedMedicines = medicines.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);
  const headerOpenStatus   = getOpenStatus(pharmacyTimings);
  const modalTimings: WeekTimings | null =
    pharmacyTimings ?? (selectedMedicine?.pharmacy?.timings as WeekTimings | undefined) ?? null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Search Medicines</h1>
        <div className="flex items-start justify-between gap-4">
          <div className="text-gray-600">
            {pharmacyName ? (
              <div className="space-y-1">
                <p>
                  Browsing inventory from{" "}
                  <span className="font-semibold text-[#1560b6]">{pharmacyName}</span>
                </p>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  {pharmacyAddress && (
                    <span className="flex items-center gap-1 text-gray-600">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-black" />
                      {pharmacyAddress}
                    </span>
                  )}
                  {headerOpenStatus ? (
                    <>
                      {pharmacyAddress && <span className="text-gray-400">•</span>}
                      <span className={`font-semibold ${headerOpenStatus.isOpen ? "text-green-600" : "text-red-600"}`}>
                        {headerOpenStatus.isOpen ? "Open" : "Closed"}
                      </span>
                    </>
                  ) : pharmacyTimings ? (
                    <>
                      {pharmacyAddress && <span className="text-gray-300">•</span>}
                      <span className="font-semibold text-red-600">Closed today</span>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <p>Find the medicines you need from trusted pharmacies.</p>
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

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <form
            onSubmit={(e) => { e.preventDefault(); fetchMedicines(); }}
            className="flex flex-col lg:flex-row gap-4 mb-6"
          >
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by medicine name or composition..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat === "ALL" ? "All Categories" : cat}</option>
                ))}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                <option value="name">Sort by Name</option>
                <option value="price">Sort by Price</option>
              </select>
              <Button type="submit" disabled={loading} className="bg-[#123B6B] hover:bg-[#0f2a54] text-white">
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </form>
          <div className="text-sm text-gray-600 mb-6">
            Found {medicines.length} medicines{totalPages > 1 && ` - Page ${currentPage} of ${totalPages}`}
          </div>
        </CardContent>
      </Card>

      {/* Medicine Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="text-lg text-gray-600">Searching medicines...</div>
          </div>
        ) : medicines.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-lg text-gray-600">No medicines found. Try adjusting your search.</div>
          </div>
        ) : (
          paginatedMedicines.map((medicine) => {
            const price             = medicine.packaging?.price ?? 0;
            const mrp               = medicine.packaging?.mrp ?? price;
            const discount          = medicine.packaging?.discountPercent;
            const availableStock    = getAvailableStock(medicine);
            const threshold         = medicine.stock?.threshold ?? 0;
            const isLowStock        = availableStock <= threshold && availableStock > 0;
           
            const availableSubUnits = getAvailableSubUnits(medicine);
            // Out of stock only if BOTH packs and sub-units are 0
            const isOutOfStock      = availableStock === 0 && availableSubUnits === 0;

            const { packUnit, subUnit } = getDosageLabels(medicine.category?.dosageForm);
            const showSub = !!(medicine.stock?.allowSubQuantity && subUnit);
            const packLabel =
            packUnit.toLowerCase() === "box"
                ? availableStock === 1 ? "box" : "boxes"
                : `${packUnit.toLowerCase()}${availableStock !== 1 ? "s" : ""}`;
            return (
              <Card key={medicine.productID} className="hover:shadow-lg transition-shadow overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative bg-white h-72 flex items-center justify-center border-b">
                    {medicine.productImageURL ? (
                      <img
                        src={medicine.productImageURL}
                        alt={medicine.medicineName}
                        className="h-full w-full object-contain p-4"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.innerHTML = '<div class="text-7xl">💊</div>';
                        }}
                      />
                    ) : (
                      <div className="text-7xl">💊</div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 text-base line-clamp-2 flex-1">{medicine.medicineName}</h3>
                      {isOutOfStock ? (
                        <span className="px-2 py-1 rounded-3xl text-xs font-medium bg-red-100 text-red-800 whitespace-nowrap flex-shrink-0">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2 py-1 rounded-3xl text-xs font-semibold bg-orange-100 text-orange-800 whitespace-nowrap flex-shrink-0">
                          Low Stock: {availableStock} {packLabel}
                          {showSub && availableSubUnits > 0 ? ` (${availableSubUnits} ${subUnit!.toLowerCase()}${availableSubUnits !== 1 ? "s" : ""})` : ""}
                        </span>
                      ) : availableStock === 0 && availableSubUnits > 0 ? (
                        // 0 packs but has loose sub-units
                        <span className="px-2 py-1 rounded-3xl text-xs font-semibold bg-orange-100 text-orange-800 whitespace-nowrap flex-shrink-0">
                          {availableSubUnits} {subUnit ? subUnit.toLowerCase() : "unit"}{availableSubUnits !== 1 ? "s" : ""} left
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-3xl text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap flex-shrink-0">
                          Available: {availableStock} {packLabel}
                          {showSub && availableSubUnits > 0 ? ` (${availableSubUnits} ${subUnit!.toLowerCase()}${availableSubUnits !== 1 ? "s" : ""})` : ""}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-600">
                      {medicine.packaging?.quantityDescription || "Standard pack"}
                      {medicine.packaging?.pricePerUnit && (
                        <>
                          {" | Price per unit: "}
                          <span className="font-semibold text-gray-800">
                            {"₹" + medicine.packaging.pricePerUnit.toFixed(2)}
                          </span>
                        </>
                      )}
                    </p>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">₹{price.toFixed(2)}</span>
                      {mrp > price && (
                        <>
                          <span className="text-sm text-gray-500 line-through">₹{mrp.toFixed(2)}</span>
                          <span className="text-sm font-semibold text-green-600">{discount}% off</span>
                        </>
                      )}
                    </div>

                    {medicine.prescriptionRequired && (
                      <div className="flex items-center gap-1 text-xs text-red-600">
                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-medium">Prescription Required</span>
                      </div>
                    )}

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
                      <Button variant="outline" className="px-4 text-sm" onClick={() => handleViewDetails(medicine)}>
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 p-4">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * cardsPerPage + 1} to{" "}
            {Math.min(currentPage * cardsPerPage, medicines.length)} of {medicines.length} medicines
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 rounded ${currentPage === page ? "bg-[#123B6B] text-white font-semibold" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                >
                  {page}
                </button>
              ))}
            </div>
            <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Medicine Details Modal */}
      {selectedMedicine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">

            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold">Medicine Details</h2>
              <button onClick={() => setSelectedMedicine(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Product Image */}
              <div className="flex justify-center items-center bg-white rounded-lg border p-4 w-3/4 min-w-60 mx-auto min-h-60">
                {selectedMedicine.productImageURL ? (
                  <img
                    src={selectedMedicine.productImageURL}
                    alt={selectedMedicine.medicineName}
                    className="max-h-96 w-auto object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement!.innerHTML = '<div class="text-7xl">💊</div>';
                    }}
                  />
                ) : (
                  <div className="text-7xl">💊</div>
                )}
              </div>

              {/* Medicine Information */}
              <div className="border-b pb-6">
                <h3 className="text-xl font-bold text-blue-800 mb-4">
                  {selectedMedicine.medicineName}
                  <p className="text-gray-600 text-sm pt-1 font-normal">{selectedMedicine.packaging?.quantityDescription}</p>
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Composition</p>
                    <p className="text-black font-semibold">{selectedMedicine.composition || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Category</p>
                    <p className="text-black font-semibold">{selectedMedicine.category?.primaryCategory || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Price</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-black font-semibold text-lg">₹{(selectedMedicine.packaging?.price ?? 0).toFixed(2)}</p>
                      {(() => {
                        const price    = selectedMedicine.packaging?.price ?? 0;
                        const mrp      = selectedMedicine.packaging?.mrp ?? price;
                        const discount = selectedMedicine.packaging?.discountPercent ?? 0;
                        return mrp > price ? (
                          <>
                            <span className="text-sm text-gray-500 line-through">₹{mrp.toFixed(2)}</span>
                            <span className="text-sm font-semibold text-green-600">{discount}% off</span>
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Stock Status</p>
                    {(() => {
                      const { packUnit, subUnit } = getDosageLabels(selectedMedicine.category?.dosageForm);
                      const stock  = getAvailableStock(selectedMedicine);
                      const subStk = getAvailableSubUnits(selectedMedicine);
                      const showSub = !!(selectedMedicine.stock?.allowSubQuantity && subUnit && subStk > 0);
                      return stock > 0 ? (
                        <p className="font-semibold text-green-600">
                          Available: {stock} {packUnit.toLowerCase()}{stock !== 1 ? "s" : ""}
                          {showSub ? ` (${subStk} ${subUnit!.toLowerCase()}${subStk !== 1 ? "s" : ""})` : ""}
                        </p>
                      ) : showSub ? (
                        <p className="font-semibold text-orange-600">
                          {subStk} {subUnit!.toLowerCase()}{subStk !== 1 ? "s" : ""} left
                        </p>
                      ) : (
                        <p className="font-semibold text-red-600">Out of Stock</p>
                      );
                    })()}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Manufacturer</p>
                    <p className="text-black">{selectedMedicine.manufacturer || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Manufactured Date</p>
                    <p className="text-black">{formatDateTime(selectedMedicine.manufacturedDate)}</p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2">
                   {selectedMedicine.expiryDate? (
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Expiry Date</p>
                    <p className="text-black">{formatDateTime(selectedMedicine.expiryDate)}</p>
                  </div>
                   ):
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Warranty</p>
                    <p className="text-black">{selectedMedicine.warranty || "N/A"}</p>
                  </div>
                   }
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Storage Condition</p>
                    <p className="text-black">{selectedMedicine.storageCondition || "N/A"}</p>
                  </div>
                </div>

                <div className="mb-4 text-justify">
                  <p className="text-sm text-gray-600 font-medium">Description</p>
                  <p className="text-black text-sm mt-2">{selectedMedicine.description || "No description available"}</p>
                </div>

                {selectedMedicine.prescriptionRequired && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="w-5 h-5" />
                      <div>
                        <p className="font-semibold text-sm">Prescription Required</p>
                        <p className="text-sm">This medicine requires a valid prescription to purchase</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pharmacy Information */}
              {selectedMedicine.pharmacy && (
                <div className="border-b pb-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">Pharmacy Information</h3>
                  <div className="space-y-3">

                    <div>
                      <p className="text-sm text-gray-600 font-medium">Pharmacy Name</p>
                      <p className="text-black ">{selectedMedicine.pharmacy.name}</p>
                    </div>

                      {selectedMedicine.pharmacy.phone && (
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Contact Number</p>
                        <p className="text-black">
                          <a href={`tel:${selectedMedicine.pharmacy.phone}`} className="text-blue-600 hover:underline">
                            {selectedMedicine.pharmacy.phone}
                          </a>
                        </p>
                      </div>
                    )}
                    {selectedMedicine.pharmacy.address && (
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Address</p>
                        <p className="text-black">{selectedMedicine.pharmacy.address}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm text-gray-600 font-medium mb-2">Opening Hours</p>
                      {modalTimings ? (
                        <div className="rounded-lg border overflow-hidden text-sm">
                          {DAYS.map((day) => {
                            const t       = modalTimings[day];
                            const isToday = day === todayKey();
                            const open    = isToday && isOpenNow(t);
                            return (
                              <div
                                key={day}
                                className={`flex items-center justify-between px-3 py-2 ${isToday ? "bg-blue-50 font-semibold" : "even:bg-gray-50"}`}
                              >
                                <span className={`flex items-center gap-2 ${isToday ? "text-blue-800" : "text-gray-700"}`}>
                                  {day}
                                  {isToday && (
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                      {open ? "Open now" : "Closed now"}
                                    </span>
                                  )}
                                </span>
                                <span className={isToday ? "text-blue-800" : "text-gray-600"}>
                                  {t ? `${t.open} - ${t.close}` : "Closed"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Timings not available</p>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* Alternate Medicines */}
              {selectedMedicine.composition && (
                <div className="border-b pb-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-3">Alternate Medicines/Products </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Based on composition: <span className="font-medium text-gray-700">{selectedMedicine.composition}</span>
                  </p>
                  {alternatesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      Searching for alternates...
                    </div>
                  ) : alternates.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No alternate medicines found.</p>
                  ) : (
                    <div className="space-y-2">
                      {alternates.map((alt) => {
                        const altPrice    = alt.packaging?.price ?? 0;
                        const altMrp      = alt.packaging?.mrp ?? altPrice;
                        const altDiscount = alt.packaging?.discountPercent ?? 0;
                        const altStock    = getAvailableStock(alt);
                        const { packUnit, subUnit } = getDosageLabels(alt.category?.dosageForm);
                        const altSubStock = getAvailableSubUnits(alt);

                        const showSub = !!(alt.stock?.allowSubQuantity && subUnit && altSubStock > 0);
                        return (
                          <div
                            key={alt.productID}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                            onClick={() => handleViewDetails(alt)}
                          >
                            <div className="w-12 h-12 flex-shrink-0 rounded-md border bg-white flex items-center justify-center overflow-hidden">
                              {alt.productImageURL ? (
                                <img
                                  src={alt.productImageURL}
                                  alt={alt.medicineName}
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl">💊</span>';
                                  }}
                                />
                              ) : (
                                <span className="text-2xl">💊</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-800">{alt.medicineName}</p>
                              <p className="text-xs text-gray-500 truncate">{alt.composition}</p>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-sm font-bold text-gray-800">₹{altPrice.toFixed(2)} <span className="line-through text-xs text-gray-400 font-normal">₹{altMrp.toFixed(2)}</span></span>
                                {altDiscount > 0 && <span className="text-xs text-green-600 font-medium">{altDiscount}% off</span>}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                             {altStock > 0 ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                  {altStock} {packUnit.toLowerCase()}
                                  {altStock !== 1 ? "s" : ""}
                                  {showSub
                                    ? ` (${altSubStock} ${subUnit!.toLowerCase()}${altSubStock !== 1 ? "s" : ""})`
                                    : ""}
                                </span>
                              ) : showSub ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                                  {altSubStock} {subUnit!.toLowerCase()}
                                  {altSubStock !== 1 ? "s" : ""} left
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                                  Out of Stock
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

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Stepper
                  productID={selectedMedicine.productID}
                  medicine={selectedMedicine}
                  disabled={getAvailableStock(selectedMedicine) === 0 && getAvailableSubUnits(selectedMedicine) === 0}
                  maxStock={getAvailableStock(selectedMedicine)}
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
      )}
    </div>
  );
}