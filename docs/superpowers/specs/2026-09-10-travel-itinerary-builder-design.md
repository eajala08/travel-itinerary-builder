# Travel Itinerary Builder — Design Spec

Date: 2026-09-10
Status: Approved for planning

## Summary

A locally-run web app that takes a destination, trip dates, budget, traveler
count, and interest/preference selections, and produces a personalized,
budget-aware, geographically-clustered day-by-day itinerary. Real-world data
(geocoding, points of interest, weather, travel times) is fetched from free
APIs first; Claude reasons over that real data to build the itinerary,
rather than inventing places from its own knowledge.

## Goals

- Full feature set in one build pass (not a trimmed MVP): input form, real
  data fetch, scoring/clustering, Claude itinerary generation, day-card UI,
  interactive map with routes, budget breakdown, AI-editing follow-ups,
  weather-aware flags, PDF/JSON export.
- All external data APIs are free (no paid tiers, no API keys beyond
  Anthropic's).
- Runs locally (`npm run dev`); no deployment step required for this pass.

## Non-goals

- User accounts, auth, or persistence (Supabase or otherwise) — out of
  scope for this pass.
- Real-time/automatic weather replanning that polls on its own — replaced
  by a manual "adjust for weather" action the user triggers.
- Flight/hotel booking or pricing — budget covers activities, food, local
  transport, and shopping only; this is stated explicitly in the UI.
- Multi-city trips, group cost-splitting, collaborative editing.

## Architecture

Single Next.js 14 app (App Router, TypeScript, Tailwind CSS). Next.js API
routes serve as the backend — no separate server process. All external API
calls happen server-side (API routes), keeping the Anthropic key off the
client.

```
Browser (React/Next.js pages)
   │
   ▼
Next.js API routes
   │
   ├─▶ Nominatim        (geocode destination → lat/lng)
   ├─▶ Overpass          (candidate places: food, culture, shopping, nature)
   ├─▶ Open-Meteo        (forecast for trip dates)
   ├─▶ OSRM              (travel-time matrix between candidates)
   ├─▶ scoring module    (in-process: interest/weather/distance/cost scoring)
   └─▶ Anthropic Claude  (itinerary generation + AI-editing follow-ups)
```

## Data flow

1. **Input form** collects: destination, start/end date, budget (USD),
   traveler count, interests (multi-select), and preference sliders (pace,
   touristy vs. local, budget priority, walking tolerance).
2. **Geocoding**: `POST /api/geocode` calls Nominatim with the destination
   string, returns `{ lat, lng, displayName }`.
3. **Candidate places**: `POST /api/places` calls Overpass with a bounding
   box/radius around the geocoded point, querying OSM tags for restaurants,
   temples/shrines, museums, markets, shopping streets, and parks. Returns a
   deduplicated list of candidates with name, coordinates, OSM tags, and type.
4. **Weather**: `GET /api/weather` calls Open-Meteo for the trip's date
   range at the geocoded coordinates. Returns a daily forecast (condition,
   temp, precipitation probability).
5. **Travel-time matrix**: `POST /api/routes` calls OSRM's table service
   for the candidate set (capped to a reasonable N to avoid huge matrices)
   to get pairwise travel times, used for clustering.
6. **Scoring & clustering** (in-process, no external call): each candidate
   gets a score per user interest weight, adjusted by weather fit (penalize
   outdoor spots on rainy forecast days) and cost fit. Geographic clustering
   groups nearby-scoring candidates into day-sized clusters using the OSRM
   matrix, so each day's activities are geographically coherent.
7. **Itinerary generation**: `POST /api/generate-itinerary` sends Claude a
   prompt containing the user profile, budget breakdown target, the
   pre-scored/clustered candidate pool, and the weather forecast. Claude
   returns structured JSON (day themes, ordered activities with times/
   durations/costs, meals, daily cost totals) validated against a Zod
   schema; invalid/unparseable responses are retried once, then surfaced as
   an error.
8. **Rendering**: day-by-day cards, a Leaflet map (OpenStreetMap tiles)
   showing each day's pins connected by the OSRM route, and a budget
   breakdown panel (category bars vs. total, remaining buffer).
9. **AI editing**: a small set of preset follow-up actions (regenerate day,
   make cheaper, add more of an interest, less walking, more local, slow
   down) plus free-text input. Each sends `POST /api/edit-itinerary` with
   the current itinerary JSON + the instruction; Claude returns either a
   full itinerary or a single modified day, merged into client state.
10. **Weather flag**: days whose forecast shows rain get a badge on
    outdoor activities and a one-click "Adjust for weather" button that
    calls the same edit endpoint with a canned instruction ("swap outdoor
    activities on rainy days for indoor alternatives").
11. **Export**: "Export PDF" (jsPDF, client-side, from the rendered
    itinerary data) and "Export JSON" (raw itinerary object as a download).

## Components

- `InputForm` — trip inputs, interest chips, preference sliders, validation.
- `ItineraryCard` — one day: theme, activities, meals, daily budget summary,
  weather badge, "adjust for weather" button when applicable.
- `Map` — Leaflet map, pins per day (color-coded), OSRM route polylines.
- `BudgetBreakdown` — total budget vs. estimated spend, per-category bars.
- `EditingBar` — preset action buttons + free-text input, calls the edit
  endpoint and patches the current itinerary in state.
- `ExportButton` — PDF and JSON export actions.

State lives in a single Zustand store (`lib/store.ts`) holding the input,
the current itinerary, loading/error state — justified here (unlike the
MVP-only version) because AI-editing patches to nested day/activity state
benefit from centralized update logic shared across `ItineraryCard`,
`EditingBar`, and `ExportButton`.

## Error handling

- Any single free API (Overpass, Open-Meteo, OSRM) failing does not fail
  the whole request: the itinerary-generation prompt proceeds with
  whatever data succeeded, and the UI shows a small non-blocking warning
  banner naming which data source was unavailable.
- Claude responses that fail JSON-schema validation are retried once with
  an added "your last response was invalid JSON, return only valid JSON"
  instruction; a second failure surfaces a user-facing error with a retry
  button.
- Geocoding failure (destination not found) is a hard stop with an inline
  form error — there's nothing to build without it.

## Testing / verification

- No automated test suite is planned for this pass (small, single-user
  local app). Verification is manual: run the dev server, generate a real
  itinerary for a concrete destination (e.g., Tokyo, 3 days, mixed
  interests), and exercise the map, budget breakdown, at least one AI-edit
  action, and both export paths in the browser.
- Schema validation (Zod) on Claude's itinerary JSON acts as a correctness
  guard at runtime.

## Tech stack

- Next.js 14, React, TypeScript, Tailwind CSS
- Zustand (state)
- Leaflet + react-leaflet (map)
- jsPDF (PDF export)
- Zod (schema validation for Claude's JSON output)
- Anthropic SDK (Claude)
- Free APIs: Nominatim, Overpass, Open-Meteo, OSRM
