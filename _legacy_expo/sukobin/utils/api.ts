import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://sukobin-v2.onrender.com';

const api = {
  async post(endpoint: string, data: any) {
    const token = await AsyncStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async get(endpoint: string) {
    const token = await AsyncStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
    return response.json();
  },

  async put(endpoint: string, data: any) {
    const token = await AsyncStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async patch(endpoint: string, data?: any) {
    const token = await AsyncStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(data || {})
    });
    return response.json();
  },

  async delete(endpoint: string) {
    const token = await AsyncStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
    return response.json();
  }
};

export default api;