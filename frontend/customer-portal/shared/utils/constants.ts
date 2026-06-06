// Color scheme
export const COLORS = {
  primary: {
    navy: '#0A1D37',
    lightBlue: '#4BA3C3',
    green: '#3BB273',
  },
  secondary: {
    white: '#F9FAFB',
    grey: '#6B7280',
    red: '#E63946',
  },
};

// API endpoints
export const API_ENDPOINTS = {
  GRAPHQL: '/graphql',
  UPLOAD: '/upload',
  HEALTH: '/health',
};

// User roles
export const USER_ROLES = {
  CUSTOMER: 'CUSTOMER',
  PHARMACY: 'PHARMACY',
  distributor: 'distributor',
  ADMIN: 'ADMIN',
} as const;

// Order statuses
export const ORDER_STATUSES = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

// Payment statuses
export const PAYMENT_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

// Medicine categories
export const MEDICINE_CATEGORIES = {
  TABLET: 'TABLET',
  CAPSULE: 'CAPSULE',
  SYRUP: 'SYRUP',
  INJECTION: 'INJECTION',
  CREAM: 'CREAM',
  DROPS: 'DROPS',
} as const;

// Notification types
export const NOTIFICATION_TYPES = {
  ORDER_UPDATE: 'ORDER_UPDATE',
  STOCK_ALERT: 'STOCK_ALERT',
  DELIVERY_UPDATE: 'DELIVERY_UPDATE',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  PROMOTION: 'PROMOTION',
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Local storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  CART: 'cart',
  THEME: 'theme',
};

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_WITH_TIME: 'MMM dd, yyyy HH:mm',
  ISO: "yyyy-MM-dd'T'HH:mm:ss",
  SHORT: 'MM/dd/yyyy',
};

// Validation rules
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
};

// Map configuration
export const MAP_CONFIG = {
  DEFAULT_ZOOM: 12,
  DEFAULT_CENTER: { lat: 40.7128, lng: -74.006 },
  SEARCH_RADIUS: 5000, // meters
};

// File upload limits
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
};
