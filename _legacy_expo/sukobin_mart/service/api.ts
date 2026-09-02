import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://sukobin-v2.onrender.com'; 

export const api = {
  get: async (endpoint: string, options?: { params?: Record<string, any> }) => {
    const token = await AsyncStorage.getItem('merchantToken');
    
    // Build query string from params
    let url = `${API_BASE_URL}${endpoint}`;
    if (options?.params) {
      const queryString = Object.entries(options.params)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });
    return response.json();
  },

  post: async (endpoint: string, data: any, isFormData = false) => {
    const token = await AsyncStorage.getItem('merchantToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData — fetch sets it automatically with boundary
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: isFormData ? data : JSON.stringify(data),
    });
    return response.json();
  },

  put: async (endpoint: string, data: any, isFormData = false) => {
    const token = await AsyncStorage.getItem('merchantToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: isFormData ? data : JSON.stringify(data),
    });
    return response.json();
  },

  // ✅ Added PATCH method
  patch: async (endpoint: string, data?: any, isFormData = false) => {
    const token = await AsyncStorage.getItem('merchantToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      // PATCH can have optional body
      body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    });
    return response.json();
  },

  delete: async (endpoint: string) => {
    const token = await AsyncStorage.getItem('merchantToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });
    return response.json();
  },
};