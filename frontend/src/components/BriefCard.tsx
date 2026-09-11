import { QUICK_PROMPTS } from '../lib/constants';

interface Props {
  destination: string;
  onDestinationChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  travelers: number;
  onTravelersChange: (value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

export default function BriefCard({
  destination,
  onDestinationChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  travelers,
  onTravelersChange,
  notes,
  onNotesChange,
}: Props) {
  return (
    <div className="brief-card">
      <div className="brief-top">
        <div className="spark">✦</div>
        <div>
          <h2>Plan your trip</h2>
          <p>Tell us the basics, we'll build the rest around real places and weather.</p>
        </div>
      </div>

      <div className="trip-basics">
        <div>
          <label htmlFor="destination">Destination</label>
          <input
            id="destination"
            type="text"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            placeholder="Tokyo, Japan"
          />
        </div>
        <div>
          <label htmlFor="start-date">Start</label>
          <input id="start-date" type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
        </div>
        <div>
          <label htmlFor="end-date">End</label>
          <input id="end-date" type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
        </div>
        <div>
          <label htmlFor="travelers">Travelers</label>
          <input
            id="travelers"
            type="number"
            min={1}
            value={travelers}
            onChange={(e) => onTravelersChange(Number(e.target.value))}
          />
        </div>
      </div>

      <label className="prompt-box">
        <textarea
          id="trip-prompt"
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any notes? e.g. traveling solo, vegetarian, love street food..."
        />
        <button type="button" className="mic" aria-label="Voice input (not available)" title="Voice input not available">
          🎙
        </button>
      </label>

      <div className="quick-row">
        <span>Try:</span>
        {QUICK_PROMPTS.map((text) => (
          <button key={text} type="button" className="quick-prompt" onClick={() => onNotesChange(text)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
