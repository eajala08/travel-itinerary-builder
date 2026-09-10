import type { ItineraryResponse } from '../types/itinerary';

export default function BudgetBreakdown({ itinerary }: { itinerary: ItineraryResponse }) {
  const { budget_breakdown, total_budget, estimated_spend, duration_days } = itinerary;
  const remaining = total_budget - estimated_spend;
  const percentSpent = Math.min((estimated_spend / total_budget) * 100, 100);

  const categories: { name: string; amount: number; color: string; emoji: string }[] = [
    { name: 'Food', amount: budget_breakdown.food, color: 'bg-amber-500', emoji: '🍽️' },
    { name: 'Activities', amount: budget_breakdown.activities, color: 'bg-purple-500', emoji: '🎫' },
    { name: 'Transport', amount: budget_breakdown.transport, color: 'bg-green-500', emoji: '🚆' },
    { name: 'Shopping', amount: budget_breakdown.shopping, color: 'bg-pink-500', emoji: '🛍️' },
    { name: 'Buffer', amount: budget_breakdown.buffer, color: 'bg-gray-400', emoji: '💰' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Budget Breakdown</h2>

      <div className="mb-4">
        <div className="flex justify-between mb-1 text-sm">
          <span className="font-medium text-gray-700">Estimated spend</span>
          <span className="font-bold text-gray-800">
            ${estimated_spend} / ${total_budget}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-500 to-blue-500 h-full"
            style={{ width: `${percentSpent}%` }}
          />
        </div>
        {remaining > 0 && <p className="text-xs text-green-600 mt-1">${remaining} buffer remaining</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {categories.map((c) => (
          <div key={c.name} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">
              {c.emoji} {c.name}
            </p>
            <p className="text-lg font-bold text-gray-800">${c.amount}</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className={`${c.color} h-full rounded-full`}
                style={{ width: `${total_budget ? (c.amount / total_budget) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        ~${Math.round(estimated_spend / duration_days)}/day average. Covers activities, food, local transport, and
        shopping — flights and lodging are not included.
      </p>
    </div>
  );
}
