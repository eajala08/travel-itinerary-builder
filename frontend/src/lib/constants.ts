export const INTEREST_OPTIONS: { key: string; label: string; emoji: string }[] = [
  { key: 'food', label: 'Food', emoji: '🍜' },
  { key: 'fashion', label: 'Fashion', emoji: '👗' },
  { key: 'culture', label: 'Culture', emoji: '🏯' },
  { key: 'history', label: 'History', emoji: '🏛️' },
  { key: 'nature', label: 'Nature', emoji: '🌴' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { key: 'nightlife', label: 'Nightlife', emoji: '🌃' },
  { key: 'sports', label: 'Sports', emoji: '⚽' },
];

export const ACTIVITY_EMOJI: Record<string, string> = {
  restaurant: '🍜',
  temple: '🏯',
  culture: '🏯',
  museum: '🏛️',
  history: '🏛️',
  shopping: '🛍️',
  nature: '🌳',
  nightlife: '🌃',
  sports: '⚽',
  other: '📍',
};

export const DAY_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

export const DAY_EDIT_PRESETS: { label: string; instruction: string }[] = [
  { label: '🔄 Regenerate this day', instruction: 'Rebuild this day with a different mix of places from the same area.' },
  { label: '🌧️ Indoor day', instruction: 'Make this day mostly indoor activities.' },
  { label: '💰 Cheaper day', instruction: 'Make this day cheaper while keeping one highlight.' },
  { label: '😴 Lighter day', instruction: 'Make this day lighter with fewer stops and more downtime.' },
];

export const EDIT_PRESETS: { label: string; instruction: string }[] = [
  { label: '💰 Make it cheaper', instruction: 'Make this itinerary cheaper overall while keeping the highlights.' },
  { label: '🍜 Add more food', instruction: 'Add more food and dining experiences throughout the trip.' },
  { label: '🚶 Less walking', instruction: 'Reduce walking distances and pack the days less tightly.' },
  { label: '🏠 More local', instruction: 'Replace touristy spots with more authentic, local experiences.' },
  { label: '😴 Slow it down', instruction: 'Slow the pace down, leave more free time between activities.' },
];

export const PREF_ITEMS: { key: string; icon: string; iconClass: string; label: string; sub: string }[] = [
  { key: 'food', icon: '🍜', iconClass: 'food', label: 'Food & Dining', sub: 'Local flavors' },
  { key: 'fashion', icon: '👗', iconClass: 'fashion', label: 'Fashion', sub: 'Shopping & style' },
  { key: 'sports', icon: '⚽', iconClass: 'sports', label: 'Sports', sub: 'Active & outdoors' },
  { key: 'culture', icon: '🏯', iconClass: 'culture', label: 'Culture', sub: 'Local life' },
  { key: 'history', icon: '🏛️', iconClass: 'history', label: 'History', sub: 'Museums & sites' },
  { key: 'nature', icon: '🌳', iconClass: 'pref-nature', label: 'Nature', sub: 'Parks & beaches' },
  { key: 'shopping', icon: '🛍️', iconClass: 'pref-shopping', label: 'Shopping', sub: 'Malls & markets' },
  { key: 'nightlife', icon: '🌃', iconClass: 'pref-nightlife', label: 'Nightlife', sub: 'Bars & late nights' },
];

export const MAX_TRIP_DAYS = 14;

export interface Vibe {
  key: string;
  label: string;
  pace: 'relaxed' | 'moderate' | 'packed';
  tourist_level: 'touristy' | 'mixed' | 'local';
  walking: 'avoid' | 'moderate' | 'lots';
}

export const VIBES: Vibe[] = [
  { key: 'relaxed', label: '🌿 Relaxed getaway', pace: 'relaxed', tourist_level: 'mixed', walking: 'avoid' },
  { key: 'adventure', label: '🥾 Adventure-packed', pace: 'packed', tourist_level: 'local', walking: 'lots' },
  { key: 'romantic', label: '🌹 Romantic escape', pace: 'relaxed', tourist_level: 'local', walking: 'moderate' },
  { key: 'family', label: '👨‍👩‍👧 Family friendly', pace: 'moderate', tourist_level: 'touristy', walking: 'moderate' },
];

export interface SignaturePick {
  key: string;
  icon: string;
  label: string;
  sub: string;
  boosts: string[];
}

export const SIGNATURE_PICKS: SignaturePick[] = [
  { key: 'chefs-table', icon: '🍽️', label: "Chef's Table Dinner", sub: 'A standout tasting menu', boosts: ['food'] },
  { key: 'sunrise', icon: '🌅', label: 'Sunrise Adventure', sub: 'Hike, beach, or nature walk', boosts: ['nature', 'sports'] },
  { key: 'old-town', icon: '🏘️', label: 'Old Town Wander', sub: 'Historic streets & shrines', boosts: ['culture', 'history'] },
  { key: 'rooftop', icon: '🌃', label: 'Rooftop Nightlife', sub: 'Bars & city views after dark', boosts: ['nightlife'] },
  { key: 'boutique', icon: '🛍️', label: 'Boutique Shopping', sub: 'Local designers & markets', boosts: ['fashion', 'shopping'] },
  { key: 'live-music', icon: '🎵', label: 'Live Local Music', sub: 'Where the locals go at night', boosts: ['nightlife', 'culture'] },
];

export const QUICK_PROMPTS: string[] = [
  'A 5 day coastal food trip under $1800',
  'Relaxed week of culture and museums',
  'Weekend adventure with lots of hiking',
];
