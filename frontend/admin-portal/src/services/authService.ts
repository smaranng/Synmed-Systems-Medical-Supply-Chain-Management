const API_URL = 'http://localhost:5203';

export interface LoginResponse {
    id: string;
    email: string;
    name: string;
    role: string;
    username: string;
    phone?: string; 
    address?: string | { line1: string; city: string; state: string; pincode: string };
}

export interface UpdateProfileData {
    name: string;
    email: string;
    username: string;
    phone?: string;
    address?: {
        line1: string;
        city: string;
        state: string;
        pincode: string;
    };
}

// 🔐 JWT Token Management
const setToken = (token: string) => {
  localStorage.setItem('admin_token', token);
};

const getToken = () => {
  return localStorage.getItem('admin_token');
};

const clearToken = () => {
  localStorage.removeItem('admin_token');
};

export const authService = {
    async login(username: string, password: string): Promise<LoginResponse> {
        const response = await fetch(`${API_URL}/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Admin login failed');
        }

        // 🔐 Store JWT token
        if (data.token) {
            setToken(data.token);
        }

        return data.user;
    },

    async register(adminData: {
        name: string;
        email: string;
        username: string;
        phone?: string;
        password: string;
    }): Promise<LoginResponse> {
        const response = await fetch(`${API_URL}/auth/admin/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adminData),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Admin registration failed');
        }

        return data;
    },

// ==== ADMIN PROFILE UPDATE ====
async updateAdminProfile(
  adminId: string,
  profileData: UpdateProfileData
): Promise<LoginResponse> {
  const token = getToken();
  const response = await fetch(`${API_URL}/admin/${adminId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(profileData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Admin profile update failed');
  }

  return data;
},

// ==== ADMIN PASSWORD CHANGE ====
async changeAdminPassword(
  adminId: string,
  passwords: { currentPassword: string; newPassword: string }
): Promise<{ success: boolean }> {
  const token = getToken();
  const response = await fetch(`${API_URL}/admin/${adminId}/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(passwords),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Admin password change failed');
  }

  return data;
},

};

// 🔐 Export token functions for useAuth hook
export { setToken, getToken, clearToken };
