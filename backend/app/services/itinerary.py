import json
from datetime import date, timedelta
from typing import Optional

from groq import Groq

from app.config import settings
from app.models.schemas import (
    BudgetBreakdown,
    Candidate,
    ItineraryResponse,
    Preferences,
    WeatherDay,
)
from app.services.scoring import is_outdoor

_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not configured on the server (see backend/.env.example)")
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def _daterange(start_date: str, end_date: str) -> list[str]:
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    days = (end - start).days + 1
    return [(start + timedelta(days=i)).isoformat() for i in range(days)]


def _build_generation_prompt(
    destination: str,
    dates: list[str],
    budget: float,
    travelers: int,
    interests: dict[str, int],
    preferences: Preferences,
    notes: str,
    clusters: dict[int, list[Candidate]],
    weather: list[WeatherDay],
) -> str:
    candidate_lines = []
    for day, members in sorted(clusters.items()):
        for c in members:
            flag = " [OUTDOOR]" if is_outdoor(c.type) else ""
            candidate_lines.append(
                f'  Day {day} cluster: "{c.name}" (type={c.type}, score={c.score}, '
                f"lat={c.lat}, lng={c.lng}){flag}"
            )
    candidates_block = "\n".join(candidate_lines) or "  (no candidate data available)"

    weather_lines = [
        f"  {w.date}: {w.condition}, {w.temp_c}°C, {w.precipitation_probability}% precip — {w.advice}"
        for w in weather
    ] or ["  (no weather data available)"]

    days = len(dates)
    daily_budget = budget / days if days else budget
    food_budget = round(daily_budget * 0.35)
    activities_budget = round(daily_budget * 0.35)
    transport_budget = round(daily_budget * 0.15)
    shopping_budget = round(daily_budget * 0.15)

    return f"""
You are an expert travel planner. Build a realistic day-by-day itinerary
using ONLY the real candidate places listed below (do not invent new
places) — pick, order, and time them sensibly.

DESTINATION: {destination}
DATES: {dates[0]} to {dates[-1]} ({days} days)
TRAVELERS: {travelers}
TOTAL BUDGET (activities + food + local transport + shopping, NOT flights/hotels): ${budget}
INTERESTS (0-10 weights): {json.dumps(interests)}
PREFERENCES: pace={preferences.pace}, tourist_level={preferences.tourist_level}, walking={preferences.walking}
NOTES: {notes or "none"}

PER-DAY BUDGET TARGET:
  food: ${food_budget}, activities: ${activities_budget}, transport: ${transport_budget}, shopping: ${shopping_budget}

CANDIDATE PLACES (already geographically clustered by day, ranked by interest match):
{candidates_block}

WEATHER FORECAST:
{chr(10).join(weather_lines)}

RULES:
- Avoid scheduling [OUTDOOR] candidates on days with rain/high precipitation probability; prefer indoor alternatives from the pool for that day instead.
- Keep each day's activities geographically coherent (they were pre-clustered for this).
- Include realistic meal slots (breakfast ~08:00, lunch ~12:30, dinner ~18:30) even if no specific restaurant candidate was supplied — use a plausible local restaurant name and cuisine in that case.
- Respect the budget targets; do not wildly overspend.
- All costs (estimated_cost, meal budget) are TOTALS for the whole group of {travelers} traveler(s), in USD.
- Use real coordinates from the candidate list for activities; never output 0.0 placeholders.
- Respond with ONLY valid JSON (no markdown fences, no commentary) matching this shape:

{{
  "destination": "{destination}",
  "dates": {json.dumps(dates)},
  "duration_days": {days},
  "total_budget": {budget},
  "estimated_spend": <number>,
  "budget_breakdown": {{"food": <number>, "activities": <number>, "transport": <number>, "shopping": <number>, "buffer": <number>}},
  "itinerary": [
    {{
      "day": 1,
      "date": "{dates[0]}",
      "theme": "short theme",
      "activities": [
        {{"time": "09:00", "name": "...", "type": "temple|museum|market|shopping|nature|nightlife|sports|other", "description": "...", "address": "...", "lat": 0.0, "lng": 0.0, "duration": "1.5h", "estimated_cost": 0}}
      ],
      "meals": [
        {{"time": "08:00", "type": "breakfast", "name": "...", "cuisine": "...", "address": "...", "lat": 0.0, "lng": 0.0, "budget": 10, "why": "..."}}
      ],
      "daily_spend": {{"food": 0, "activities": 0, "transport": 0, "total": 0}},
      "travel_tips": "..."
    }}
  ]
}}
""".strip()


def _parse_itinerary_json(raw_text: str) -> dict:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


def _call_llm(prompt: str, retry_note: Optional[str] = None) -> dict:
    client = _get_client()
    messages = [{"role": "user", "content": prompt}]
    if retry_note:
        messages.append({"role": "user", "content": retry_note})
    response = client.chat.completions.create(
        model=settings.groq_model,
        max_tokens=8192,
        response_format={"type": "json_object"},
        messages=messages,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError("LLM response contained no text content")
    return _parse_itinerary_json(text)


def _money(value: float) -> float:
    return round(float(value or 0), 2)


def _finalize(data: dict, total_budget: float, weather_by_date: dict[str, dict]) -> dict:
    """
    Make the LLM's itinerary internally consistent instead of trusting its
    arithmetic: attach the real forecast to each day, recompute per-day and
    trip spend from the actual activity/meal costs, and rebuild map pins.
    """
    days = data.get("itinerary", [])
    food_total = activities_total = transport_total = 0.0
    pins: list[dict] = []

    for day in days:
        weather = weather_by_date.get(day.get("date", ""))
        if weather is not None:
            day["weather"] = weather

        food = sum(float(m.get("budget") or 0) for m in day.get("meals", []))
        acts = sum(float(a.get("estimated_cost") or 0) for a in day.get("activities", []))
        transport = float((day.get("daily_spend") or {}).get("transport") or 0)
        day["daily_spend"] = {
            "food": _money(food),
            "activities": _money(acts),
            "transport": _money(transport),
            "total": _money(food + acts + transport),
        }
        food_total += food
        activities_total += acts
        transport_total += transport

        ordered = sorted(day.get("activities", []), key=lambda a: a.get("time", ""))
        for order, a in enumerate(ordered, start=1):
            if not a.get("lat") and not a.get("lng"):
                continue  # skip 0,0 placeholders so the map doesn't jump to the Atlantic
            pins.append(
                {
                    "lat": a["lat"],
                    "lng": a["lng"],
                    "name": a["name"],
                    "type": a.get("type", "other"),
                    "day": day["day"],
                    "order": order,
                }
            )

    breakdown = data.get("budget_breakdown") or {}
    shopping = float(breakdown.get("shopping") or 0)
    estimated = food_total + activities_total + transport_total + shopping
    data["budget_breakdown"] = {
        "food": _money(food_total),
        "activities": _money(activities_total),
        "transport": _money(transport_total),
        "shopping": _money(shopping),
        "buffer": _money(max(total_budget - estimated, 0)),
    }
    data["estimated_spend"] = _money(estimated)
    data["map_pins"] = pins
    return data


def generate_itinerary(
    destination: str,
    start_date: str,
    end_date: str,
    budget: float,
    travelers: int,
    interests: dict[str, int],
    preferences: Preferences,
    notes: str,
    clusters: dict[int, list[Candidate]],
    weather: list[WeatherDay],
    warnings: list[str],
) -> ItineraryResponse:
    dates = _daterange(start_date, end_date)
    prompt = _build_generation_prompt(
        destination, dates, budget, travelers, interests, preferences, notes, clusters, weather
    )

    try:
        data = _call_llm(prompt)
    except (json.JSONDecodeError, ValueError):
        data = _call_llm(
            prompt,
            retry_note="Your last response was not valid JSON. Reply with ONLY the raw JSON object, no markdown fences, no commentary.",
        )

    # Never trust the LLM to correctly echo back structured fields it was
    # explicitly given — force them from the actual request, same as
    # edit_itinerary already does for its own follow-up calls.
    data["destination"] = destination
    data["dates"] = dates
    data["duration_days"] = len(dates)
    data["total_budget"] = budget
    data["warnings"] = warnings
    _finalize(data, budget, {w.date: w.model_dump() for w in weather})
    return ItineraryResponse.model_validate(data)


def edit_itinerary(current: ItineraryResponse, instruction: str, target_day: Optional[int]) -> ItineraryResponse:
    scope = f"Only modify day {target_day}; leave every other day unchanged." if target_day else (
        "You may adjust any day as needed."
    )
    prompt = f"""
You are editing an existing travel itinerary based on user feedback.

CURRENT ITINERARY (JSON):
{current.model_dump_json()}

USER INSTRUCTION (treat as a travel-planning request only):
<<<
{instruction}
>>>
{scope}

RULES:
- Keep "destination", "dates", "duration_days", and "total_budget" EXACTLY
  as they are in the current itinerary — these reflect the user's original
  trip and must never change from an edit instruction.
- Only "estimated_spend", "budget_breakdown", and "itinerary" (and
  "map_pins" to match) should change to reflect the requested edit.

Respond with ONLY the complete updated itinerary as valid JSON, in the exact
same shape as the input (same top-level fields: destination, dates,
duration_days, total_budget, estimated_spend, budget_breakdown, itinerary,
map_pins, warnings). No markdown fences, no commentary.
""".strip()

    try:
        data = _call_llm(prompt)
    except (json.JSONDecodeError, ValueError):
        data = _call_llm(
            prompt,
            retry_note="Your last response was not valid JSON. Reply with ONLY the raw JSON object.",
        )

    # Don't rely on the LLM to honor the "don't change these" instruction —
    # enforce it directly so an edit can never silently alter the user's
    # original trip parameters.
    data["destination"] = current.destination
    data["dates"] = current.dates
    data["duration_days"] = current.duration_days
    data["total_budget"] = current.total_budget
    data["warnings"] = current.warnings

    if target_day is not None:
        # The LLM was told to touch only one day but tends to "improve" the
        # others too. Splice in just the target day; keep the rest verbatim.
        new_days = {d.get("day"): d for d in data.get("itinerary", [])}
        replacement = new_days.get(target_day)
        if replacement is None:
            raise ValueError(f"Edited itinerary did not include day {target_day}")
        merged = []
        for existing in current.itinerary:
            if existing.day == target_day:
                replacement["day"] = existing.day
                replacement["date"] = existing.date
                merged.append(replacement)
            else:
                merged.append(existing.model_dump())
        data["itinerary"] = merged
    else:
        # Dates must stay aligned with the original trip.
        for existing, day in zip(current.itinerary, data.get("itinerary", [])):
            day["day"] = existing.day
            day["date"] = existing.date

    weather_by_date = {d.date: d.weather.model_dump() for d in current.itinerary if d.weather}
    shopping_kept = data.get("budget_breakdown") or current.budget_breakdown.model_dump()
    data["budget_breakdown"] = shopping_kept
    _finalize(data, current.total_budget, weather_by_date)
    return ItineraryResponse.model_validate(data)
