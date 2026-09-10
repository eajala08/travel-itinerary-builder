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

export const EDIT_PRESETS: { label: string; instruction: string }[] = [
  { label: '💰 Make it cheaper', instruction: 'Make this itinerary cheaper overall while keeping the highlights.' },
  { label: '🍜 Add more food', instruction: 'Add more food and dining experiences throughout the trip.' },
  { label: '🚶 Less walking', instruction: 'Reduce walking distances and pack the days less tightly.' },
  { label: '🏠 More local', instruction: 'Replace touristy spots with more authentic, local experiences.' },
  { label: '😴 Slow it down', instruction: 'Slow the pace down, leave more free time between activities.' },
];
