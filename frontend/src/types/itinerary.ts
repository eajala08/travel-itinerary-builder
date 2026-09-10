export interface Preferences {
  pace: 'relaxed' | 'moderate' | 'packed';
  tourist_level: 'touristy' | 'mixed' | 'local';
  walking: 'avoid' | 'moderate' | 'lots';
}

export interface TripInput {
  destination: string;
  start_date: string;
  end_date: string;
  budget: number;
  travelers: number;
  interests: Record<string, number>;
  preferences: Preferences;
  notes: string;
}

export interface Activity {
  time: string;
  name: string;
  type: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  duration: string;
  estimated_cost: number;
}

export interface Meal {
  time: string;
  type: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  cuisine: string;
  address: string;
  lat: number;
  lng: number;
  budget: number;
  why: string;
}

export interface WeatherDay {
  date: string;
  condition: string;
  temp_c: number;
  precipitation_probability: number;
  advice: string;
}

export interface DailySpend {
  food: number;
  activities: number;
  transport: number;
  total: number;
}

export interface DayItinerary {
  day: number;
  date: string;
  theme: string;
  activities: Activity[];
  meals: Meal[];
  weather?: WeatherDay | null;
  daily_spend: DailySpend;
  travel_tips: string;
}

export interface BudgetBreakdown {
  food: number;
  activities: number;
  transport: number;
  shopping: number;
  buffer: number;
}

export interface MapPin {
  lat: number;
  lng: number;
  name: string;
  type: string;
  day: number;
}

export interface ItineraryResponse {
  destination: string;
  dates: string[];
  duration_days: number;
  total_budget: number;
  estimated_spend: number;
  budget_breakdown: BudgetBreakdown;
  itinerary: DayItinerary[];
  map_pins: MapPin[];
  warnings: string[];
}
