import { useEffect } from 'react';
import { CURRENCIES, useSettings, type Currency } from '../lib/settings';

export default function SettingsPanel() {
  const { currency, distanceUnit, ratesDate, setCurrency, setDistanceUnit, loadRates } = useSettings();

  useEffect(() => {
    if (currency !== 'USD') void loadRates();
  }, [currency, loadRates]);

  return (
    <div className="brief-card">
      <div className="brief-top">
        <div className="spark">⚙</div>
        <div>
          <h2>Settings</h2>
          <p>Saved in this browser.</p>
        </div>
      </div>

      <div className="settings-rows">
        <label className="settings-row">
          <span>
            <b>Currency</b>
            <small>
              Budgets are planned in US dollars and shown in this currency
              {currency !== 'USD' && ratesDate ? ` (rates from ${ratesDate})` : ''}.
            </small>
          </span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="settings-row">
          <span>
            <b>Distance</b>
            <small>Used for walking distances between stops.</small>
          </span>
          <div className="settings-toggle" role="radiogroup" aria-label="Distance unit">
            {(['km', 'mi'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                role="radio"
                aria-checked={distanceUnit === unit}
                className={`vibe-chip${distanceUnit === unit ? ' active' : ''}`}
                onClick={() => setDistanceUnit(unit)}
              >
                {unit === 'km' ? 'Kilometers' : 'Miles'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
