import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/service/api';

interface Product {
  _id: string;
  productName: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
  isAvailable: boolean;
  ratings: number;
  totalReviews: number;
  createdAt: string;
}

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/api/product/${productId}`);
      if (response.success) {
        setProduct(response.product);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!product) return;
    try {
      const response = await api.patch(`/api/product/toggle/${product._id}`);
      if (response.success) {
        setProduct(prev => prev ? { ...prev, isAvailable: !prev.isAvailable } : null);
        Alert.alert('Success', response.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update product');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product?.productName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/api/product/delete/${productId}`);
              if (response.success) {
                Alert.alert('Deleted', 'Product has been deleted', [
                  { text: 'OK', onPress: () => router.back() }
                ]);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    router.push({
      pathname: '/edit-product',
      params: { productId: product?._id }
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F8F4] justify-center items-center">
        <ActivityIndicator size="large" color="#1A3D2B" />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F8F4] justify-center items-center">
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text className="text-gray-500 mt-4">Product not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-[#1A3D2B] px-6 py-3 rounded-full"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-4">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm"
            >
              <Ionicons name="arrow-back" size={20} color="#1A3D2B" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-[#1A3D2B]">Product Details</Text>
            <TouchableOpacity
              onPress={handleEdit}
              className="w-10 h-10 bg-[#1A3D2B] rounded-full items-center justify-center shadow-sm"
            >
              <Ionicons name="create-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Image Gallery */}
          {product.images && product.images.length > 0 ? (
            <View className="mb-4">
              <Image
                source={{ uri: product.images[currentImageIndex] }}
                className="w-full h-64 rounded-2xl"
                resizeMode="cover"
              />
              {product.images.length > 1 && (
                <View className="flex-row justify-center mt-2 gap-2">
                  {product.images.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full ${
                        index === currentImageIndex ? 'bg-[#1A3D2B]' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View className="w-full h-64 bg-gray-100 rounded-2xl items-center justify-center mb-4">
              <Ionicons name="image-outline" size={64} color="#9CA3AF" />
            </View>
          )}

          {/* Product Info Card */}
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-[#1A3D2B]">
                  {product.productName}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Category: {product.category}
                </Text>
              </View>
              <View className={`px-3 py-1 rounded-full ${
                product.isAvailable ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Text className={`text-xs font-bold ${
                  product.isAvailable ? 'text-green-700' : 'text-red-700'
                }`}>
                  {product.isAvailable ? 'Available' : 'Unavailable'}
                </Text>
              </View>
            </View>

            {product.description && (
              <Text className="text-sm text-gray-600 mt-4 leading-5">
                {product.description}
              </Text>
            )}

            <View className="flex-row mt-4 pt-4 border-t border-gray-100">
              <View className="flex-1">
                <Text className="text-xs text-gray-500">Price</Text>
                <Text className="text-2xl font-bold text-[#1A3D2B]">₹{product.price}</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-xs text-gray-500">Stock</Text>
                <Text className="text-2xl font-bold text-[#1A3D2B]">{product.stock}</Text>
              </View>
              <View className="flex-1 items-end">
                <Text className="text-xs text-gray-500">Rating</Text>
                <View className="flex-row items-center">
                  <Text className="text-2xl font-bold text-[#1A3D2B]">
                    {product.ratings?.toFixed(1) || '0.0'}
                  </Text>
                  <Ionicons name="star" size={16} color="#F59E0B" style={{ marginLeft: 4 }} />
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              onPress={handleToggleAvailability}
              className="flex-1 flex-row items-center justify-center py-4 rounded-2xl bg-white border border-gray-200"
            >
              <Ionicons
                name={product.isAvailable ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#1A3D2B"
              />
              <Text className="text-sm font-bold text-[#1A3D2B] ml-2">
                {product.isAvailable ? 'Disable' : 'Enable'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              className="flex-1 flex-row items-center justify-center py-4 rounded-2xl bg-red-50 border border-red-200"
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text className="text-sm font-bold text-red-500 ml-2">Delete</Text>
            </TouchableOpacity>
          </View>

          {/* Created Date */}
          <View className="items-center pb-8">
            <Text className="text-xs text-gray-400">
              Created: {new Date(product.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}