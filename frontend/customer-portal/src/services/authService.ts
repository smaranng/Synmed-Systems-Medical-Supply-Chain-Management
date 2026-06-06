const API_URL = 'http://localhost:5203'; // User service

export interface LoginResponse {
    id: string;
    email: string;
    name: string;
    role: string;
    username: string;
    phone?: string;
    address?: {
        line1: string;
        city: string;
        state: string;
        pincode: string;
    };
}

export interface AuthResponse {
    token: string;
    user: LoginResponse;
}

export const authService = {
    // 🔐 Store token
    setToken(token: string) {
        localStorage.setItem('token', token);
    },

    // 🔐 Retrieve token
    getToken(): string | null {
        return localStorage.getItem('token');
    },

    // 🔐 Clear token
    clearToken() {
        localStorage.removeItem('token');
    },

    // 🔐 Get Authorization header
    getAuthHeader(): HeadersInit {
  const token = this.getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
},

    async login(username: string, password: string): Promise<LoginResponse> {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data: AuthResponse = await response.json();
        // 🔐 Store JWT token
        this.setToken(data.token);
        return data.user;
    },

    async register(userData: {
        name: string;
        email: string;
        username: string;
        phone?: string;
        password: string;
        role: string;
    }): Promise<LoginResponse> {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Registration failed' }));
            throw new Error(error.error || 'Registration failed');
        }

        return response.json();
    },

    async updateProfile(userId: string, data: any) {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) {
            (headers as any)['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        return res.json();
    },

    async changePassword(userId: string, payload: {
        currentPassword: string;
        newPassword: string;
    }) {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) {
            (headers as any)['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_URL}/users/${userId}/password`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        return res.json();
    },

    // 👤 Get current logged-in user profile from the server.
    // Decodes the userId from the stored JWT, then fetches fresh data from
    // GET /users/:id — matching the same shape used by login/register.
    // Returns null (instead of throwing) so callers can treat it as non-fatal.
    async getCurrentUser(): Promise<LoginResponse | null> {
        const token = this.getToken();
        if (!token) return null;

        try {
            // Decode JWT payload (middle segment) — no signature verification,
            // just reading the claims we wrote in at login time.
            const payloadBase64 = token.split('.')[1];
            if (!payloadBase64) return null;

            const payload = JSON.parse(atob(payloadBase64));

            // Support common JWT claim names for user ID
            const userId: string | undefined =
                payload.id ?? payload.sub ?? payload.userId ?? payload._id;

            if (!userId) {
                console.warn('getCurrentUser: no user ID found in JWT payload', payload);
                return null;
            }

            const res = await fetch(`${API_URL}/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!res.ok) throw new Error(`GET /users/${userId} returned ${res.status}`);

            return res.json() as Promise<LoginResponse>;

        } catch (err) {
            console.warn('getCurrentUser: failed, returning null', err);
            return null;
        }
    },
};