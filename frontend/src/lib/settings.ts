import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'] as const;
export type Currency = (typeof CURRENCIES)[number];
export type DistanceUnit = 'km' | 'mi';

interface SettingsState {
  currency: Currency;
  distanceUnit: DistanceUnit;
  rates: Partial<Record<Currency, number>>;
  ratesDate: string | null;
  setCurrency: (currency: Currency) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  loadRates: () => Promise<void>;
}

const RATES_URL = `https://api.frankfurter.dev/v1/latest?from=USD&to=${CURRENCIES.filter((c) => c !== 'USD').join(',')}`;

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      currency: 'USD',
      distanceUnit: 'km',
      rates: { USD: 1 },
      ratesDate: null,
      setCurrency: (currency) => {
        set({ currency });
        if (currency !== 'USD') void get().loadRates();
      },
      setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
      loadRates: async () => {
        const today = new Date().toISOString().slice(0, 10);
        if (get().ratesDate === today) return;
        try {
          const response = await fetch(RATES_URL);
          if (!response.ok) return;
          const data = await response.json();
          set({ rates: { USD: 1, ...data.rates }, ratesDate: today });
        } catch {
          // Offline or API down: amounts fall back to USD below.
        }
      },
    }),
    { name: 'travel-itinerary-builder:settings' }
  )
);

/** Formats a USD amount in the chosen currency; shows USD if no rate is available yet. */
export function useMoney(): (usd: number) => string {
  const { currency, rates } = useSettings();
  const rate = rates[currency];
  const shown: Currency = rate ? currency : 'USD';
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: shown,
    maximumFractionDigits: 0,
  });
  return (usd) => formatter.format(usd * (rate ?? 1));
}

export function useDistance(): (km: number) => string {
  const unit = useSettings((s) => s.distanceUnit);
  return (km) => (unit === 'mi' ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`);
}
