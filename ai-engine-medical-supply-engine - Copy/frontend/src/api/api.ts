const API_BASE_URL = 'http://127.0.0.1:8000';
const inFlightRequests = new Map<string, Promise<unknown>>();

export const PROCUREMENT_STREAM_MARKERS = {
  thinking: '[THINKING]',
  finalJson: '[FINAL_JSON]',
} as const;

async function request<T>(path: string): Promise<T> {
  const existingRequest = inFlightRequests.get(path) as Promise<T> | undefined;
  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = fetch(`${API_BASE_URL}${path}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    })
    .finally(() => {
      inFlightRequests.delete(path);
    });

  inFlightRequests.set(path, requestPromise);
  return requestPromise;
}

async function sendJson<TResponse, TPayload>(
  path: string,
  method: 'POST',
  payload: TPayload,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<TResponse>;
}

export interface ForecastItem {
  medicine_id: string;
  medicine_name: string;
  history_months: number;
  last_observed_quantity: number;
  next_month_forecast: number;
}

export interface ForecastResponse {
  dataset: string;
  generated_at: string;
  total_medicines: number;
  forecasts: ForecastItem[];
}

export interface InventoryItem {
  medicine_id: string;
  medicine_name: string;
  forecast_quantity: number;
  current_stock: number;
  safety_stock: number;
  reorder_point: number;
  target_stock: number;
  reorder: boolean;
  order_quantity: number;
}

export interface InventoryDisplayItem {
  medicine: string;
  forecast_quantity: number;
  current_stock: number;
  safety_stock: number;
  reorder_point: number;
  target_stock: number;
  reorder: boolean;
  order_quantity: number;
}

export interface ReorderRequest {
  pharmacy_id: string;
  medicine_id: string;
  medicine_name: string;
  current_stock: number;
  required_stock: number;
  order_quantity: number;
  trigger_reason: string;
}

export interface InventoryResponse {
  dataset: string;
  generated_at: string;
  total_medicines: number;
  reorder_count: number;
  inventory: InventoryItem[];
  display_inventory: InventoryDisplayItem[];
  reorder_requests: ReorderRequest[];
}

export type ProcurementPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ProcurementReason = 'CRITICAL' | 'KNAPSACK' | 'SKIPPED';
export type ProcurementUrgencyLevel = 'CRITICAL' | 'URGENT' | 'SAFE';

export interface ProcurementMedicine {
  medicine_id: string;
  medicine_name: string;
  reorder: boolean;
  priority: ProcurementPriority;
  priority_score: number;
  is_critical: boolean;
  selected_for_order: boolean;
  order_cycle: number | null;
  reason: ProcurementReason;
  cost: number | null;
  order_quantity: number;
  distributor_id: string | null;
  distributor_name: string | null;
  lead_days: number | null;
  price_per_unit: number | null;
  forecast_quantity: number;
  average_demand: number;
  current_stock: number | null;
  reorder_point: number | null;
  daily_demand: number;
  days_to_stockout: number | null;
  safe_deadline_days: number | null;
  urgency_level: ProcurementUrgencyLevel;
  adjusted_cycle: number | null;
  trigger_reason: string | null;
  mongo_mapped: boolean;
}

export interface ProcurementCycleSummary {
  cycle: number;
  budget: number;
  used_budget: number;
  remaining_budget: number;
  selected_count: number;
  critical_selected_count: number;
}

export interface ProcurementResponse {
  pharmacy_id: string;
  monthly_budget: number;
  order_cycles: number;
  budget_per_cycle: number;
  decisions: ProcurementMedicine[];
  cycle_summaries: ProcurementCycleSummary[];
  total_cost_used: number;
  total_priority_achieved: number;
}

export interface OrderTaxBreakdown {
  gross: number;
  discount: number;
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  discountPercent: number;
  gstRate: number;
  hsnCode: string;
  mrpPerPack: number;
  taxBreakdown: OrderTaxBreakdown;
  productID_Dtb: string;
  productID_Phm: string;
}

export interface OrderPayload {
  orderid: string;
  pharmaid: string;
  distributorid: string;
  items: Record<string, OrderItem>;
  totalAmount: number;
}

export interface StoredOrder extends OrderPayload {
  fingerprint: string;
  created_at: string;
}

export interface OrdersResponse {
  orders: StoredOrder[];
}

export interface CreateOrderResponse {
  status: 'created' | 'duplicate';
  orderid: string;
  message: string;
  order: StoredOrder;
}

export function fetchForecast(): Promise<ForecastResponse> {
  return request<ForecastResponse>('/forecast');
}

export function fetchInventory(): Promise<InventoryResponse> {
  return request<InventoryResponse>('/inventory');
}

export function fetchProcurement(): Promise<ProcurementResponse> {
  return request<ProcurementResponse>('/procurement/data');
}

export interface UpdateProcurementConfigPayload {
  monthly_budget: number;
}

export function updateProcurementConfig(
  payload: UpdateProcurementConfigPayload,
): Promise<ProcurementResponse> {
  return sendJson<ProcurementResponse, UpdateProcurementConfigPayload>(
    '/procurement/config',
    'POST',
    payload,
  );
}

export function fetchOrders(): Promise<OrdersResponse> {
  return request<OrdersResponse>('/orders');
}

export function createOrder(
  order: OrderPayload,
): Promise<CreateOrderResponse> {
  return sendJson<CreateOrderResponse, OrderPayload>('/orders', 'POST', order);
}

export async function fetchProcurementStream(
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}/procurement`, {
    headers: {
      Accept: 'text/plain',
    },
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response;
}
