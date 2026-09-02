
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated } from 'react-native';
import api from '@/utils/api';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface CartItem {
  _id: string;          // cart item id from backend
  productId: string;
  productName: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
  shopName?: string;
  shopId?: string;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  loading: boolean;
  // actions
  addToCart: (product: any, qty?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  isInCart: (productId: string) => boolean;
  getQuantity: (productId: string) => number;
  // fab animation value (exposed so FloatingCart can use it)
  fabAnim: Animated.Value;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = 'sukobin_cart';

// ─── Provider ──────────────────────────────────────────────────────────────────
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems]     = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(0);

  // Animate FAB in/out based on cart count
  useEffect(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    if (count > 0 && prevCount.current === 0) {
      Animated.spring(fabAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    } else if (count === 0 && prevCount.current > 0) {
      Animated.timing(fabAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
    prevCount.current = count;
  }, [items]);

  // Load from AsyncStorage on mount, then sync with backend
  useEffect(() => {
    loadFromStorage();
  }, []);

  const loadFromStorage = async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    // Also try to sync with backend if logged in
    await refreshCart();
  };

  const saveToStorage = async (newItems: CartItem[]) => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
    } catch {}
  };

  // ── Refresh from backend ─────────────────────────────────────────────────────
  const refreshCart = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      const response = await api.get('/api/cart');
      // Backend (cartController.getCart) responds: { success, data: { cart, hasItems } }
      const cart = response?.data?.cart;

      if (response?.success && cart && Array.isArray(cart.items)) {
        const shopName = cart.shop?.shopName;
        const shopId   = cart.shop?._id;
        const mapped: CartItem[] = cart.items.map((i: any) => ({
          _id:         i._id || '',
          productId:   i.product?._id || i.product || i.productId,
          productName: i.product?.productName || i.name || i.productName,
          price:       i.product?.price ?? i.price,
          image:       i.product?.images?.[0] || i.image || '',
          quantity:    i.quantity,
          stock:       i.product?.stock ?? i.stock ?? 999,
          shopName:    shopName || i.shopName,
          shopId:      shopId || i.shopId,
        }));
        setItems(mapped);
        await saveToStorage(mapped);
      } else if (response?.success && response?.data?.hasItems === false) {
        // Server cart is empty — reflect that locally
        setItems([]);
        await saveToStorage([]);
      }
    } catch {}
  }, []);

  // ── Add to cart ──────────────────────────────────────────────────────────────
  const addToCart = useCallback(async (product: any, qty: number = 1) => {
    const productId = product._id || product.productId;

    // Optimistic update
    setItems(prev => {
      const exists = prev.find(i => i.productId === productId);
      let next: CartItem[];
      if (exists) {
        next = prev.map(i =>
          i.productId === productId
            ? { ...i, quantity: Math.min(i.quantity + qty, i.stock) }
            : i
        );
      } else {
        next = [...prev, {
          _id:         '',
          productId,
          productName: product.productName,
          price:       product.price,
          image:       product.images?.[0] || product.image || '',
          quantity:    qty,
          stock:       product.stock ?? 999,
          shopName:    product.shop?.shopName || product.shopName,
          shopId:      product.shop?._id || product.shopId,
        }];
      }
      saveToStorage(next);
      return next;
    });

    // API call → POST /api/cart/add { productId, quantity }
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      await api.post('/api/cart/add', { productId, quantity: qty });
    } catch {}
    // Always reconcile with the server (handles single-shop rule, stock caps, real ids)
    await refreshCart();
  }, [refreshCart]);

  // ── Update quantity ──────────────────────────────────────────────────────────
  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    setItems(prev => {
      const next = prev.map(i =>
        i.productId === productId ? { ...i, quantity } : i
      );
      saveToStorage(next);
      return next;
    });

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      // Backend route: PUT /api/cart/update/:productId  body { quantity }
      await api.put(`/api/cart/update/${productId}`, { quantity });
    } catch {}
  }, []);

  // ── Remove item ──────────────────────────────────────────────────────────────
  const removeFromCart = useCallback(async (productId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.productId !== productId);
      saveToStorage(next);
      return next;
    });

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      await api.delete(`/api/cart/remove/${productId}`);
    } catch {}
  }, []);

  // ── Clear cart ───────────────────────────────────────────────────────────────
  const clearCart = useCallback(async () => {
    setItems([]);
    await AsyncStorage.removeItem(CART_STORAGE_KEY);

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      await api.delete('/api/cart/clear');
    } catch {}
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const isInCart    = (productId: string) => items.some(i => i.productId === productId);
  const getQuantity = (productId: string) => items.find(i => i.productId === productId)?.quantity ?? 0;

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, totalItems, totalPrice, loading,
      addToCart, updateQuantity, removeFromCart, clearCart, refreshCart,
      isInCart, getQuantity, fabAnim,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}