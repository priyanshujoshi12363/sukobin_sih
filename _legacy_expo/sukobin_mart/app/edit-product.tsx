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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/service/api';
import * as ImagePicker from 'expo-image-picker';

interface ProductForm {
  productName: string;
  description: string;
  category: string;
  price: string;
  stock: string;
}

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<ProductForm>({
    productName: '',
    description: '',
    category: '',
    price: '',
    stock: '0',
  });

  useEffect(() => {
    if (productId) {
      fetchProductDetails();
    }
  }, [productId]);

  const fetchProductDetails = async () => {
    try {
      const response = await api.get(`/api/product/${productId}`);
      if (response.success) {
        const product = response.product;
        setFormData({
          productName: product.productName || '',
          description: product.description || '',
          category: product.category || '',
          price: product.price?.toString() || '',
          stock: product.stock?.toString() || '0',
        });
        setExistingImages(product.images || []);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setFetchingData(false);
    }
  };

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
        const totalImages = existingImages.length + newImages.length - removedImages.length;
        if (totalImages >= 10) {
          Alert.alert('Limit Reached', 'You can upload maximum 10 images');
          return;
        }
        setNewImages([...newImages, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeExistingImage = (imageUrl: string) => {
    setRemovedImages([...removedImages, imageUrl]);
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleUpdate = async () => {
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

    setLoading(true);
    try {
      const form = new FormData();
      form.append('productName', formData.productName.trim());
      form.append('description', formData.description.trim());
      form.append('category', formData.category.trim());
      form.append('price', formData.price);
      form.append('stock', formData.stock || '0');

      // Add removed images
      if (removedImages.length > 0) {
        removedImages.forEach((url) => {
          form.append('removeImages', url);
        });
      }

      // Add new images
      if (newImages.length > 0) {
        newImages.forEach((image, index) => {
          form.append('productImages', {
            uri: image,
            type: 'image/jpeg',
            name: `new-image-${index}.jpg`,
          } as any);
        });
      }

      const response = await api.put(`/api/product/edit/${productId}`, form, true);

      if (response.success) {
        Alert.alert('Success', 'Product updated successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to update product');
      }
    } catch (error: any) {
      console.error('Update error:', error);
      Alert.alert('Error', error?.response?.data?.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof ProductForm) => (text: string) =>
    setFormData((prev) => ({ ...prev, [key]: text }));

  if (fetchingData) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F8F4] justify-center items-center">
        <ActivityIndicator size="large" color="#1A3D2B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 350 }}>
          <View className="px-6 pt-4">
            {/* Header */}
            <View className="flex-row items-center mb-6">
              <TouchableOpacity
                onPress={() => router.back()}
                className="mr-4 w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm"
              >
                <Ionicons name="arrow-back" size={20} color="#1A3D2B" />
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-[#1A3D2B]">Edit Product</Text>
            </View>

            {/* Images Section */}
            <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-5 shadow-sm">
              <Text className="text-sm font-bold text-gray-600 mb-3">
                Product Images ({(existingImages.length - removedImages.length) + newImages.length}/10)
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {/* Existing Images */}
                  {existingImages
                    .filter(img => !removedImages.includes(img))
                    .map((image, index) => (
                      <View key={`existing-${index}`} className="relative">
                        <Image
                          source={{ uri: image }}
                          className="w-20 h-20 rounded-xl"
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          onPress={() => removeExistingImage(image)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center"
                        >
                          <Ionicons name="close" size={12} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}

                  {/* New Images */}
                  {newImages.map((image, index) => (
                    <View key={`new-${index}`} className="relative">
                      <Image
                        source={{ uri: image }}
                        className="w-20 h-20 rounded-xl"
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => removeNewImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center"
                      >
                        <Ionicons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add Image Button */}
                  <TouchableOpacity
                    onPress={pickImage}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 items-center justify-center"
                  >
                    <Ionicons name="add" size={28} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            {/* Edit Form */}
            <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <Text className="text-sm font-bold text-gray-600 mb-4">Product Details</Text>

              <Field label="Product Name *">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  value={formData.productName}
                  onChangeText={update('productName')}
                  style={styles.input}
                />
              </Field>

              <Field label="Description">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
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
                  value={formData.category}
                  onChangeText={update('category')}
                  style={styles.input}
                />
              </Field>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Price (₹) *">
                    <TextInput
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                      keyboardType="decimal-pad"
                      value={formData.price}
                      onChangeText={update('price')}
                      style={styles.input}
                    />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="Stock">
                    <TextInput
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                      keyboardType="number-pad"
                      value={formData.stock}
                      onChangeText={update('stock')}
                      style={styles.input}
                    />
                  </Field>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => router.back()}
                className="flex-1 py-4 rounded-2xl bg-gray-200 items-center"
              >
                <Text className="text-gray-700 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdate}
                disabled={loading}
                className="flex-1 py-4 rounded-2xl bg-[#1A3D2B] items-center"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-bold">Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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