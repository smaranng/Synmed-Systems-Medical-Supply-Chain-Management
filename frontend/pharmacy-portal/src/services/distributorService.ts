//import { authService } from './authService';

const USER_API_URL = 'http://localhost:5203';

export interface PharmacyUser {
  _id?: string;
  id?: string;
  distributorID?: string;
  name?: string;
  email?: string;
  phone?: number;
  logo?: string;
  licenseNumber?: string;
  companyName?: string;
  gstRegistered?: boolean;
  gstIN?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
   
  } | string;
  
}

export const distributorService = {
  async getDistributorById(distributorID: string): Promise<PharmacyUser | null> {
  if (!distributorID) return null;

  // /distributor/:distributorID is a public endpoint — no auth needed
  const res = await fetch(`${USER_API_URL}/distributor/${distributorID}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    try {
      const err = await res.json();
      console.error('Failed to fetch distributor user:', err);
    } catch {}
    return null;
  }

  return res.json();
}
};