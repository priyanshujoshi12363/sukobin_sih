export type PickedLocation = {
  target: string; // 'pickup' | 'drop' | 'delivery' | …
  coordinates: number[]; // [lng, lat]
  address: string;
};

let pending: PickedLocation | null = null;

export function setPendingLocation(value: PickedLocation) {
  pending = value;
}

export function takePendingLocation(): PickedLocation | null {
  const v = pending;
  pending = null;
  return v;
}
