//import { authService } from './authService';

const USER_API_URL = 'http://localhost:5203';

export interface PharmacyUser {
  _id?: string;
  id?: string;
  pharmaID?: string;
  name?: string;
  email?: string;
  phone?: string;
  logo?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    zip?: string;
    postalCode?: string;
    country?: string;
    street?: string;
  } | string;
  timings?:{
    Monday?: { open: string; close: string };
    Tuesday?: { open: string; close: string };
    Wednesday?: { open: string; close: string };
    Thursday?: { open: string; close: string };
    Friday?: { open: string; close: string };
    Saturday?: { open: string; close: string };
    Sunday?: { open: string; close: string };    
  }
}

export const pharmacyService = {
  async getPharmacyById(pharmaID: string): Promise<PharmacyUser | null> {
  if (!pharmaID) return null;

  // /pharmacy/:pharmaID is a public endpoint — no auth needed
  const res = await fetch(`${USER_API_URL}/pharmacy/${pharmaID}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    try {
      const err = await res.json();
      console.error('Failed to fetch pharmacy user:', err);
    } catch {}
    return null;
  }

  return res.json();
}
};