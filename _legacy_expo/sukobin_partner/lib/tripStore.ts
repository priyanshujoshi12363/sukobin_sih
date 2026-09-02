import { Job } from './data';

export type ActiveTrip = {
  from: string;
  to: string;
  vehicleKey: string;
  jobs: Job[];
  startedAt: number;
};

let trip: ActiveTrip | null = null;
const listeners = new Set<() => void>();

export const tripStore = {
  get: () => trip,
  set: (t: ActiveTrip | null) => {
    trip = t;
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
