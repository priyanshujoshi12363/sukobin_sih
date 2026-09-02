import React, { useState, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  Animated, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export interface Product {
  _id: string;
  productName: string;
  description?: string;
  category: string;
  images: string[];
  price: number;
  mrp?: number;
  stock: number;
  ratings: number;
  totalReviews: number;
  isAvailable: boolean;
  isActive: boolean;
  shop?: { _id: string; shopName: string; shopLogo: string; ratings: number; totalReviews: number };
}

interface ProductCardProps {
  product: Product;
  quantity?: number;
  onAddToCart?: () => void;
  onUpdateQuantity?: (newQuantity: number) => void;
}

export default function ProductCard({
  product,
  quantity = 0,
  onAddToCart,
  onUpdateQuantity,
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const isInCart    = quantity > 0;
  const isAvailable = product.isAvailable && product.stock > 0;
  const imageUri    = product.images?.[0];
  const displayMrp  = product.mrp ?? Math.round(product.price * 1.2);

  const pressIn  = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }).start();

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: product._id } })}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={[styles.card, !isAvailable && styles.cardDimmed]}
      >
        {/* Image */}
        <View style={styles.imageWrap}>
          {imgError || !imageUri ? (
            <View style={styles.imageFallback}>
              <Ionicons name="image-outline" size={32} color="#D1D5DB" />
            </View>
          ) : (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onError={() => setImgError(true)}
            />
          )}

          {!isAvailable && (
            <View style={styles.oosBadge}>
              <Text style={styles.oosBadgeText}>Out of stock</Text>
            </View>
          )}

          {product.shop && (
            <View style={styles.shopBadge}>
              <Image source={{ uri: product.shop.shopLogo }} style={styles.shopLogo} />
              <Text style={styles.shopName} numberOfLines={1}>{product.shop.shopName}</Text>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.category} numberOfLines={1}>{product.category}</Text>
          <Text style={styles.name} numberOfLines={2}>{product.productName}</Text>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.mrp}>₹{displayMrp}</Text>
              <Text style={styles.price}>₹{product.price}</Text>
            </View>

            {isAvailable ? (
              isInCart ? (
                <View style={styles.stepper}>
                  <TouchableOpacity
                    onPress={() => onUpdateQuantity?.(quantity - 1)}
                    style={styles.stepperBtn}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="remove" size={15} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.stepperQty}>{quantity}</Text>
                  <TouchableOpacity
                    onPress={() => onUpdateQuantity?.(quantity + 1)}
                    style={styles.stepperBtn}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="add" size={15} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={onAddToCart}
                  style={styles.addBtn}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
              )
            ) : (
              <View style={styles.addBtnDisabled}>
                <Ionicons name="add" size={22} color="#9CA3AF" />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const GREEN = '#0C831F';
const BRAND = '#1A3B32';

const styles = StyleSheet.create({
  wrapper:        { width: '47%', marginBottom: 10 },
  card:           { backgroundColor: '#fff', borderRadius: 16, borderWidth: 0.5, borderColor: '#E5E7EB', overflow: 'hidden' },
  cardDimmed:     { opacity: 0.6 },
  imageWrap:      { width: '100%', aspectRatio: 1, backgroundColor: '#F8F8F6', position: 'relative' },
  image:          { width: '100%', height: '100%' },
  imageFallback:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  oosBadge:       { position: 'absolute', top: 8, left: 8, backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  oosBadgeText:   { fontSize: 10, fontWeight: '600', color: '#991B1B' },
  shopBadge:      { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 99, paddingVertical: 2, paddingLeft: 3, paddingRight: 7 },
  shopLogo:       { width: 16, height: 16, borderRadius: 8, backgroundColor: '#E5E7EB' },
  shopName:       { fontSize: 10, fontWeight: '500', color: '#555', maxWidth: 72 },
  body:           { padding: 10 },
  category:       { fontSize: 10, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 3 },
  name:           { fontSize: 13, fontWeight: '600', color: BRAND, lineHeight: 18, minHeight: 36 },
  priceRow:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 },
  mrp:            { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' },
  price:          { fontSize: 16, fontWeight: '700', color: GREEN, lineHeight: 20 },
  addBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', shadowColor: GREEN, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  addBtnDisabled: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  stepper:        { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN, borderRadius: 99, shadowColor: GREEN, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  stepperBtn:     { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  stepperQty:     { fontSize: 13, fontWeight: '600', color: '#fff', minWidth: 18, textAlign: 'center' },
});