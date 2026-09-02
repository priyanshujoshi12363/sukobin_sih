import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/service/api';
import * as ImagePicker from 'expo-image-picker';

// Types
interface ProductForm {
  productName: string;
  description: string;
  category: string;
  price: string;
  stock: string;
}

export default function AddProductScreen() {
  const [formData, setFormData] = useState<ProductForm>({
    productName: '',
    description: '',
    category: '',
    price: '',
    stock: '0',
  });

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [removedImages, setRemovedImages] = useState<string[]>([]);

  // Check if editing existing product
  useEffect(() => {
    // If you pass product data via params, you can load it here
    // For now, it's add mode by default
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (images.length >= 10) {
          Alert.alert('Limit Reached', 'You can upload maximum 10 images');
          return;
        }
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.productName.trim()) {
      Alert.alert('Missing Field', 'Product name is required');
      return;
    }
    if (!formData.category.trim()) {
      Alert.alert('Missing Field', 'Category is required');
      return;
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }
    if (!formData.stock || parseInt(formData.stock) < 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('productName', formData.productName.trim());
      form.append('description', formData.description.trim());
      form.append('category', formData.category.trim());
      form.append('price', formData.price);
      form.append('stock', formData.stock || '0');

      // Append images
      if (images.length > 0) {
        images.forEach((image, index) => {
          form.append('productImages', {
            uri: image,
            type: 'image/jpeg',
            name: `product-image-${index}.jpg`,
          } as any);
        });
      }

      const endpoint = isEditMode && productId 
        ? `/api/product/edit/${productId}` 
        : '/api/product';

      const response = isEditMode && productId
        ? await api.put(endpoint, form,true)
        : await api.post(endpoint, form, true);

      if (response.success) {
        Alert.alert(
          'Success', 
          isEditMode ? 'Product updated successfully!' : 'Product added successfully!',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to save product');
      }
    } catch (error: any) {
      console.error('Product save error:', error);
      const errorMessage = error?.response?.data?.message || 
                          error?.message || 
                          'Failed to save product. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof ProductForm) => (text: string) =>
    setFormData((prev) => ({ ...prev, [key]: text }));

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 390 }}
        >
          {/* Header */}
          <View className="px-6 pt-4">
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => router.back()}
                  activeOpacity={0.75}
                  className="mr-4 w-9 h-9 rounded-full bg-white items-center justify-center shadow-sm"
                >
                  <Ionicons name="arrow-back" size={20} color="#1A3D2B" />
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-[#1A3D2B]">
                  {isEditMode ? 'Edit Product' : 'Add Product'}
                </Text>
              </View>
            </View>

            {/* Product Images Section */}
            <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-5 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm font-bold text-gray-600">Product Images</Text>
                <Text className="text-xs text-gray-400">{images.length}/10</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {/* Image Grid */}
                  {images.map((image, index) => (
                    <View key={index} className="relative">
                      <Image
                        source={{ uri: image }}
                        className="w-20 h-20 rounded-xl"
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center"
                      >
                        <Ionicons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add Image Button */}
                  {images.length < 10 && (
                    <TouchableOpacity
                      onPress={pickImage}
                      activeOpacity={0.75}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 items-center justify-center"
                    >
                      <Ionicons name="add" size={28} color="#9CA3AF" />
                      <Text className="text-[10px] text-gray-400 mt-1">Add Image</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>

            {/* Product Details Form */}
            <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <Text className="text-sm font-bold text-gray-600 mb-4">Product Details</Text>

              <Field label="Product Name *">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="Enter product name"
                  value={formData.productName}
                  onChangeText={update('productName')}
                  style={styles.input}
                />
              </Field>

              <Field label="Description">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="Enter product description"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={formData.description}
                  onChangeText={update('description')}
                  style={[styles.input, { height: 100 }]}
                />
              </Field>

              <Field label="Category *">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="e.g. Electronics, Grocery, Fashion"
                  value={formData.category}
                  onChangeText={update('category')}
                  style={styles.input}
                />
              </Field>

              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[12px] font-bold text-gray-600 mb-1">Price (₹) *</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={formData.price}
                    onChangeText={update('price')}
                    style={styles.input}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[12px] font-bold text-gray-600 mb-1">Stock *</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                    placeholder="0"
                    keyboardType="number-pad"
                    value={formData.stock}
                    onChangeText={update('stock')}
                    style={styles.input}
                  />
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              className="w-full py-4 rounded-2xl bg-[#1A3D2B] items-center mt-6 shadow-sm"
            >
              {loading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-white font-bold text-base">
                    {isEditMode ? 'Updating Product...' : 'Adding Product...'}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="add-circle-outline" size={20} color="white" />
                  <Text className="text-white font-bold text-base">
                    {isEditMode ? 'Update Product' : 'Add Product'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Field Component
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text className="text-[12px] font-bold text-gray-600 mb-1">{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingVertical: Platform.OS === 'android' ? 10 : undefined,
    fontSize: 14,
    color: '#1A3D2B',
  },
});