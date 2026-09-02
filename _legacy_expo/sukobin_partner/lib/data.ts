// Shared driver-app theme + mock data (wire to backend Partner API later)

export const C = {
  // ── light-green brand palette ──
  primary: '#2D6A4F',     // green700 — main CTAs / accents
  primaryDark: '#1A3D2B', // green900
  green900: '#1A3D2B',
  green700: '#2D6A4F',
  green500: '#40916C',
  green400: '#52B788',
  green200: '#B7E4C7',
  green100: '#D8F3DC',
  green50: '#F0FAF3',
  // legacy aliases kept light so old references stay on-theme
  dark: '#1A3D2B',
  dark2: '#2D6A4F',
  amber: '#E8962F',
  amberSoft: '#FBF1DF',
  white: '#FFFFFF',
  bg: '#F4FBF6',
  bg2: '#E3F4E9',
  card: '#FFFFFF',
  text: '#1A3D2B',
  textMid: '#5B7A68',
  textSoft: '#7DAA90',
  border: '#DCEDE3',
  red: '#E63946',
  blue: '#3B82F6',
};

export const STATIONS = [
  'Haldwani', 'Kathgodam', 'Bhimtal', 'Bhowali',
  'Nainital', 'Ranikhet', 'Almora', 'Kainchi Dham',
];

// [lng, lat] — GeoJSON order, sent to the backend route-matching engine
export const STATION_COORDS: Record<string, [number, number]> = {
  Haldwani: [79.5130, 29.2183],
  Kathgodam: [79.5390, 29.2745],
  Bhimtal: [79.5610, 29.3450],
  Bhowali: [79.5050, 29.3895],
  Nainital: [79.4542, 29.3919],
  Ranikhet: [79.4322, 29.6434],
  Almora: [79.6467, 29.5892],
  'Kainchi Dham': [79.5106, 29.4239],
};

export const stationCoords = (name?: string): [number, number] | undefined =>
  name ? STATION_COORDS[name] : undefined;

// A unified delivery job (order OR parcel) returned by /api/partner/route/match
export type Job = {
  kind: 'order' | 'parcel';
  refId: string;
  type: string;
  fee: number;
  weightKg?: number;
  pickup: { label: string; coordinates: [number, number]; phone?: string };
  drop: { label: string; coordinates: [number, number]; phone?: string };
  offRouteKm?: number;   // present in match results
  etaMin?: number;       // pickup → drop travel time
  routeKm?: number;      // pickup → drop road distance
  routePolyline?: [number, number][] | null; // [[lng,lat], …] for the map
  pickupOrder?: number;  // present in match results
  otp?: string | null;   // present after claim, for delivery handoff
  picked?: boolean;      // active trip: has the driver collected it yet
};

export type Vehicle = { key: string; label: string; icon: string; capacity: number };

export const VEHICLES: Vehicle[] = [
  { key: 'bike', label: 'Bike', icon: 'bicycle', capacity: 1 },
  { key: 'auto', label: 'Auto', icon: 'car-sport', capacity: 3 },
  { key: 'car', label: 'Car / Taxi', icon: 'car', capacity: 5 },
  { key: 'pickup', label: 'Pickup', icon: 'car-estate', capacity: 8 },
  { key: 'truck', label: 'Truck', icon: 'truck', capacity: 10 },
];

export const getVehicle = (key?: string) =>
  VEHICLES.find((v) => v.key === key) || VEHICLES[2];

export type Parcel = {
  id: string;
  from: string;
  to: string;
  weightKg: number;
  type: string;
  fee: number;
  customer: string;
  customerPhone: string;
  dropAddress: string;
  otp: string;
};

export const MOCK_PARCELS: Parcel[] = [
  { id: 'PCL-1042', from: 'Haldwani', to: 'Almora', weightKg: 2, type: 'Electronics', fee: 362, customer: 'Ramesh Joshi', customerPhone: '98XXXXXX21', dropAddress: 'Mall Road, near LIC, Almora', otp: '4821' },
  { id: 'PCL-1043', from: 'Haldwani', to: 'Almora', weightKg: 0.5, type: 'Documents', fee: 90, customer: 'Anita Bisht', customerPhone: '97XXXXXX08', dropAddress: 'Dharanaula, Almora', otp: '7710' },
  { id: 'PCL-1051', from: 'Kathgodam', to: 'Almora', weightKg: 5, type: 'Clothes', fee: 240, customer: 'Mohan Singh', customerPhone: '99XXXXXX44', dropAddress: 'Pandey Khola, Almora', otp: '1293' },
  { id: 'PCL-1055', from: 'Haldwani', to: 'Ranikhet', weightKg: 3, type: 'Food', fee: 210, customer: 'Pooja Rawat', customerPhone: '96XXXXXX12', dropAddress: 'Sadar Bazaar, Ranikhet', otp: '5560' },
  { id: 'PCL-1060', from: 'Haldwani', to: 'Almora', weightKg: 1, type: 'Medicines', fee: 120, customer: 'Dr. Verma', customerPhone: '90XXXXXX77', dropAddress: 'Civil Hospital, Almora', otp: '3041' },
  { id: 'PCL-1062', from: 'Bhowali', to: 'Almora', weightKg: 8, type: 'Other', fee: 410, customer: 'Suresh Tamta', customerPhone: '93XXXXXX55', dropAddress: 'Karbala, Almora', otp: '8829' },
  { id: 'PCL-1071', from: 'Haldwani', to: 'Nainital', weightKg: 2, type: 'Electronics', fee: 150, customer: 'Kiran Sah', customerPhone: '95XXXXXX31', dropAddress: 'Tallital, Nainital', otp: '6677' },
];

// parcels whose drop matches the driver's destination
export const matchParcels = (from: string, to: string) =>
  MOCK_PARCELS.filter((p) => p.to === to);

export const DRIVER = {
  name: 'Bhuvan Negi',
  phone: '98765 43210',
  vehicleNumber: 'UK 04 AB 1234',
  vehicleType: 'car',
  rating: 4.8,
  totalTrips: 142,
  totalDeliveries: 318,
  joined: 'Mar 2026',
};

export const STATS = {
  today: { earnings: 640, trips: 2, deliveries: 5, online: '3h 20m' },
  week: [220, 0, 480, 360, 640, 0, 0], // Mon..Sun
  totals: { earnings: 18420, trips: 142, deliveries: 318, rating: 4.8 },
};
