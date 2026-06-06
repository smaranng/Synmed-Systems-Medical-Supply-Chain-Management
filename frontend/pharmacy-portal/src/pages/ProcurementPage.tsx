import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  AlertCircle, ShoppingCart, RefreshCw, PackageX,
  ChevronDown, ChevronUp, CheckCircle2, Loader2, X, Sparkles, XCircle
} from 'lucide-react';
import { inventoryService, Medicine } from '../services/inventoryService';
import { medicineService, MedicineSearchResult } from '../services/medicineService';
import { distributorService } from '../services/distributorService';
import { cartService } from '../services/distributor_cartService';
import { useAuth } from '../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'high' | 'medium' | 'low';

interface ReorderItem {
  medicine: Medicine;
  priority: Priority;
  reason: string;
  unitsAvailable: number;
  threshold: number;
  aiOrderQuantity?: number;
  aiReorderPoint?: number;
  aiDistributorID?: string;
  daysToExpiry?: number;
}

// ─── Suggested Order JSON shape (from AI / manual input) ──────────────────────

interface TaxBreakdown {
  gross: number;
  discount: number;
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
}

interface SuggestedOrderItem {
  name: string;
  price: number;
  quantity: number;
  discountPercent: number;
  gstRate: number;
  hsnCode: string;
  mrpPerPack: number;
  taxBreakdown: TaxBreakdown;
  productID_Dtb: string;
  productID_Phm: string;
  totalAmount: { $numberDecimal: string } | number;
}

interface SuggestedOrder {
  _id?: { $oid: string } | string;
  orderNumber: string;
  pharmaID: string;
  distributorID: string;
  items: SuggestedOrderItem[];
  grandTotal: number;
}

interface SynmedProcaiConfig {
  monthlyBudget: number;
  ordersPerMonth: number;
  secondOrderDay: number;
}

interface FastApiDecision {
  medicine_id?: string | null;
  medicine_name: string;
  reorder: boolean;
  selected_for_order: boolean;
  order_cycle?: number | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  order_quantity: number;
  reorder_point: number | null;
  current_stock: number | null;
  price_per_unit: number | null;
  distributor_id: string | null;
  mongo_mapped?: boolean;
}

interface FastApiProcurementResponse {
  decisions: FastApiDecision[];
}

const PROC_AI_STARTED_KEY = 'procurement_ai_started';
const PROC_AI_STARTED_AT_KEY = 'procurement_ai_started_at';
const AI_SECTION_DELAY_MS = 10_000;
const PROCUREMENT_BRIDGE_PREFIX = 'SYNMED_PROCUREMENT_BRIDGE::';

// ─── Hardcoded suggested orders ───────────────────────────────────────────────
// TODO: Replace with a fetch from FastAPI endpoint, e.g.:
//   const res = await fetch('http://localhost:8000/api/suggested-orders?pharmaID=...');
//   const HARDCODED_SUGGESTED_ORDERS: SuggestedOrder[] = await res.json();

const HARDCODED_SUGGESTED_ORDERS: SuggestedOrder[] = [
  {
    _id: { $oid: "69d0a6f85b2d41d8a43df1f2" },
    orderNumber: "ORD-1771842906405-1113",
    pharmaID: "PHM-697aae8fe53b28115f0251e2",
    distributorID: "DST-69789061da40d7dc08aadd79",
    items: [
      {
        productID_Dtb: "PRD-697d7900012",
        productID_Phm: "PRD-6971e200012",
        name: "Crocin 650",
        price: 20,
        quantity: 829,
        discountPercent: 33,
        gstRate: 12,
        hsnCode: "3004",
        mrpPerPack: 30,
        taxBreakdown: {
          gross: 480,
          discount: 33,
          taxable: 322,
          gst: 38.64,
          cgst: 19.32,
          sgst: 19.32,
        },
        totalAmount: 360.00,
      },
    ],
    grandTotal: 361.00
  },
  {
    _id: { $oid: "69d0a6f85b2d41d8a43df1f3" },
    orderNumber: "ORD-1771842906405-1114",
    pharmaID: "PHM-697aae8fe53b28115f0251e2",
    distributorID: "DST-69789061da40d7dc08aadd79",
    items: [
      {
        productID_Dtb: "PRD-697d7900007",
        productID_Phm: "PRD-6971e200007",
        name: "Losar 50 Tablet",
        price: 133.05,
        quantity: 344,
        discountPercent: 18,
        gstRate: 12,
        hsnCode: "3004",
        mrpPerPack: 162.25,
        taxBreakdown: {
          gross: 133.05,
          discount: 23.95,
          taxable: 109.10,
          gst: 13.09,
          cgst: 6.55,
          sgst: 6.55,
        },
        totalAmount: 122.19,
      },
    ],
    grandTotal: 122.19,
  },
  {
    _id: { $oid: "69d0a6f85b2d41d8a43df1f4" },
    orderNumber: "ORD-1771842906405-1115",
    pharmaID: "PHM-697aae8fe53b28115f0251e2",
    distributorID: "DST-69789061da40d7dc08aadd79",
    items: [
      {
        productID_Dtb: "PRD-697d7900003",
        productID_Phm: "PRD-6971e200003",
        name: "Taxim-O 200 Tablet",
        price: 102,
        quantity: 946,
        discountPercent: 2,
        gstRate: 12,
        hsnCode: "3004",
        mrpPerPack: 104.43,
        taxBreakdown: {
          gross: 102,
          discount: 2.04,
          taxable: 99.96,
          gst: 12.00,
          cgst: 6.00,
          sgst: 6.00,
        },
        totalAmount: 111.96,
      },
    ],
    grandTotal: 111.96,
  },
  {
    _id: { $oid: "69d0a6f85b2d41d8a43df1f5" },
    orderNumber: "ORD-1771842906405-1116",
    pharmaID: "PHM-697aae8fe53b28115f0251e2",
    distributorID: "DST-69789061da40d7dc08aadd79",
    items: [
      {
        productID_Dtb: "PRD-697d7900016",
        productID_Phm: "PRD-6971e200024",
        name: "Montek-10",
        price: 1160,
        quantity: 596,
        discountPercent: 0,
        gstRate: 12,
        hsnCode: "3004",
        mrpPerPack: 1178.5,
        taxBreakdown: {
          gross: 1160,
          discount: 0,
          taxable: 1160,
          gst: 139.20,
          cgst: 69.60,
          sgst: 69.60,
        },
        totalAmount: 1299.20,
      },
    ],
    grandTotal: 1299.20,
  },
  {
    _id: { $oid: "69d0a6f85b2d41d8a43df1f6" },
    orderNumber: "ORD-1771842906405-1117",
    pharmaID: "PHM-697aae8fe53b28115f0251e2",
    distributorID: "DST-69789061da40d7dc08aadd79",
    items: [
      {
        productID_Dtb: "PRD-697d7900010",
        productID_Phm: "PRD-6971e200010",
        name: "Levoquin 500mg Tablet",
        price: 42.47,
        quantity: 334,
        discountPercent: 10,
        gstRate: 12,
        hsnCode: "3004",
        mrpPerPack: 47.19,
        taxBreakdown: {
          gross: 42.47,
          discount: 4.25,
          taxable: 38.22,
          gst: 4.59,
          cgst: 2.29,
          sgst: 2.29,
        },
        totalAmount: 42.81,
      },
    ],
    grandTotal: 42.81,
  },
  {
    _id: { $oid: "69d0a6f85b2d41d8a43df1f7" },
    orderNumber: "ORD-1771842906405-1118",
    pharmaID: "PHM-697aae8fe53b28115f0251e2",
    distributorID: "DST-69789061da40d7dc08aadd79",
    items: [
      {
        productID_Dtb: "PRD-697d7900005",
        productID_Phm: "PRD-6971e200005",
        name: "Telma 40 Tablet",
        price: 180.96,
        quantity: 613,
        discountPercent: 15,
        gstRate: 12,
        hsnCode: "3004",
        mrpPerPack: 212.90,
        taxBreakdown: {
          gross: 180.96,
          discount: 27.14,
          taxable: 153.82,
          gst: 18.46,
          cgst: 9.23,
          sgst: 9.23,
        },
        totalAmount: 172.28,
      },
    ],
    grandTotal: 172.28,
  },
];

// ─── Priority Logic ───────────────────────────────────────────────────────────

function getPriority(unitsAvailable: number, threshold: number): Priority {
  if (unitsAvailable < 10) return 'high';
  if (unitsAvailable <= threshold) return 'medium';
  return 'low';
}

function getDaysToExpiry(expiryDate?: string): number | undefined {
  if (!expiryDate) return undefined;
  const expiry = new Date(expiryDate);
  const today = new Date();
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const EXPIRING_SOON_DAYS = 90;

function buildReorderItems(medicines: Medicine[]): ReorderItem[] {
  const items: ReorderItem[] = [];

  for (const med of medicines) {
    const raw = med as any;
    const unitsAvailable: number =
      med.stock?.unitsAvailable ?? raw.unitsAvailable ?? med.availableStock ?? raw.quantity ?? 0;
    const threshold: number =
      med.stock?.threshold ?? raw.threshold ?? raw.reorderLevel ?? raw.minStock ?? 0;
    const daysToExpiry = getDaysToExpiry(med.expiryDate);

    const isLowStock =
      unitsAvailable < 10 ||
      unitsAvailable < threshold ||
      (threshold > 0 && unitsAvailable < threshold + 10);
    const isExpiringSoon =
      daysToExpiry !== undefined && daysToExpiry > 0 && daysToExpiry <= EXPIRING_SOON_DAYS;

    if (!isLowStock && !isExpiringSoon) continue;

    const priority = getPriority(unitsAvailable, threshold);
    const reason =
      isLowStock && isExpiringSoon ? 'both'
      : isLowStock ? 'low_stock'
      : 'expiring_soon';

    items.push({ medicine: med, priority, reason, unitsAvailable, threshold, daysToExpiry });
  }

  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) =>
    order[a.priority] - order[b.priority] || a.unitsAvailable - b.unitsAvailable
  );
  return items;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTotal(t: { $numberDecimal: string } | number): number {
  return typeof t === 'number' ? t : parseFloat(t.$numberDecimal);
}

function mergeSuggestedOrders(baseOrders: SuggestedOrder[], nextOrders: SuggestedOrder[]): SuggestedOrder[] {
  const mergedOrders = [...baseOrders.map((order) => ({ ...order, items: [...order.items] }))];
  const itemIndex = new Map<string, { orderIndex: number; itemIndex: number }>();

  mergedOrders.forEach((order, orderIndex) => {
    order.items.forEach((item, itemIndexValue) => {
      itemIndex.set(normalizeText(item.name), {
        orderIndex,
        itemIndex: itemIndexValue,
      });
    });
  });

  for (const order of nextOrders) {
    for (const item of order.items) {
      const normalizedName = normalizeText(item.name);
      const existingLocation = itemIndex.get(normalizedName);

      if (existingLocation) {
        mergedOrders[existingLocation.orderIndex].items[existingLocation.itemIndex] = item;
        continue;
      }

      const matchingOrder = mergedOrders.find(
        (existingOrder) =>
          normalizeText(existingOrder.distributorID) === normalizeText(order.distributorID) &&
          normalizeText(existingOrder.pharmaID) === normalizeText(order.pharmaID),
      );

      if (matchingOrder) {
        matchingOrder.items.push(item);
        itemIndex.set(normalizedName, {
          orderIndex: mergedOrders.indexOf(matchingOrder),
          itemIndex: matchingOrder.items.length - 1,
        });
        continue;
      }

      const newOrder: SuggestedOrder = {
        ...order,
        items: [item],
      };
      mergedOrders.push(newOrder);
      itemIndex.set(normalizedName, {
        orderIndex: mergedOrders.length - 1,
        itemIndex: 0,
      });
    }
  }

  return mergedOrders.filter((order) => order.items.length > 0);
}

function cloneOrderWithQuantity(order: SuggestedOrder, quantity: number): SuggestedOrder {
  const item = order.items[0];
  const qty = Math.max(1, Math.floor(quantity || item.quantity || 1));
  const price = Number(item.price);
  const discountPercent = Number(item.discountPercent ?? 0);
  const gstRate = Number(item.gstRate ?? 12);
  const gross = price * qty;
  const discount = Number(((gross * discountPercent) / 100).toFixed(2));
  const taxable = Number((gross - discount).toFixed(2));
  const gst = Number(((taxable * gstRate) / 100).toFixed(2));
  const cgst = Number((gst / 2).toFixed(2));
  const sgst = Number((gst / 2).toFixed(2));
  const totalAmount = Number((taxable + gst).toFixed(2));

  return {
    ...order,
    orderNumber: `AI-SINGLE-${Date.now()}`,
    items: [
      {
        ...item,
        quantity: qty,
        taxBreakdown: {
          gross: Number(gross.toFixed(2)),
          discount,
          taxable,
          gst,
          cgst,
          sgst,
        },
        totalAmount,
      },
    ],
    grandTotal: totalAmount,
  };
}

function resolveDate(d?: { $date: string } | string): string {
  if (!d) return '—';
  const raw = typeof d === 'string' ? d : d.$date;
  return new Date(raw).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolveLooseString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.$oid === 'string') return record.$oid;
    if (typeof record.id === 'string') return record.id;
    if (typeof record.distributorID === 'string') return record.distributorID;
  }

  return '';
}

function normalizeText(value?: unknown): string {
  return resolveLooseString(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findDistributorProductForMedicine(
  distributorProducts: MedicineSearchResult[],
  medicineName: string,
  composition?: string,
): MedicineSearchResult | undefined {
  const target = normalizeText(medicineName);
  if (!target) return undefined;
  const targetComposition = normalizeText(composition);

  const exact = distributorProducts.find(
    (product) => normalizeText(product.medicineName) === target,
  );
  if (exact) return exact;

  const variantMatch = distributorProducts.find((product) => {
    const candidate = normalizeText(product.medicineName);
    return candidate.startsWith(target) || target.startsWith(candidate);
  });
  if (variantMatch) return variantMatch;

  if (targetComposition) {
    const compositionMatch = distributorProducts.find(
      (product) => normalizeText(product.composition) === targetComposition,
    );
    if (compositionMatch) return compositionMatch;
  }

  return undefined;
}

function extractBridgeDecisionsFromWindowName(): FastApiDecision[] | null {
  if (!window.name || !window.name.startsWith(PROCUREMENT_BRIDGE_PREFIX)) {
    return null;
  }

  try {
    const encoded = window.name.slice(PROCUREMENT_BRIDGE_PREFIX.length);
    const parsed = JSON.parse(decodeURIComponent(encoded)) as { decisions?: FastApiDecision[] };
    window.name = '';
    return Array.isArray(parsed.decisions) ? parsed.decisions : null;
  } catch {
    window.name = '';
    return null;
  }
}

function toUiPriority(priority: FastApiDecision['priority']): Priority {
  if (priority === 'HIGH') return 'high';
  if (priority === 'MEDIUM') return 'medium';
  return 'low';
}

function mapFastApiToUi(
  medicines: Medicine[],
  decisions: FastApiDecision[],
  pharmaID: string,
  distributorID: string,
  distributorProducts: MedicineSearchResult[],
): {
  reorderItems: ReorderItem[];
  suggestedOrders: SuggestedOrder[];
  cycleOneSuggestedOrder: SuggestedOrder | null;
} {
  const byName = new Map<string, Medicine>();
  for (const med of medicines) {
    byName.set(normalizeText(med.medicineName), med);
  }

  const dedupedDecisionMap = new Map<string, FastApiDecision>();
  for (const decision of decisions) {
    if (!decision.reorder) continue;

    const quantity = Math.max(0, Math.ceil(Number(decision.order_quantity || 0)));
    if (quantity <= 0) continue;

    const nameKey = normalizeText(decision.medicine_name);
    const idKey = normalizeText(decision.medicine_id || '');
    const key = nameKey || idKey;
    if (!key) continue;

    const existing = dedupedDecisionMap.get(key);
    if (!existing) {
      dedupedDecisionMap.set(key, decision);
      continue;
    }

    const existingQty = Math.max(0, Math.ceil(Number(existing.order_quantity || 0)));
    const currentQty = quantity;
    const existingSelected = Boolean(existing.selected_for_order);
    const currentSelected = Boolean(decision.selected_for_order);

    const shouldReplace =
      (currentSelected && !existingSelected)
      || (currentSelected === existingSelected && currentQty > existingQty)
      || (
        currentSelected === existingSelected
        && currentQty === existingQty
        && Boolean(decision.distributor_id)
        && !Boolean(existing.distributor_id)
      );

    if (shouldReplace) {
      dedupedDecisionMap.set(key, decision);
    }
  }

  const reorderItems: ReorderItem[] = [];
  const orderItems: SuggestedOrderItem[] = [];
  const cycleOneOrderItems: SuggestedOrderItem[] = [];
  const fallbackDistributorID = distributorID;

  for (const decision of dedupedDecisionMap.values()) {

    const matchedMedicine = byName.get(normalizeText(decision.medicine_name));
    const syntheticMedicine: Medicine = {
      productID: `AI-${normalizeText(decision.medicine_name) || 'unknown'}`,
      medicineName: decision.medicine_name,
      manufacturer: 'AI Suggested',
      stock: {
        unitsAvailable: Number(decision.current_stock ?? 0),
        threshold: Number(decision.reorder_point ?? 0),
      },
      packaging: {
        price: decision.price_per_unit ?? undefined,
        mrp: decision.price_per_unit ?? undefined,
        discountPercent: 0,
        gstRate: 12,
        hsnCode: '3004',
      },
    };
    const med = matchedMedicine ?? syntheticMedicine;

    const unitsAvailable = Number(
      decision.current_stock ?? med.stock?.unitsAvailable ?? med.availableStock ?? 0,
    );
    const threshold = Number(
      decision.reorder_point ?? med.stock?.threshold ?? 0,
    );
    const aiOrderQuantity = Math.max(1, Math.ceil(Number(decision.order_quantity || 0)));
    const aiDistributorID = resolveLooseString(decision.distributor_id);

    reorderItems.push({
      medicine: med,
      priority: toUiPriority(decision.priority),
      reason: 'low_stock',
      unitsAvailable,
      threshold,
      aiOrderQuantity,
      aiReorderPoint: threshold,
      aiDistributorID: aiDistributorID || undefined,
    });

    const price = Number(
      decision.price_per_unit ?? med.packaging?.price ?? med.packaging?.mrp ?? 0,
    );
    const quantity = aiOrderQuantity;
    const discountPercent = Number(med.packaging?.discountPercent ?? 0);
    const gstRate = Number(med.packaging?.gstRate ?? 12);
    const gross = price * quantity;
    const discount = (gross * discountPercent) / 100;
    const taxable = gross - discount;
    const gst = (taxable * gstRate) / 100;
    const cgst = gst / 2;
    const sgst = gst / 2;
    const lineTotal = taxable + gst;

    // Order placement still requires real pharmacy/distributor product IDs.
    if (!matchedMedicine) {
      continue;
    }

    const distributorProduct = findDistributorProductForMedicine(
      distributorProducts,
      matchedMedicine.medicineName,
      matchedMedicine.composition,
    );
    if (!distributorProduct?.productID) {
      continue;
    }

    orderItems.push({
      productID_Phm: matchedMedicine.productID,
      productID_Dtb: distributorProduct.productID,
      name: matchedMedicine.medicineName,
      quantity,
      price,
      discountPercent: Number(matchedMedicine.packaging?.discountPercent ?? discountPercent),
      gstRate: Number(matchedMedicine.packaging?.gstRate ?? gstRate),
      hsnCode: matchedMedicine.packaging?.hsnCode ?? '3004',
      mrpPerPack: Number(matchedMedicine.packaging?.mrp ?? price),
      taxBreakdown: {
        gross: Number(gross.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        taxable: Number(taxable.toFixed(2)),
        gst: Number(gst.toFixed(2)),
        cgst: Number(cgst.toFixed(2)),
        sgst: Number(sgst.toFixed(2)),
      },
      totalAmount: Number(lineTotal.toFixed(2)),
    });

    if (decision.selected_for_order && Number(decision.order_cycle) === 1) {
      cycleOneOrderItems.push({
        productID_Phm: matchedMedicine.productID,
        productID_Dtb: distributorProduct.productID,
        name: matchedMedicine.medicineName,
        quantity,
        price,
        discountPercent: Number(matchedMedicine.packaging?.discountPercent ?? discountPercent),
        gstRate: Number(matchedMedicine.packaging?.gstRate ?? gstRate),
        hsnCode: matchedMedicine.packaging?.hsnCode ?? '3004',
        mrpPerPack: Number(matchedMedicine.packaging?.mrp ?? price),
        taxBreakdown: {
          gross: Number(gross.toFixed(2)),
          discount: Number(discount.toFixed(2)),
          taxable: Number(taxable.toFixed(2)),
          gst: Number(gst.toFixed(2)),
          cgst: Number(cgst.toFixed(2)),
          sgst: Number(sgst.toFixed(2)),
        },
        totalAmount: Number(lineTotal.toFixed(2)),
      });
    }
  }

  const suggestedOrders: SuggestedOrder[] = orderItems.length
    ? [{
        orderNumber: `AI-${Date.now()}`,
        pharmaID,
        distributorID: fallbackDistributorID,
        items: orderItems,
        grandTotal: Number(orderItems.reduce((sum, it) => sum + resolveTotal(it.totalAmount), 0).toFixed(2)),
      }]
    : [];

  const cycleOneSuggestedOrder: SuggestedOrder | null = cycleOneOrderItems.length
    ? {
        orderNumber: `AI-CYCLE-1-${Date.now()}`,
        pharmaID,
        distributorID: fallbackDistributorID,
        items: cycleOneOrderItems,
        grandTotal: Number(
          cycleOneOrderItems.reduce((sum, it) => sum + resolveTotal(it.totalAmount), 0).toFixed(2),
        ),
      }
    : null;

  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  reorderItems.sort((a, b) => order[a.priority] - order[b.priority]);

  return { reorderItems, suggestedOrders, cycleOneSuggestedOrder };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { label: string; badgeVariant: string; rowBg: string; rowBorder: string }> = {
  high:   { label: 'High',   badgeVariant: 'destructive', rowBg: 'bg-red-50',    rowBorder: 'border-red-200'    },
  medium: { label: 'Medium', badgeVariant: 'warning',     rowBg: 'bg-yellow-50', rowBorder: 'border-yellow-200' },
  low:    { label: 'Low',    badgeVariant: 'secondary',   rowBg: 'bg-blue-50',   rowBorder: 'border-blue-100'   },
};

function ReasonBadge({ reason, daysToExpiry }: { reason: string; daysToExpiry?: number }) {
  if (reason === 'both')
    return <span className="text-xs font-medium text-orange-600">⚠ Low stock &amp; expiring in {daysToExpiry}d</span>;
  if (reason === 'expiring_soon')
    return <span className="text-xs font-medium text-orange-500">🕒 Expiring in {daysToExpiry} day{daysToExpiry === 1 ? '' : 's'}</span>;
  return <span className="text-xs font-medium text-red-500">📦 Low stock</span>;
}

// ─── Suggested Order Card (display only — no individual confirm button) ────────

interface SuggestedOrderCardProps {
  order: SuggestedOrder;
  confirmed: boolean;
  onOrderNow?: () => void;
}

function SuggestedOrderCard({ order, confirmed, onOrderNow }: SuggestedOrderCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [distributorName, setDistributorName] = useState<string | null>(null);

  useEffect(() => {
    if (!order.distributorID) return;
    distributorService.getDistributorById(order.distributorID).then(d => {
      setDistributorName(d?.companyName ?? d?.name ?? null);
    });
  }, [order.distributorID]);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${confirmed ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
      {/* Header row */}
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {confirmed
            ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            : <ShoppingCart className="w-4 h-4 text-gray-400 shrink-0" />
          }
          <span className="font-semibold text-gray-800 text-sm truncate">{order.orderNumber}</span>
          <span className="text-xs text-gray-400 hidden sm:inline shrink-0">
            · {distributorName ?? order.distributorID}
          </span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-gray-900 text-sm">₹{order.grandTotal.toFixed(2)}</span>
          {onOrderNow && !confirmed && (
            <Button
              variant="default"
              size="sm"
              className="h-8 px-3"
              onClick={(event) => {
                event.stopPropagation();
                onOrderNow();
              }}
            >
              Order Now
            </Button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-100 border-b border-emerald-200">
                  <th className="text-left px-5 py-2.5 font-semibold text-emerald-900 text-xs">Medicine</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-emerald-900 text-xs">Qty to Order</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-emerald-900 text-xs">Price/Pack</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-emerald-900 text-xs">Discount</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-emerald-900 text-xs">GST</th>
                  <th className="text-right px-5 py-2.5 font-semibold text-emerald-900 text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr
                    key={i}
                    className={`border-b border-emerald-100 hover:bg-emerald-50/70 ${i % 2 === 0 ? 'bg-emerald-50/40' : 'bg-white'}`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">HSN: {item.hsnCode} · MRP ₹{item.mrpPerPack}/pack</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">₹{item.price}</td>
                    <td className="px-4 py-3 text-right text-green-600">{item.discountPercent}%</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.gstRate}%</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      ₹{resolveTotal(item.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tax summary */}
          {order.items[0]?.taxBreakdown && (
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
              <span>Gross: <strong className="text-gray-700">₹{order.items[0].taxBreakdown.gross}</strong></span>
              <span>Discount: <strong className="text-green-600">−₹{order.items[0].taxBreakdown.discount}</strong></span>
              <span>Taxable: <strong className="text-gray-700">₹{order.items[0].taxBreakdown.taxable}</strong></span>
              <span>CGST: <strong className="text-gray-700">₹{order.items[0].taxBreakdown.cgst}</strong></span>
              <span>SGST: <strong className="text-gray-700">₹{order.items[0].taxBreakdown.sgst}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ProcurementPageProps {
  /**
   * AI-generated suggested orders for high-priority items.
   * TODO: Remove prop entirely once fetched directly from FastAPI inside this component.
   */
  suggestedOrders?: SuggestedOrder[];
}

export default function ProcurementPage({ suggestedOrders = HARDCODED_SUGGESTED_ORDERS }: ProcurementPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const pharmaID = user?.pharmaID;
  const [procurementConfig] = useState<SynmedProcaiConfig | null>(null);
  const [distributorName] = useState<string>('No Preference (AI Decides)');

  const [reorderItems, setReorderItems] = useState<ReorderItem[]>([]);
  const [aiSuggestedOrders, setAiSuggestedOrders] = useState<SuggestedOrder[]>([]);
  const [cycleOneSuggestedOrder, setCycleOneSuggestedOrder] = useState<SuggestedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Shared "Order All" state ───────────────────────────────────────────────
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [placedMedicineNames, setPlacedMedicineNames] = useState<Set<string>>(new Set());
  const [incomingBridgeDecisions, setIncomingBridgeDecisions] = useState<FastApiDecision[] | null>(null);
  const [defaultDistributorID, setDefaultDistributorID] = useState<string>('');
  const [bulkOrderConfirmOpen, setBulkOrderConfirmOpen] = useState(false);
  const [bulkOrderToConfirm, setBulkOrderToConfirm] = useState<ReorderItem[]>([]);
  const [bulkOrderingInProgress, setBulkOrderingInProgress] = useState(false);
  const [bulkOrderSliderValue, setBulkOrderSliderValue] = useState(0);
  const [bulkOrderShowSuccess, setBulkOrderShowSuccess] = useState(false);
  const [bulkOrderError, setBulkOrderError] = useState<string | null>(null);
  const [bulkOrderFailedMedicines, setBulkOrderFailedMedicines] = useState<string[]>([]);
  const [isLaunchingAi, setIsLaunchingAi] = useState(false);
  const [aiSectionsReady, setAiSectionsReady] = useState(false);
// AFTER — clear stale session flags older than 30 minutes
const [hasStartedAi, setHasStartedAi] = useState<boolean>(() => {
  try {
    const started = sessionStorage.getItem(PROC_AI_STARTED_KEY) === 'true';
    if (!started) return false;
    // If the session was started more than 30 min ago, treat it as fresh
    const startedAt = Number(sessionStorage.getItem(PROC_AI_STARTED_AT_KEY) ?? '0');
    const age = Date.now() - startedAt;
    if (age > 30 * 60 * 1000) {
      sessionStorage.removeItem(PROC_AI_STARTED_KEY);
      sessionStorage.removeItem(PROC_AI_STARTED_AT_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
});
  const handleStartAi = () => {
    try {
      sessionStorage.setItem(PROC_AI_STARTED_KEY, 'true');
      sessionStorage.setItem(PROC_AI_STARTED_AT_KEY, String(Date.now()));
    } catch {
      // Ignore storage failures and still continue the in-page countdown.
    }
    setHasStartedAi(true);
    setAiSectionsReady(false);
    setLoading(true);
    setIsLaunchingAi(true);
    window.setTimeout(() => {
      window.location.href = 'http://localhost:5173';
    }, 250);
  };

  useEffect(() => {
    const bridgeDecisions = extractBridgeDecisionsFromWindowName();
    if (!bridgeDecisions || bridgeDecisions.length === 0) {
      return;
    }

    setIncomingBridgeDecisions(bridgeDecisions);
    setHasStartedAi(true);
    try {
      sessionStorage.setItem(PROC_AI_STARTED_KEY, 'true');
      if (!sessionStorage.getItem(PROC_AI_STARTED_AT_KEY)) {
        sessionStorage.setItem(PROC_AI_STARTED_AT_KEY, String(Date.now()));
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    if (!hasStartedAi) {
      setAiSectionsReady(false);
      return;
    }

    let startedAt = Date.now();
    try {
      const stored = sessionStorage.getItem(PROC_AI_STARTED_AT_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed) && parsed > 0) {
          startedAt = parsed;
        }
      } else {
        sessionStorage.setItem(PROC_AI_STARTED_AT_KEY, String(startedAt));
      }
    } catch {
      // Ignore storage failures.
    }

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(AI_SECTION_DELAY_MS - elapsed, 0);

    if (remaining === 0) {
      setAiSectionsReady(true);
      return;
    }

    setAiSectionsReady(false);
    const timeoutId = window.setTimeout(() => {
      setAiSectionsReady(true);
    }, remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasStartedAi]);

  // ── Bulk order success slider animation ──
  useEffect(() => {
    if (!bulkOrderShowSuccess || bulkOrderSliderValue < 0 || bulkOrderSliderValue >= 100) return;

    const interval = setInterval(() => {
      setBulkOrderSliderValue((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + 5;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        return next;
      });
    }, 75);

    return () => clearInterval(interval);
  }, [bulkOrderShowSuccess, bulkOrderSliderValue]);

  const findSingleOrderForMedicine = (medicineName: string): SuggestedOrder | null => {
    for (const order of aiSuggestedOrders) {
      const match = order.items.find(
        (it) => normalizeText(it.name) === normalizeText(medicineName),
      );
      if (match) {
        return {
          orderNumber: `AI-SINGLE-${Date.now()}`,
          pharmaID: pharmaID ?? order.pharmaID,
          distributorID: order.distributorID,
          items: [match],
          grandTotal: Number(resolveTotal(match.totalAmount).toFixed(2)),
        };
      }
    }
    return null;
  };

  const buildSingleOrderFromReorderItem = async (
    reorderItem: ReorderItem,
  ): Promise<SuggestedOrder | null> => {
    const existing = findSingleOrderForMedicine(reorderItem.medicine.medicineName);
    if (existing) {
      return cloneOrderWithQuantity(existing, reorderItem.aiOrderQuantity ?? existing.items[0]?.quantity ?? 1);
    }

    const matchedMedicine = reorderItem.medicine;
    if (!matchedMedicine?.productID || matchedMedicine.productID.startsWith('AI-')) {
      return null;
    }

    const distributorID = reorderItem.aiDistributorID || defaultDistributorID || HARDCODED_SUGGESTED_ORDERS[0]?.distributorID || '';
    
    const scopedProducts = distributorID
      ? await medicineService.searchMedicines({
          distributorID,
          keyword: matchedMedicine.medicineName,
        })
      : [];

    let distributorProduct = findDistributorProductForMedicine(
      scopedProducts,
      matchedMedicine.medicineName,
      matchedMedicine.composition,
    );

    // Fallback 1: search the same distributor without keyword (handles name variants).
    if (!distributorProduct && distributorID) {
      const scopedAllProducts = await medicineService.searchMedicines({
        distributorID,
      });

      distributorProduct = findDistributorProductForMedicine(
        scopedAllProducts,
        matchedMedicine.medicineName,
        matchedMedicine.composition,
      );
    }

    // Fallback 2: search globally and pick the closest product match.
    if (!distributorProduct) {
      const globalProducts = await medicineService.searchMedicines({
        keyword: matchedMedicine.medicineName,
      });

      distributorProduct = findDistributorProductForMedicine(
        globalProducts,
        matchedMedicine.medicineName,
        matchedMedicine.composition,
      );
    }

    if (!distributorProduct?.productID) {
      return null;
    }

    const resolvedDistributorID = distributorProduct.distributorID || distributorID;
    if (!resolvedDistributorID) {
      return null;
    }

    const quantity = Math.max(1, Number(reorderItem.aiOrderQuantity ?? 1));
    const price = Number(matchedMedicine.packaging?.price ?? matchedMedicine.packaging?.mrp ?? 0);
    const discountPercent = Number(matchedMedicine.packaging?.discountPercent ?? 0);
    const gstRate = Number(matchedMedicine.packaging?.gstRate ?? 12);
    const gross = price * quantity;
    const discount = (gross * discountPercent) / 100;
    const taxable = gross - discount;
    const gst = (taxable * gstRate) / 100;
    const cgst = gst / 2;
    const sgst = gst / 2;
    const totalAmount = Number((taxable + gst).toFixed(2));

    return {
      orderNumber: `AI-SINGLE-${Date.now()}`,
      pharmaID: pharmaID || HARDCODED_SUGGESTED_ORDERS[0]?.pharmaID || '',
      distributorID: resolvedDistributorID,
      items: [
        {
          productID_Phm: matchedMedicine.productID,
          productID_Dtb: distributorProduct.productID,
          name: matchedMedicine.medicineName,
          quantity,
          price,
          discountPercent,
          gstRate,
          hsnCode: matchedMedicine.packaging?.hsnCode ?? '3004',
          mrpPerPack: Number(matchedMedicine.packaging?.mrp ?? price),
          taxBreakdown: {
            gross: Number(gross.toFixed(2)),
            discount: Number(discount.toFixed(2)),
            taxable: Number(taxable.toFixed(2)),
            gst: Number(gst.toFixed(2)),
            cgst: Number(cgst.toFixed(2)),
            sgst: Number(sgst.toFixed(2)),
          },
          totalAmount,
        },
      ],
      grandTotal: totalAmount,
    };
  };

  const handleOrderNow = async (reorderItem: ReorderItem) => {
    setConfirmError(null);
    const singleOrder = await buildSingleOrderFromReorderItem(reorderItem);
    if (!singleOrder) {
      setConfirmError(
        `Order details are not available for ${reorderItem.medicine.medicineName}. Distributor mapping is missing.`,
      );
      return;
    }

    navigate('/dashboard/procurement/checkout', {
      state: {
        order: singleOrder,
      },
    });
  };

  const handleConfirmBulkOrder = async () => {
    setBulkOrderingInProgress(true);
    setBulkOrderError(null);
    const validOrders: SuggestedOrder[] = [];
    const failedMedicines: string[] = [];

    // Build all orders first
    for (const item of bulkOrderToConfirm) {
      try {
        const order = await buildSingleOrderFromReorderItem(item);
        if (order) {
          validOrders.push(order);
        } else {
          failedMedicines.push(item.medicine.medicineName);
        }
      } catch (err: any) {
        failedMedicines.push(item.medicine.medicineName);
      }
    }

    if (validOrders.length === 0) {
      setBulkOrderError('No valid orders could be created. Please try again.');
      setBulkOrderingInProgress(false);
      return;
    }

    const combinedItems = validOrders.flatMap((order) => order.items);
    const combinedOrder: SuggestedOrder = {
      orderNumber: `AI-${Date.now()}`,
      pharmaID: pharmaID ?? validOrders[0].pharmaID,
      distributorID: validOrders[0].distributorID,
      items: combinedItems,
      grandTotal: Number(combinedItems.reduce((sum, item) => sum + resolveTotal(item.totalAmount), 0).toFixed(2)),
    };

    setBulkOrderConfirmOpen(false);
    setBulkOrderingInProgress(false);

    navigate('/dashboard/procurement/checkout', {
      state: {
        order: combinedOrder,
      },
    });
  };

  const fetchAndFilter = async () => {
    if (!pharmaID) {
      setLoading(false);
      setError('Pharmacy ID is not available. Please log in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const medicines = await inventoryService.getInventory(pharmaID);
      let aiPayload: FastApiProcurementResponse = { decisions: [] };

      if (incomingBridgeDecisions && incomingBridgeDecisions.length > 0) {
        aiPayload = { decisions: incomingBridgeDecisions };
      } else {
        // Prefer the local FastAPI AI engine when it is available, but never fail the page if it is not.
        try {
          const aiRes = await fetch('http://127.0.0.1:8000/procurement/data');
          if (aiRes.ok) {
            aiPayload = (await aiRes.json()) as FastApiProcurementResponse;
          }
        } catch {
          aiPayload = { decisions: [] };
        }
      }
      const fallbackDistributorID = HARDCODED_SUGGESTED_ORDERS[0]?.distributorID ?? '';
      setDefaultDistributorID(fallbackDistributorID);
      const distributorProducts = fallbackDistributorID
        ? await medicineService.searchMedicines({ distributorID: fallbackDistributorID })
        : [];

      const mapped = mapFastApiToUi(
        medicines,
        aiPayload.decisions ?? [],
        pharmaID,
        fallbackDistributorID,
        distributorProducts,
      );

      if (mapped.reorderItems.length > 0) {
        setReorderItems(mapped.reorderItems);
      } else {
        setReorderItems(buildReorderItems(medicines));
      }

      if (mapped.suggestedOrders.length > 0) {
        setAiSuggestedOrders(mergeSuggestedOrders(suggestedOrders, mapped.suggestedOrders));
      } else {
        setAiSuggestedOrders(suggestedOrders);
      }
      setCycleOneSuggestedOrder(mapped.cycleOneSuggestedOrder);
    } catch (err: any) {
      try {
        const medicines = await inventoryService.getInventory(pharmaID);
        setReorderItems(buildReorderItems(medicines));
      } catch {
        // Keep original error if fallback fetch also fails.
      }
      setAiSuggestedOrders(suggestedOrders);
      setCycleOneSuggestedOrder(null);
      setError(err?.message ?? 'Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasStartedAi || !aiSectionsReady) {
      setLoading(false);
      return;
    }
    if (pharmaID) fetchAndFilter();
    else setLoading(false);
  }, [pharmaID, hasStartedAi, aiSectionsReady, incomingBridgeDecisions]);

  const showAiSections = hasStartedAi && aiSectionsReady;

  useEffect(() => {
    const state = (location.state as { placedMedicineNames?: string[] } | null) ?? null;
    const newlyPlaced = state?.placedMedicineNames ?? [];
    if (newlyPlaced.length === 0) return;

    setPlacedMedicineNames((prev) => {
      const next = new Set(prev);
      newlyPlaced.forEach((name) => next.add(normalizeText(name)));
      return next;
    });

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const buildCombinedSuggestedOrder = (): SuggestedOrder | null => {
    if (!aiSuggestedOrders.length) {
      return null;
    }

    const items = aiSuggestedOrders.flatMap((order) => order.items);
    if (items.length === 0) {
      return null;
    }

    return {
      orderNumber: `AI-${Date.now()}`,
      pharmaID: pharmaID ?? aiSuggestedOrders[0].pharmaID,
      distributorID: aiSuggestedOrders[0].distributorID,
      items,
      grandTotal: Number(
        items.reduce((sum, item) => sum + resolveTotal(item.totalAmount), 0).toFixed(2),
      ),
    };
  };

  const handleConfirmAllOrders = async () => {
    const combinedOrder = buildCombinedSuggestedOrder();
    if (!combinedOrder) {
      setConfirmError('No suggested orders are available to checkout.');
      return;
    }

    setConfirmError(null);
    navigate('/dashboard/procurement/checkout', {
      state: {
        order: combinedOrder,
      },
    });
  };

  const handleOrderForThisCycle = async () => {
    if (!cycleOneSuggestedOrder || cycleOneSuggestedOrder.items.length === 0) {
      setConfirmError('No cycle-1 medicines are available from AI procurement right now.');
      return;
    }

    setConfirmError(null);
    navigate('/dashboard/procurement/checkout', {
      state: {
        order: cycleOneSuggestedOrder,
      },
    });
  };

  const highCount = reorderItems.filter(i => i.priority === 'high').length;
  const medCount  = reorderItems.filter(i => i.priority === 'medium').length;
  const lowCount  = reorderItems.filter(i => i.priority === 'low').length;

  return (
    <div className="space-y-6">

      <style>{`
        @keyframes synmedprocai-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes synmedprocai-float {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(8px, -10px, 0) scale(1.05); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
      `}</style>

      <div
        className="rounded-2xl p-[3px] w-full"
        style={{
          background: 'linear-gradient(120deg, #0f4c81, #0ea5a8, #34d399, #0f4c81)',
          backgroundSize: '260% 260%',
          animation: 'synmedprocai-shift 10s ease infinite',
        }}
      >
        <Card className="rounded-2xl border-0 bg-white">
          <CardContent className="pt-6">
            <div
              className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white border border-cyan-200/40"
              style={{
                background: 'linear-gradient(120deg, #0f4c81, #0ea5a8, #34d399, #0f4c81)',
                backgroundSize: '260% 260%',
                animation: 'synmedprocai-shift 10s ease infinite',
              }}
            >
              <div className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-white/20 blur-2xl" style={{ animation: 'synmedprocai-float 5s ease-in-out infinite' }} />
              <div className="absolute -bottom-10 -left-8 w-36 h-36 rounded-full bg-cyan-100/30 blur-2xl" style={{ animation: 'synmedprocai-float 7s ease-in-out infinite' }} />

              <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5" />
                    Smart Procurement AI
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold leading-tight">SynmedProcAI</h3>
                  <p className="text-sm md:text-base text-cyan-50/95 leading-relaxed">
                    Smarter Medicine Procurement Starts Here.
                  </p>
                </div>

                <Button
                  size="sm"
                  className="self-start md:self-auto bg-white text-cyan-700 hover:bg-cyan-50 font-semibold"
                  onClick={handleStartAi}
                  disabled={isLaunchingAi || (hasStartedAi && !aiSectionsReady)}
                >
                  {isLaunchingAi
                    ? 'Opening AI...'
                    : hasStartedAi
                    ? aiSectionsReady
                      ? 'AI Ready'
                      : 'Preparing AI...'
                    : procurementConfig
                      ? 'Update Setup'
                      : 'Click Here To Get Started'}
                </Button>
              </div>
            </div>

            {procurementConfig ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-lg border-2 bg-gradient-to-br from-cyan-50 to-emerald-50 p-4" style={{ borderColor: 'rgba(14, 165, 168, 0.35)' }}>
                  <p className="text-xs font-medium text-cyan-700">Monthly Budget</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">INR {procurementConfig.monthlyBudget.toFixed(0)}</p>
                </div>
                <div className="rounded-lg border-2 bg-gradient-to-br from-cyan-50 to-emerald-50 p-4" style={{ borderColor: 'rgba(14, 165, 168, 0.35)' }}>
                  <p className="text-xs font-medium text-cyan-700">Order Cycle</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{procurementConfig.ordersPerMonth} Orders</p>
                  <p className="text-xs text-gray-600 mt-1">per month</p>
                </div>
                <div className="rounded-lg border-2 bg-gradient-to-br from-cyan-50 to-emerald-50 p-4" style={{ borderColor: 'rgba(14, 165, 168, 0.35)' }}>
                  <p className="text-xs font-medium text-cyan-700">Order Schedule</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-gray-900">1st: <span className="text-cyan-700">Auto on 1st</span></p>
                    <p className="text-sm font-semibold text-gray-900">2nd: <span className="text-cyan-700">{procurementConfig.secondOrderDay}th</span></p>
                  </div>
                </div>
                <div className="rounded-lg border-2 bg-gradient-to-br from-cyan-50 to-emerald-50 p-4" style={{ borderColor: 'rgba(14, 165, 168, 0.35)' }}>
                  <p className="text-xs font-medium text-cyan-700">Preferred Distributor</p>
                  <p className="text-sm font-semibold text-gray-900 mt-2 truncate">{distributorName}</p>
                </div>
              </div>
            ) : null}

            {/* ── Suggested Orders (AI-generated, high priority) ── */}
            {showAiSections && aiSuggestedOrders.length > 0 && (() => {
              const suggestedRows = aiSuggestedOrders.flatMap((order) => order.items);
              const suggestedGrandTotal = Number(
                suggestedRows.reduce((sum, item) => sum + resolveTotal(item.totalAmount), 0).toFixed(2),
              );
              return (
                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-cyan-500" />
                        <CardTitle
                          className="bg-gradient-to-r from-cyan-600 via-emerald-500 to-cyan-600 bg-clip-text text-transparent text-xl font-bold"
                          style={{ backgroundSize: '200% 200%', animation: 'synmedprocai-shift 10s ease infinite' }}
                        >
                          Suggested Orders
                        </CardTitle>
                        <Badge variant="destructive" className="text-xs">
                          {suggestedRows.length} Medicines
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">Medicine rows only, no order cards</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-emerald-100 border-b border-emerald-200">
                            <th className="text-left px-5 py-2.5 font-semibold text-emerald-900 text-xs">Medicine</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-emerald-900 text-xs">Qty</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-emerald-900 text-xs">Price</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-emerald-900 text-xs">Discount</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-emerald-900 text-xs">GST</th>
                            <th className="text-right px-5 py-2.5 font-semibold text-emerald-900 text-xs">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suggestedRows.map((item, index) => (
                            <tr key={`${item.productID_Phm}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-5 py-3">
                                <p className="font-medium text-gray-900">{item.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">HSN: {item.hsnCode} · MRP ₹{item.mrpPerPack}/pack</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700">₹{item.price}</td>
                              <td className="px-4 py-3 text-right text-green-600">{item.discountPercent}%</td>
                              <td className="px-4 py-3 text-right text-gray-600">{item.gstRate}%</td>
                              <td className="px-5 py-3 text-right font-semibold text-gray-900">₹{resolveTotal(item.totalAmount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-gray-500">{suggestedRows.length} medicine{suggestedRows.length !== 1 ? 's' : ''}</span>
                      <span className="font-semibold text-gray-800">Total: ₹{suggestedGrandTotal.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* ── AI Reorder Suggestions (inventory alerts) ── */}
            {showAiSections && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-cyan-500" />
                    <CardTitle
                      className="bg-gradient-to-r from-cyan-600 via-emerald-500 to-cyan-600 bg-clip-text text-transparent text-xl font-bold"
                      style={{ backgroundSize: '200% 200%', animation: 'synmedprocai-shift 10s ease infinite' }}
                    >
                      AI Reorder Suggestions
                    </CardTitle>
                    {!loading && reorderItems.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {highCount > 0 && <Badge variant="destructive">{highCount} High</Badge>}
                        {medCount  > 0 && <Badge variant="warning">{medCount} Medium</Badge>}
                        {lowCount  > 0 && <Badge variant="secondary">{lowCount} Low</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={fetchAndFilter} disabled={loading} className="flex items-center gap-1.5">
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'Refreshing…' : 'Refresh'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOrderForThisCycle}
                      disabled={loading || !cycleOneSuggestedOrder || cycleOneSuggestedOrder.items.length === 0}
                      className="flex items-center gap-1.5"
                    >
                      <ShoppingCart className="w-4 h-4" /> Order For This Cycle
                    </Button>
                    {reorderItems.length > 0 && !loading && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleConfirmAllOrders}
                        disabled={loading || reorderItems.every(item => placedMedicineNames.has(normalizeText(item.medicine.medicineName)))}
                        className="flex items-center gap-1.5"
                      >
                        <ShoppingCart className="w-4 h-4" /> Order All
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {loading && (
                  <div className="space-y-3">
                    {[1, 2, 3].map(n => <div key={n} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
                  </div>
                )}

                {!loading && error && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                  </div>
                )}

                {!loading && !error && reorderItems.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                    <PackageX className="w-8 h-8" />
                    <p className="text-sm font-medium">All stock levels look good!</p>
                    <p className="text-xs">No medicines need reordering right now.</p>
                  </div>
                )}

                {!loading && !error && reorderItems.length > 0 && (
                  <div className="space-y-3">
                    {reorderItems
                      .filter((item) => item.aiOrderQuantity !== undefined && item.aiOrderQuantity > 0)
                      .map((item) => {
                      const cfg = PRIORITY_CONFIG[item.priority];
                      const med = item.medicine;
                      const price = med.packaging?.price ?? med.packaging?.mrp;
                      const distributor = med.manufacturer ?? '—';
                      const isPlaced = placedMedicineNames.has(normalizeText(med.medicineName));

                      return (
                        <div
                          key={med.productID}
                          className={`flex items-center justify-between p-4 ${cfg.rowBg} border ${cfg.rowBorder} rounded-lg gap-4`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900 truncate">{med.medicineName}</h4>
                              <Badge variant={cfg.badgeVariant as any} className="text-xs shrink-0">
                                {cfg.label} Priority
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-gray-600">
                              <span>
                                Stock:{' '}
                                <strong className={item.unitsAvailable < 10 ? 'text-red-600' : 'text-gray-900'}>
                                  {item.unitsAvailable} units
                                </strong>
                              </span>
                              {item.threshold > 0 && (
                                <><span className="text-gray-300">•</span><span>Threshold: {item.threshold}</span></>
                              )}
                              {item.aiReorderPoint !== undefined && item.aiReorderPoint > 0 && (
                                <><span className="text-gray-300">•</span><span>Reorder Pt: {item.aiReorderPoint}</span></>
                              )}
                              {item.aiOrderQuantity !== undefined && item.aiOrderQuantity > 0 && (
                                <><span className="text-gray-300">•</span><span>AI Qty: {item.aiOrderQuantity}</span></>
                              )}
                              <span className="text-gray-300">•</span>
                              <span>Mfr: {distributor}</span>
                              {price !== undefined && (
                                <><span className="text-gray-300">•</span><span>₹{price}/unit</span></>
                              )}
                              <span className="text-gray-300">•</span>
                              <ReasonBadge reason={item.reason} daysToExpiry={item.daysToExpiry} />
                            </div>
                          </div>
                          {isPlaced ? (
                            <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-green-100 text-green-700 text-sm font-semibold">
                              <CheckCircle2 className="w-4 h-4" /> Order Placed
                            </span>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="shrink-0"
                              onClick={() => { void handleOrderNow(item); }}
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" /> Order Now
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </CardContent>
        </Card>

        {/* ── Bulk Order Confirmation Modal ── */}
        {bulkOrderConfirmOpen && !bulkOrderShowSuccess && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <CardHeader className="border-b">
                <CardTitle>Confirm Bulk Order</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-6">
                {bulkOrderError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {bulkOrderError}
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    You are about to order <strong>{bulkOrderToConfirm.length}</strong> medicines. Please review the details below:
                  </p>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Medicine</th>
                          <th className="px-4 py-2 text-right font-semibold">Qty</th>
                          <th className="px-4 py-2 text-right font-semibold">Price/Unit</th>
                          <th className="px-4 py-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkOrderToConfirm.map((item, idx) => {
                          const qty = item.aiOrderQuantity || 1;
                          const price = item.medicine.packaging?.price || item.medicine.packaging?.mrp || 0;
                          const total = qty * price;
                          return (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2">{item.medicine.medicineName}</td>
                              <td className="px-4 py-2 text-right">{qty}</td>
                              <td className="px-4 py-2 text-right">₹{price.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-semibold">₹{total.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-lg">Total Cost:</span>
                      <span className="font-bold text-2xl text-emerald-600">
                        ₹{bulkOrderToConfirm.reduce((sum, item) => {
                          const qty = item.aiOrderQuantity || 1;
                          const price = item.medicine.packaging?.price || item.medicine.packaging?.mrp || 0;
                          return sum + (qty * price);
                        }, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                    <div className="flex gap-2">
                      <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">Next Step:</p>
                        <p>Click "Yes, I Confirm" to place all these orders together.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="border-t bg-gray-50 p-4 flex gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setBulkOrderConfirmOpen(false)}
                  disabled={bulkOrderingInProgress}
                >
                  Cancel
                </Button>
                <Button 
                  variant="default"
                  onClick={handleConfirmBulkOrder}
                  disabled={bulkOrderingInProgress}
                  className="flex items-center gap-2"
                >
                  {bulkOrderingInProgress && <Loader2 className="w-4 h-4 animate-spin" />}
                  Yes, I Confirm
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ── Bulk Order Processing & Success Modal ── */}
        {bulkOrderShowSuccess && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
              {bulkOrderSliderValue >= 0 && bulkOrderSliderValue < 100 && (
                <div className="bg-white p-8 text-center space-y-6 animate-fade-in">
                  <div className="flex justify-center">
                    <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-green-600">Placing your orders...</h2>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bulkOrderSliderValue}
                    disabled
                    className="w-full h-3 rounded-lg appearance-none accent-green-600"
                    style={{ background: `linear-gradient(to right, #16a34a ${bulkOrderSliderValue}%, #e5e7eb ${bulkOrderSliderValue}%)` }}
                  />
                </div>
              )}

              {bulkOrderSliderValue === 100 && !bulkOrderError && (
                <div className="bg-green-600 p-8 text-white text-center space-y-6 animate-fade-in">
                  <CheckCircle2 className="w-12 h-12 mx-auto" strokeWidth={2} />
                  <h2 className="text-2xl font-bold">All Orders Confirmed!</h2>
                  <p className="text-sm opacity-90">{bulkOrderToConfirm.length} medicines have been successfully ordered.</p>
                  <button
                    onClick={() => {
                      setBulkOrderShowSuccess(false);
                      setBulkOrderConfirmOpen(false);
                      setBulkOrderSliderValue(0);
                      window.location.reload();
                    }}
                    className="mt-4 w-full bg-white text-green-600 font-bold py-3 rounded-lg hover:bg-gray-100 transition"
                  >
                    OK
                  </button>
                </div>
              )}

              {bulkOrderSliderValue === -1 || (bulkOrderSliderValue === 100 && bulkOrderError) && (
                <div className="bg-white p-8 text-center space-y-6 animate-fade-in">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-red-600" strokeWidth={2} />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-red-600">Order Failed</h2>
                  <p className="text-sm text-gray-700">{bulkOrderError ?? 'Unable to place orders'}</p>
                  <button
                    onClick={() => {
                      setBulkOrderShowSuccess(false);
                      setBulkOrderSliderValue(0);
                    }}
                    className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition"
                  >
                    Back to Confirmation
                  </button>
                </div>
              )}
            </div>

            <style>{`
              @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
              .animate-fade-in { animation: fadeIn 0.5s ease-in-out; }
            `}</style>
          </div>
        )}
      </div>

    </div>
  );
}