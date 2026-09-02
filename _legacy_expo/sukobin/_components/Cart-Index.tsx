
import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, Animated, StatusBar, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '@/_components/cartContext';

const { width: SW } = Dimensions.get('window');

const C = {
  green900: '#1A3D2B',
  green700: '#2D6A4F',
  green500: '#40916C',
  green400: '#52B788',
  green200: '#B7E4C7',
  green100: '#D8F3DC',
  green50:  '#F0FAF3',
  white:    '#FFFFFF',
  bg:       '#F4FBF6',
  text:     '#1A3D2B',
  textMid:  '#4A7560',
  textSoft: '#7DAA90',
  amber:    '#F4A261',
  red:      '#E63946',
};

// ─── Cart Item Row ─────────────────────────────────────────────────────────────
const CartItemRow = ({ item }: { item: any }) => {
  const { updateQuantity, removeFromCart } = useCart();
  const [busy, setBusy] = React.useState(false);

  const handleUpdate = async (qty: number) => {
    setBusy(true);
    if (qty <= 0) await removeFromCart(item.productId);
    else          await updateQuantity(item.productId, qty);
    setBusy(false);
  };

  return (
    <View style={{
      flexDirection: 'row', backgroundColor: C.white,
      borderRadius: 18, padding: 14, marginBottom: 12,
      borderWidth: 1, borderColor: C.green200,
      shadowColor: C.green900, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    }}>
      {/* Product image */}
      <TouchableOpacity onPress={() => router.push(`/product/${item.productId}`)}>
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/100' }}
          style={{ width: 80, height: 80, borderRadius: 14 }}
          resizeMode="cover"
        />
      </TouchableOpacity>

      {/* Details */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TouchableOpacity onPress={() => router.push(`/product/${item.productId}`)}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }} numberOfLines={2}>
            {item.productName}
          </Text>
        </TouchableOpacity>
        {item.shopName && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <Ionicons name="storefront-outline" size={11} color={C.textSoft} />
            <Text style={{ fontSize: 11, color: C.textSoft }}>{item.shopName}</Text>
          </View>
        )}
        <Text style={{ fontSize: 16, fontWeight: '900', color: C.green500, marginTop: 6 }}>
          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
        </Text>
        <Text style={{ fontSize: 11, color: C.textSoft }}>
          ₹{item.price.toLocaleString('en-IN')} each
        </Text>

        {/* Stepper + delete */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: C.green100, borderRadius: 12, overflow: 'hidden',
          }}>
            <TouchableOpacity
              onPress={() => handleUpdate(item.quantity - 1)}
              disabled={busy}
              style={{ paddingHorizontal: 12, paddingVertical: 7 }}
            >
              <Ionicons name={item.quantity <= 1 ? 'trash-outline' : 'remove'} size={15} color={item.quantity <= 1 ? C.red : C.green900} />
            </TouchableOpacity>
            {busy
              ? <ActivityIndicator size="small" color={C.green500} style={{ width: 28 }} />
              : <Text style={{ fontSize: 15, fontWeight: '900', color: C.green900, minWidth: 28, textAlign: 'center' }}>{item.quantity}</Text>
            }
            <TouchableOpacity
              onPress={() => handleUpdate(item.quantity + 1)}
              disabled={busy || item.quantity >= item.stock}
              style={{ paddingHorizontal: 12, paddingVertical: 7, opacity: item.quantity >= item.stock ? 0.3 : 1 }}
            >
              <Ionicons name="add" size={15} color={C.green900} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => handleUpdate(0)}
            disabled={busy}
            style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="trash-outline" size={16} color={C.red} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyCart = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
    <View style={{
      width: 100, height: 100, borderRadius: 28,
      backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center',
      marginBottom: 20,
    }}>
      <Ionicons name="cart-outline" size={48} color={C.green400} />
    </View>
    <Text style={{ fontSize: 22, fontWeight: '900', color: C.text }}>Cart is empty</Text>
    <Text style={{ fontSize: 14, color: C.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
      Browse products and add items to your cart
    </Text>
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/home')}
      style={{
        marginTop: 28, paddingHorizontal: 32, paddingVertical: 14,
        backgroundColor: C.green400, borderRadius: 16,
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}
    >
      <Ionicons name="storefront-outline" size={18} color={C.white} />
      <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>Browse Products</Text>
    </TouchableOpacity>
  </View>
);

// ─── Main Cart Screen ──────────────────────────────────────────────────────────
export default function CartScreen() {
  const { items, totalItems, totalPrice, clearCart, refreshCart, loading } = useCart();

  useEffect(() => {
    refreshCart();
  }, []);

  const handleClear = () => {
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearCart },
    ]);
  };

  const handleCheckout = () => {
    // Zomato-style: confirm/edit the delivery address (with map pin) before checkout
    router.push({ pathname: '/edit-address', params: { next: 'checkout' } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 22, paddingTop: 8, paddingBottom: 14,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40, height: 40, borderRadius: 14,
              backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={20} color={C.green900} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>My Cart</Text>
            {totalItems > 0 && (
              <Text style={{ fontSize: 12, color: C.textSoft }}>{totalItems} item{totalItems > 1 ? 's' : ''}</Text>
            )}
          </View>

          {items.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              style={{
                paddingHorizontal: 10, paddingVertical: 6,
                backgroundColor: '#FFF0F0', borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.red }}>Clear All</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Content */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={C.green400} />
          </View>
        ) : items.length === 0 ? (
          <EmptyCart />
        ) : (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 160 }}
            >
              {/* Group by shop */}
              {items.map(item => (
                <CartItemRow key={item.productId} item={item} />
              ))}

              {/* Price summary card */}
              <View style={{
                backgroundColor: C.white, borderRadius: 20,
                padding: 18, marginTop: 8,
                borderWidth: 1, borderColor: C.green200,
              }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 14 }}>
                  Order Summary
                </Text>
                {items.map(item => (
                  <View key={item.productId} style={{
                    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8,
                  }}>
                    <Text style={{ fontSize: 13, color: C.textMid, flex: 1 }} numberOfLines={1}>
                      {item.productName} × {item.quantity}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: C.green100, marginVertical: 10 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>Total</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C.green500 }}>
                    ₹{totalPrice.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Checkout bar */}
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: C.white,
              borderTopWidth: 1, borderTopColor: C.green200,
              paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30,
              shadowColor: C.green900, shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: C.textSoft }}>{totalItems} item{totalItems > 1 ? 's' : ''}</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: C.green900 }}>
                  ₹{totalPrice.toLocaleString('en-IN')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCheckout}
                style={{
                  backgroundColor: C.green400, borderRadius: 16,
                  paddingVertical: 16, alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                  shadowColor: C.green700, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
                }}
              >
                <Ionicons name="flash" size={18} color={C.white} />
                <Text style={{ color: C.white, fontWeight: '900', fontSize: 16 }}>Proceed to Checkout</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}



