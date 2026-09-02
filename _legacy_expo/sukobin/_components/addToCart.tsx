
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '@/_components/cartContext';

const C = {
  green900: '#1A3D2B',
  green500: '#40916C',
  green400: '#52B788',
  green100: '#D8F3DC',
  green50:  '#F0FAF3',
  white:    '#FFFFFF',
  textSoft: '#7DAA90',
  red:      '#E63946',
};

interface Props {
  product: any;
  size?: 'sm' | 'lg';
}

export default function AddToCartButton({ product, size = 'sm' }: Props) {
  const { isInCart, getQuantity, addToCart, updateQuantity, removeFromCart } = useCart();
  const [busy, setBusy] = useState(false);

  const productId = product._id || product.productId;
  const inCart    = isInCart(productId);
  const qty       = getQuantity(productId);
  const isLg      = size === 'lg';

  const handleAdd = async () => {
    setBusy(true);
    await addToCart(product, 1);
    setBusy(false);
  };

  const handleIncrease = async () => {
    if (qty >= (product.stock ?? 999)) return;
    setBusy(true);
    await updateQuantity(productId, qty + 1);
    setBusy(false);
  };

  const handleDecrease = async () => {
    setBusy(true);
    if (qty <= 1) {
      await removeFromCart(productId);
    } else {
      await updateQuantity(productId, qty - 1);
    }
    setBusy(false);
  };

  // ── Not in cart ──────────────────────────────────────────────────────────────
  if (!inCart) {
    if (isLg) {
      return (
        <TouchableOpacity
          onPress={handleAdd}
          disabled={busy || !product.isAvailable}
          style={{
            flex: 1,
            paddingVertical: 15, borderRadius: 16,
            borderWidth: 2, borderColor: C.green400,
            backgroundColor: C.green50,
            alignItems: 'center', justifyContent: 'center',
            opacity: !product.isAvailable ? 0.45 : 1,
          }}
        >
          {busy
            ? <ActivityIndicator size="small" color={C.green400} />
            : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="cart-outline" size={18} color={C.green400} />
                <Text style={{ color: C.green500, fontWeight: '800', fontSize: 15 }}>Add to Cart</Text>
              </View>
            )
          }
        </TouchableOpacity>
      );
    }

    // sm — compact for cards
    return (
      <TouchableOpacity
        onPress={handleAdd}
        disabled={busy || !product.isAvailable}
        style={{
          backgroundColor: product.isAvailable ? C.green400 : '#E0E7EF',
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy
          ? <ActivityIndicator size="small" color={C.white} />
          : <>
              <Ionicons name="add" size={14} color={C.white} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.white }}>Add</Text>
            </>
        }
      </TouchableOpacity>
    );
  }

  // ── Already in cart — show stepper ──────────────────────────────────────────
  if (isLg) {
    return (
      <View style={{
        flex: 1,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, borderRadius: 16,
        borderWidth: 2, borderColor: C.green400,
        backgroundColor: C.green50, gap: 16,
      }}>
        <TouchableOpacity onPress={handleDecrease} disabled={busy} style={{ padding: 4 }}>
          <Ionicons name={qty <= 1 ? 'trash-outline' : 'remove'} size={20} color={qty <= 1 ? C.red : C.green500} />
        </TouchableOpacity>
        {busy
          ? <ActivityIndicator size="small" color={C.green400} />
          : <Text style={{ fontSize: 18, fontWeight: '900', color: C.green900, minWidth: 28, textAlign: 'center' }}>{qty}</Text>
        }
        <TouchableOpacity onPress={handleIncrease} disabled={busy || qty >= (product.stock ?? 999)} style={{ padding: 4 }}>
          <Ionicons name="add" size={20} color={C.green500} />
        </TouchableOpacity>
      </View>
    );
  }

  // sm stepper
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.green100, borderRadius: 10,
      overflow: 'hidden',
    }}>
      <TouchableOpacity onPress={handleDecrease} disabled={busy} style={{ paddingHorizontal: 8, paddingVertical: 5 }}>
        <Ionicons name={qty <= 1 ? 'trash-outline' : 'remove'} size={13} color={qty <= 1 ? C.red : C.green900} />
      </TouchableOpacity>
      <Text style={{ fontSize: 13, fontWeight: '900', color: C.green900, minWidth: 18, textAlign: 'center' }}>
        {busy ? '…' : qty}
      </Text>
      <TouchableOpacity onPress={handleIncrease} disabled={busy || qty >= (product.stock ?? 999)} style={{ paddingHorizontal: 8, paddingVertical: 5 }}>
        <Ionicons name="add" size={13} color={C.green900} />
      </TouchableOpacity>
    </View>
  );
}