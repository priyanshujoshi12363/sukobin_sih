import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '@/service/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export default function ManageShopScreen() {
  const [shopData, setShopData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    shopName: '',
    description: '',
    category: '',
    subCategory: '',
    phoneNumber: '',
    houseNumber: '',
    landmark: '',
    village: '',
    town: '',
    district: '',
    state: '',
    pincode: '',
  });
  
  const [shopLogo, setShopLogo] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);

  useEffect(() => {
    fetchShopData();
  }, []);

  const fetchShopData = async () => {
    try {
      const response = await api.get('/api/shop/get');
      if (response.success && response.shop) {
        setShopData(response.shop);
        // Initialize edit form with current data
        setEditForm({
          shopName: response.shop.shopName || '',
          description: response.shop.description || '',
          category: response.shop.category || '',
          subCategory: response.shop.subCategory || '',
          phoneNumber: response.shop.phoneNumber || '',
          houseNumber: response.shop.address?.houseNumber || '',
          landmark: response.shop.address?.landmark || '',
          village: response.shop.address?.village || '',
          town: response.shop.address?.town || '',
          district: response.shop.address?.district || '',
          state: response.shop.address?.state || '',
          pincode: response.shop.address?.pincode || '',
        });
      }
    } catch (error) {
      console.error('Error fetching shop:', error);
      Alert.alert('Error', 'Failed to load shop data');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (setImage: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpdateShop = async () => {
    if (!editForm.shopName.trim()) {
      Alert.alert('Error', 'Shop name is required');
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append('shopName', editForm.shopName.trim());
      form.append('description', editForm.description.trim());
      form.append('category', editForm.category.trim());
      form.append('subCategory', editForm.subCategory.trim());
      form.append('phoneNumber', editForm.phoneNumber.trim());
      
      const addressObj = {
        houseNumber: editForm.houseNumber,
        landmark: editForm.landmark,
        village: editForm.village,
        town: editForm.town,
        district: editForm.district,
        state: editForm.state,
        pincode: editForm.pincode,
      };
      
      form.append('address', JSON.stringify(addressObj));

      if (shopLogo) {
        form.append('shopLogo', {
          uri: shopLogo,
          type: 'image/jpeg',
          name: 'shop-logo.jpg',
        } as any);
      }
      
      if (bannerImage) {
        form.append('bannerImage', {
          uri: bannerImage,
          type: 'image/jpeg',
          name: 'banner-image.jpg',
        } as any);
      }

      const response = await api.put(`/api/shop/edit/${shopData._id}`, form,true);

      if (response.success) {
        Alert.alert('Success', 'Shop updated successfully!');
        setEditMode(false);
        fetchShopData();
      } else {
        Alert.alert('Error', response.message || 'Failed to update shop');
      }
    } catch (error: any) {
      console.error('Update error:', error);
      Alert.alert('Error', error?.message || 'Failed to update shop');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShop = () => {
    Alert.alert(
      'Delete Shop',
      'Are you sure you want to delete your shop? This action cannot be undone. All your products and data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/api/shop/delete/${shopData._id}`);
              if (response.success) {
                await AsyncStorage.removeItem('shopData');
                Alert.alert('Deleted', 'Your shop has been deleted', [
                  { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
                ]);
              } else {
                Alert.alert('Error', response.message || 'Failed to delete shop');
              }
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete shop');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F8F4] justify-center items-center">
        <ActivityIndicator size="large" color="#1A3D2B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3 shadow-sm"
            >
              <Ionicons name="arrow-back" size={20} color="#1A3D2B" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-[#1A3D2B]">Manage Shop</Text>
          </View>
          {!editMode && (
            <TouchableOpacity
              onPress={() => setEditMode(true)}
              className="bg-[#1A3D2B] px-4 py-2 rounded-full"
            >
              <Text className="text-white text-sm font-semibold">Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Shop Preview */}
        <View className="px-6 mt-4">
          <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            {/* Banner */}
            {(bannerImage || shopData?.bannerImage) && (
              <Image
                source={{ uri: bannerImage || shopData?.bannerImage }}
                className="w-full h-32 rounded-xl mb-4"
                resizeMode="cover"
              />
            )}
            {editMode && (
              <TouchableOpacity
                onPress={() => pickImage(setBannerImage)}
                className="absolute top-5 right-5 bg-black/50 p-2 rounded-full"
              >
                <Ionicons name="camera" size={16} color="white" />
              </TouchableOpacity>
            )}

            {/* Logo & Info */}
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={editMode ? () => pickImage(setShopLogo) : undefined}
                disabled={!editMode}
              >
                {(shopLogo || shopData?.shopLogo) ? (
                  <Image
                    source={{ uri: shopLogo || shopData?.shopLogo }}
                    className="w-16 h-16 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-16 h-16 rounded-full bg-[#D8F3DC] items-center justify-center">
                    <Ionicons name="storefront" size={28} color="#1A3D2B" />
                  </View>
                )}
                {editMode && (
                  <View className="absolute bottom-0 right-0 bg-[#1A3D2B] p-1 rounded-full">
                    <Ionicons name="camera" size={12} color="white" />
                  </View>
                )}
              </TouchableOpacity>
              <View className="ml-3 flex-1">
                {editMode ? (
                  <TextInput
                    className="text-lg font-bold text-[#1A3D2B] border-b border-gray-200 pb-1"
                    value={editForm.shopName}
                    onChangeText={(text) => setEditForm({ ...editForm, shopName: text })}
                    placeholder="Shop Name"
                  />
                ) : (
                  <Text className="text-xl font-bold text-[#1A3D2B]">{shopData?.shopName}</Text>
                )}
                <Text className="text-xs text-gray-500 mt-0.5">
                  {shopData?.category} • {shopData?.subCategory}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Edit Form */}
        {editMode && (
          <View className="px-6 mt-4">
            <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <Text className="text-lg font-bold text-[#1A3D2B] mb-4">Edit Shop Details</Text>

              <Field label="Description">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  value={editForm.description}
                  onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Field>

              <Field label="Category">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  value={editForm.category}
                  onChangeText={(text) => setEditForm({ ...editForm, category: text })}
                />
              </Field>

              <Field label="Sub Category">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  value={editForm.subCategory}
                  onChangeText={(text) => setEditForm({ ...editForm, subCategory: text })}
                />
              </Field>

              <Field label="Phone Number">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  value={editForm.phoneNumber}
                  onChangeText={(text) => setEditForm({ ...editForm, phoneNumber: text })}
                  keyboardType="phone-pad"
                />
              </Field>

              <Text className="text-sm font-bold text-gray-400 uppercase mt-4 mb-3">Address</Text>

              <Field label="House No.">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  value={editForm.houseNumber}
                  onChangeText={(text) => setEditForm({ ...editForm, houseNumber: text })}
                />
              </Field>

              <Field label="Landmark">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  value={editForm.landmark}
                  onChangeText={(text) => setEditForm({ ...editForm, landmark: text })}
                />
              </Field>

              <Field label="Village">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  value={editForm.village}
                  onChangeText={(text) => setEditForm({ ...editForm, village: text })}
                />
              </Field>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Town">
                    <TextInput
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                      value={editForm.town}
                      onChangeText={(text) => setEditForm({ ...editForm, town: text })}
                    />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="District">
                    <TextInput
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                      value={editForm.district}
                      onChangeText={(text) => setEditForm({ ...editForm, district: text })}
                    />
                  </Field>
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="State">
                    <TextInput
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                      value={editForm.state}
                      onChangeText={(text) => setEditForm({ ...editForm, state: text })}
                    />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="Pincode">
                    <TextInput
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                      value={editForm.pincode}
                      onChangeText={(text) => setEditForm({ ...editForm, pincode: text })}
                      keyboardType="numeric"
                      maxLength={6}
                    />
                  </Field>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-6">
                <TouchableOpacity
                  onPress={() => setEditMode(false)}
                  className="flex-1 py-4 rounded-2xl bg-gray-200 items-center"
                >
                  <Text className="text-gray-700 font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpdateShop}
                  disabled={saving}
                  className="flex-1 py-4 rounded-2xl bg-[#1A3D2B] items-center"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-bold">Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Delete Shop Section */}
        {!editMode && (
          <View className="px-6 mt-6 mb-10">
            <TouchableOpacity
              onPress={handleDeleteShop}
              className="bg-white rounded-3xl p-5 shadow-sm border border-red-200"
            >
              <View className="flex-row items-center">
                <View className="bg-red-100 p-3 rounded-full">
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-bold text-red-600">Delete Shop</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Permanently delete your shop and all data
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#EF4444" />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Field Component
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text className="text-xs font-bold text-gray-600 mb-1">{label}</Text>
      {children}
    </View>
  );
}

