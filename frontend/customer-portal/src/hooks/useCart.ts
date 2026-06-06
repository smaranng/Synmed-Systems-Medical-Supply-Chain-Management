import { useState, useEffect, useCallback } from 'react';
import { cartService } from '../services/cartService';

interface CartState {
  items: any[];
  count: number;
  total: number;
  loading: boolean;
}

export const useCart = () => {
  const [cartState, setCartState] = useState<CartState>({
    items: [],
    count: 0,
    total: 0,
    loading: true,
  });

  const loadCart = useCallback(async () => {
    try {
      setCartState(prev => ({ ...prev, loading: true }));
      const response = await cartService.getCart();
      setCartState({
        items: response.items || [],
        count: response.count || 0,
        total: response.total || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load cart:', error);
      setCartState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Load cart on mount
  useEffect(() => {
    loadCart();
  }, [loadCart]);

  return {
    ...cartState,
    refetch: loadCart,
  };
};
