import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { cartService } from '../services/distributor_cartService';

interface CartContextType {
  count: number;
  items: any[];
  total: number;
  loading: boolean;
  refetchCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const response = await cartService.getCart();
      setItems(response.items || []);
      setCount(response.count || 0);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load cart on mount
  useEffect(() => {
    refetchCart();
  }, [refetchCart]);

  

  return (
    <CartContext.Provider value={{ count, items, total, loading, refetchCart }}>
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
