import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { cartService } from '../services/cartService';
import { useAuth } from "../hooks/useAuth";

interface CartContextType {
  count: number;
  items: any[];
  total: number;
  loading: boolean;
  error: string | null;
  refetchCart: () => Promise<void>;
  clearError: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const refetchCart = useCallback(async () => {
    // Don't fetch if user isn't logged in
    if (!user) {
      setItems([]);
      setCount(0);
      setTotal(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await cartService.getCart();
      setItems(response.items || []);
      setCount(response.count || 0);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load cart:', error);
      setError(error instanceof Error ? error.message : 'Failed to load cart');
      // Reset to empty state on error
      setItems([]);
      setCount(0);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load cart when user changes (login/logout)
  useEffect(() => {
    refetchCart();
  }, [refetchCart]);

  return (
    <CartContext.Provider value={{ count, items, total, loading, error, refetchCart, clearError }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCartContext = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within CartProvider');
  }
  return context;
};