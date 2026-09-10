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
        max_tokens=4096,
        messages=messages,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError("LLM response contained no text content")
    return _parse_itinerary_json(text)


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

    data.setdefault("map_pins", [])
    for day in data.get("itinerary", []):
        pins = [
            {"lat": a["lat"], "lng": a["lng"], "name": a["name"], "type": a["type"], "day": day["day"]}
            for a in day.get("activities", [])
        ]
        data["map_pins"].extend(pins)

    data["warnings"] = warnings
    return ItineraryResponse.model_validate(data)


def edit_itinerary(current: ItineraryResponse, instruction: str, target_day: Optional[int]) -> ItineraryResponse:
    scope = f"Only modify day {target_day}; leave every other day unchanged." if target_day else (
        "You may adjust any day as needed."
    )
    prompt = f"""
You are editing an existing travel itinerary based on user feedback.

CURRENT ITINERARY (JSON):
{current.model_dump_json()}

USER INSTRUCTION: "{instruction}"
{scope}

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
    return ItineraryResponse.model_validate(data)
