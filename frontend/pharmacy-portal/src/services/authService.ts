const API_URL = 'http://localhost:5203';

export interface LoginResponse {
    id: string;
    pharmaID?: string;
    email: string;
    name: string;
    role: string;
    licenseNumber?: string;
    address?: string;
    phone?: string;
    username?: string;
    licenseCertificate?: string;
    logo?: string;
    
}

// 🔐 JWT Token Management
export const setToken = (token: string) => {
    localStorage.setItem('pharmacy_token', token);
    console.log('✅ Token stored');
};

export const getToken = (): string | null => {
    const token = localStorage.getItem('pharmacy_token');
    console.log('🔑 Token retrieved:', !!token);
    return token;
};

export const clearToken = () => {
    localStorage.removeItem('pharmacy_token');
    console.log('🔒 Token cleared');
};

export const authService = {
    async login(username: string, password: string): Promise<LoginResponse> {
        console.log('🔐 Attempting login for username:', username);
        
        const response = await fetch(`${API_URL}/auth/pharmacy/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Login failed:', error);
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        console.log('✅ Login successful:', data);
        
        // 🔐 Store JWT token
        if (data.token) {
            setToken(data.token);
        } else {
            console.warn('⚠️ No token received from server');
        }

        return data.user;
    },

    async register(formData: FormData) {
        console.log('📝 Attempting registration');
        
        const response = await fetch(`${API_URL}/auth/pharmacy/register`, {
            method: 'POST',
            body: formData, // FormData for file upload
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('❌ Registration failed:', err);
            throw new Error(err.error || 'Registration failed');
        }

        const data = await response.json();
        console.log('✅ Registration successful:', data);
        return data;
    },

    async logout() {
        console.log('👋 Logging out');
        clearToken();
    }
};