import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://sukobin-v2.onrender.com';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('partnerToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  post: async (endpoint: string, data?: any) => {
    const h = await authHeaders();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify(data || {}),
    });
    return res.json();
  },
  patch: async (endpoint: string, data?: any) => {
    const h = await authHeaders();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify(data || {}),
    });
    return res.json();
  },
  get: async (endpoint: string) => {
    const h = await authHeaders();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers: { ...h } });
    return res.json();
  },
};

export type SessionResult =
  | { status: 'unauthenticated' }            // no token stored
  | { status: 'authenticated'; partner: any } // token valid — verified by backend
  | { status: 'invalid' }                     // backend rejected the token (expired/blocked/deleted)
  | { status: 'offline' };                    // couldn't reach backend — keep the session

// Verify the stored JWT against the backend (GET /api/partner/me).
// This is the source of truth for "am I logged in", not just the presence of a token string.
export async function verifySession(): Promise<SessionResult> {
  const token = await AsyncStorage.getItem('partnerToken');
  if (!token) return { status: 'unauthenticated' };

  try {
    const res = await fetch(`${API_BASE_URL}/api/partner/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.partner) {
        // refresh the cached profile so the dashboard always has the latest data
        await AsyncStorage.setItem('partnerData', JSON.stringify(data.partner));
        return { status: 'authenticated', partner: data.partner };
      }
      return { status: 'invalid' };
    }

    // 401 = bad/expired token, 403 = blocked account → force re-login
    if (res.status === 401 || res.status === 403) return { status: 'invalid' };

    // 5xx / unexpected → don't punish the user, keep them signed in
    return { status: 'offline' };
  } catch {
    // network failure (no internet, server asleep) → keep the session
    return { status: 'offline' };
  }
}

// Clear all partner session data (used on logout / invalid token).
export async function clearSession() {
  await AsyncStorage.multiRemove(['partnerToken', 'partnerData', 'partnerExpoToken']);
}
