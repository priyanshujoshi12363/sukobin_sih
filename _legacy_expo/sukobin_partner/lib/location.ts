import { api } from './api';

// Streams the driver's live location to the backend while they're online / on a trip.
// The backend uses it to tell customers "driver is near" within 10 km of the drop.
//
// expo-location is a NATIVE module — guard the import so the app still runs in a dev
// client that wasn't built with it yet. It activates automatically after a rebuild.
let Location: any = null;
try {
  Location = require('expo-location');
} catch {
  Location = null;
}

let sub: any = null;
let lastSent = 0;

const send = (lng: number, lat: number) => {
  api.patch('/api/partner/location', { coordinates: [lng, lat] }).catch(() => {});
};

export const LocationTracker = {
  async start() {
    if (!Location || sub) return; // native module missing → no-op until rebuild
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // send one fix immediately, then watch
      try {
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        send(first.coords.longitude, first.coords.latitude);
        lastSent = Date.now();
      } catch {}

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 50 },
        (loc: any) => {
          const now = Date.now();
          if (now - lastSent < 12000) return; // throttle to ~1 update / 12s
          lastSent = now;
          send(loc.coords.longitude, loc.coords.latitude);
        }
      );
    } catch {
      // location unavailable — silently skip
    }
  },

  stop() {
    try { sub?.remove?.(); } catch {}
    sub = null;
  },

  isRunning() {
    return !!sub;
  },
};
