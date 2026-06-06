import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Driver, Delivery, DeliveryStatus } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────
// Update this to your server's LAN IP when testing on a physical device
export const API_URL = 'https://driver-app-1n62.onrender.com'; // ← fixed: was 5205, server.js runs on 5203

const TOKEN_KEY = 'driver_token';

export interface DriverVehicle {
  vehicleID: string;
  registrationNumber: string;
  vehicleType: string;
  capacity: number;
  fuelType: string;
  ownership: string;
  insuranceExpiry: string | null;
  permitExpiry: string | null;
  status: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(TOKEN_KEY, token); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── Authenticated fetch wrapper ──────────────────────────────────────────────
// Returns parsed JSON + the Response. Throws a readable error when the server
// returns HTML instead of JSON (wrong port / URL / proxy error).

async function authFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ res: Response; data: T }> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Guard: server returned HTML instead of JSON (wrong URL, proxy error, etc.)
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error(`[authFetch] Non-JSON response ${path} (${res.status}):`, text.slice(0, 300));
    throw new Error(
      `Server error (${res.status}). Check API_URL is correct and the server is running.`
    );
  }

  const data: T = await res.json();
  return { res, data };
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function loginDriver(
  username: string,
  password: string
): Promise<Driver> {
  const res = await fetch(`${API_URL}/auth/driver/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  // Guard non-JSON on login too
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('[loginDriver] Non-JSON response:', text.slice(0, 300));
    throw new Error(`Server error (${res.status}). Check API_URL and server status.`);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Login failed');
  await setToken(data.token);
  return data.user;
}

export async function fetchDriverVehicle(driverID: string): Promise<DriverVehicle | null> {
  const { res, data } = await authFetch<any>(`/driver/${driverID}/vehicle`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error((data as any).error ?? 'Failed to load vehicle');
  if ((data as any)?.ownership?.toLowerCase() !== 'driver') return null;
  return data as DriverVehicle;
}

export async function fetchDriverProfile(driverID: string): Promise<Driver> {
  const { res, data } = await authFetch<any>(`/driver/${driverID}`);
  if (!res.ok) throw new Error((data as any).error ?? 'Failed to load profile');
  return data as Driver;
}

export async function changePassword(
  driverID: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { res, data } = await authFetch<any>(`/driver/${driverID}/password`, {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error((data as any).error ?? 'Failed to change password');
}

// ─── Deliveries API ───────────────────────────────────────────────────────────

export async function fetchDeliveries(driverID: string): Promise<Delivery[]> {
  const { res, data } = await authFetch<any>(`/driver/${driverID}/deliveries`);
  if (!res.ok) throw new Error((data as any).error ?? 'Failed to load deliveries');
  return (data as any).deliveries ?? [];
}

export async function fetchDeliveryDetail(
  driverID: string,
  deliveryID: string
): Promise<Delivery> {
  const { res, data } = await authFetch<any>(`/driver/${driverID}/deliveries/${deliveryID}`);
  if (!res.ok) throw new Error((data as any).error ?? 'Failed to load delivery');
  return data as Delivery;
}

export async function updateDeliveryStatus(
  driverID: string,
  deliveryID: string,
  status: DeliveryStatus,
  otp?: string
): Promise<Delivery> {
  const body: Record<string, string> = { status };
  if (otp) body.otp = otp;                          // ← include otp when present

  const { res, data } = await authFetch<any>(
    `/driver/${driverID}/deliveries/${deliveryID}/status`,
    { method: 'PATCH', body: JSON.stringify(body) } // ← use body variable
  );
  if (!res.ok) throw new Error((data as any).error ?? 'Failed to update status');
  return (data as any).delivery as Delivery;
}