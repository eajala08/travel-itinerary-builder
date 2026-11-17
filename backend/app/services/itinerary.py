import json
from datetime import date, timedelta
from typing import Any, Optional

from groq import Groq

from app.config import settings
from app.models.schemas import Candidate, ItineraryResponse, PoolPlace, Preferences, WeatherDay
from app.services.scoring import is_outdoor

_client: Optional[Groq] = None

MAX_SHOPPING_SHARE = 0.2

_ACTIVITIES_PER_DAY = {"relaxed": "2-3", "moderate": "3-4", "packed": "4"}


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


def _num(value: Any) -> float:
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return 0.0


def _name_key(name: Any) -> str:
    return str(name or "").strip().casefold()


def _day_block(
    day: int,
    day_date: str,
    sights: list[Candidate],
    restaurants: list[Candidate],
    weather: Optional[WeatherDay],
) -> str:
    forecast = (
        f"{weather.condition}, {weather.temp_c}°C, {weather.precipitation_probability}% chance of rain"
        if weather
        else "no forecast available"
    )
    sight_lines = [
        f'    - "{s.name}" ({s.type}, interest match {s.score or 0:.0f}/10, at {s.lat:.4f},{s.lng:.4f})'
        + (" [OUTDOOR]" if is_outdoor(s.type) else "")
        for s in sights
    ] or ["    (none found)"]
    restaurant_lines = [
        f'    - "{r.name}" (at {r.lat:.4f},{r.lng:.4f})' + (f' ({r.tags["cuisine"]})' if r.tags.get("cuisine") else "")
        for r in restaurants
    ] or ["    (none found)"]
    return "\n".join(
        [f"DAY {day} ({day_date}) — forecast: {forecast}", "  SIGHTS:", *sight_lines, "  RESTAURANTS:", *restaurant_lines]
    )


_RESPONSE_SHAPE = """{
  "budget_breakdown": {"shopping": <number>},
  "itinerary": [
    {
      "day": 1,
      "theme": "short theme",
      "activities": [
        {"time": "09:00", "name": "<exact name from the list>", "type": "temple|museum|culture|history|shopping|nature|nightlife|sports|other", "description": "...", "duration": "1.5h", "estimated_cost": 0}
      ],
      "meals": [
        {"time": "08:00", "type": "breakfast|lunch|dinner", "name": "<exact name from the list>", "cuisine": "...", "budget": 10, "why": "..."}
      ],
      "daily_spend": {"transport": 0},
      "travel_tips": "..."
    }
  ]
}"""

_GROUNDING_RULES = """- Every activity must be one of the real places listed, written with its EXACT name as given.
- Every meal must be one of the real restaurants listed, written with its EXACT name as given.
- If nothing suitable is listed, use a generic label such as "Lunch near <sight name>". Never invent the name of a specific business or attraction.
- Costs are in US dollars, for the whole group.
- Do not try to spend the whole budget; whatever is left over is the traveler's buffer.
- "shopping" is an optional allowance: 0 unless the traveler is into shopping or fashion, and never more than a fifth of the budget."""


def _build_generation_prompt(
    destination: str,
    dates: list[str],
    budget: float,
    travelers: int,
    interests: dict[str, int],
    preferences: Preferences,
    notes: str,
    sights: dict[int, list[Candidate]],
    restaurants: dict[int, list[Candidate]],
    weather: list[WeatherDay],
) -> str:
    weather_by_date = {w.date: w for w in weather}
    day_blocks = "\n\n".join(
        _day_block(i + 1, d, sights.get(i + 1, []), restaurants.get(i + 1, []), weather_by_date.get(d))
        for i, d in enumerate(dates)
    )
    days = len(dates)
    daily_budget = budget / days if days else budget

    return f"""
You are an expert travel planner. Build a realistic day-by-day itinerary for
the trip below by choosing, ordering, and timing places from the lists given
for each day.

DESTINATION: {destination}
DATES: {dates[0]} to {dates[-1]} ({days} days)
TRAVELERS: {travelers}
TOTAL BUDGET (activities + food + local transport + shopping, NOT flights/hotels): ${budget:.0f}, about ${daily_budget:.0f} per day
INTERESTS (0-10 weights): {json.dumps(interests)}
PREFERENCES: pace={preferences.pace}, tourist_level={preferences.tourist_level}, walking={preferences.walking}
NOTES FROM THE TRAVELER: {notes or "none"}

REAL PLACES, already grouped so each day stays in one part of the city:

{day_blocks}

RULES:
{_GROUNDING_RULES}
- Plan {_ACTIVITIES_PER_DAY.get(preferences.pace, "3-4")} activities per day, plus breakfast (~08:00), lunch (~12:30), and dinner (~18:30). You do not have to use every place listed.
- Keep each day's places within that day's own lists.
- Use the coordinates: order each day so the traveler moves steadily through one area, picking meal spots close to the stops before and after them. Avoid backtracking and long hops.
- Avoid [OUTDOOR] places on days with a high chance of rain.
- Stay within the budget.
- Respond with ONLY valid JSON matching this shape:

{_RESPONSE_SHAPE}
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


def _call_llm_with_retry(prompt: str) -> dict:
    try:
        return _call_llm(prompt)
    except (json.JSONDecodeError, ValueError):
        return _call_llm(
            prompt,
            retry_note="Your last response was not valid JSON. Reply with ONLY the raw JSON object, no markdown fences, no commentary.",
        )


def _finalize(
    data: dict,
    *,
    destination: str,
    dates: list[str],
    total_budget: float,
    pool: list[PoolPlace],
    weather: list[WeatherDay],
    warnings: list[str],
) -> ItineraryResponse:
    """
    Turns raw LLM output into a trustworthy response. Everything the model
    could get wrong but we can know for certain is set here rather than taken
    from the model: trip fields, coordinates, weather, and all arithmetic.
    """
    pool_by_name = {_name_key(p.name): p for p in pool}
    weather_by_date = {w.date: w for w in weather}

    days_out: list[dict] = []
    pins: list[dict] = []
    for index, day in enumerate((data.get("itinerary") or [])[: len(dates)]):
        day_number = index + 1
        for kind in ("activities", "meals"):
            items = [item for item in (day.get(kind) or []) if isinstance(item, dict) and item.get("name")]
            for item in items:
                match = pool_by_name.get(_name_key(item["name"]))
                item["verified"] = match is not None
                item["lat"] = match.lat if match else None
                item["lng"] = match.lng if match else None
                item.setdefault("time", "12:00")
                if kind == "activities":
                    item.setdefault("type", match.type if match else "other")
                    item["estimated_cost"] = _num(item.get("estimated_cost"))
                else:
                    item.setdefault("type", "lunch")
                    item["budget"] = _num(item.get("budget"))
                if match:
                    pins.append(
                        {
                            "lat": match.lat,
                            "lng": match.lng,
                            "name": item["name"],
                            "type": "restaurant" if kind == "meals" else item["type"],
                            "day": day_number,
                        }
                    )
            day[kind] = items

        food = sum(m["budget"] for m in day["meals"])
        activities = sum(a["estimated_cost"] for a in day["activities"])
        transport = _num((day.get("daily_spend") or {}).get("transport"))
        day["daily_spend"] = {
            "food": food,
            "activities": activities,
            "transport": transport,
            "total": food + activities + transport,
        }
        day["day"] = day_number
        day["date"] = dates[index]
        day.setdefault("theme", f"Day {day_number}")
        weather_day = weather_by_date.get(dates[index])
        day["weather"] = weather_day.model_dump() if weather_day else None
        day["route"] = None
        days_out.append(day)

    food_total = sum(d["daily_spend"]["food"] for d in days_out)
    activities_total = sum(d["daily_spend"]["activities"] for d in days_out)
    transport_total = sum(d["daily_spend"]["transport"] for d in days_out)
    # Capped because models tend to park unspent budget in shopping.
    shopping = min(_num((data.get("budget_breakdown") or {}).get("shopping")), total_budget * MAX_SHOPPING_SHARE)
    estimated = food_total + activities_total + transport_total + shopping

    return ItineraryResponse.model_validate(
        {
            "destination": destination,
            "dates": dates,
            "duration_days": len(dates),
            "total_budget": total_budget,
            "estimated_spend": round(estimated),
            "budget_breakdown": {
                "food": round(food_total),
                "activities": round(activities_total),
                "transport": round(transport_total),
                "shopping": round(shopping),
                "buffer": round(max(0.0, total_budget - estimated)),
            },
            "itinerary": days_out,
            "map_pins": pins,
            "warnings": warnings,
            "places": [p.model_dump() for p in pool],
        }
    )


def generate_itinerary(
    destination: str,
    start_date: str,
    end_date: str,
    budget: float,
    travelers: int,
    interests: dict[str, int],
    preferences: Preferences,
    notes: str,
    sights: dict[int, list[Candidate]],
    restaurants: dict[int, list[Candidate]],
    pool: list[Candidate],
    weather: list[WeatherDay],
    warnings: list[str],
) -> ItineraryResponse:
    dates = _daterange(start_date, end_date)
    prompt = _build_generation_prompt(
        destination, dates, budget, travelers, interests, preferences, notes, sights, restaurants, weather
    )
    data = _call_llm_with_retry(prompt)
    return _finalize(
        data,
        destination=destination,
        dates=dates,
        total_budget=budget,
        pool=[PoolPlace(name=c.name, type=c.type, lat=c.lat, lng=c.lng) for c in pool],
        weather=weather,
        warnings=warnings,
    )


def _trimmed_for_prompt(current: ItineraryResponse) -> dict:
    """The current plan without anything the model doesn't need to see or echo back."""
    return {
        "budget_breakdown": {"shopping": current.budget_breakdown.shopping},
        "itinerary": [
            {
                "day": d.day,
                "date": d.date,
                "theme": d.theme,
                "activities": [
                    a.model_dump(include={"time", "name", "type", "description", "duration", "estimated_cost"})
                    for a in d.activities
                ],
                "meals": [
                    m.model_dump(include={"time", "type", "name", "cuisine", "budget", "why"}) for m in d.meals
                ],
                "daily_spend": {"transport": d.daily_spend.transport},
                "travel_tips": d.travel_tips,
            }
            for d in current.itinerary
        ],
    }


def _edit_pool(current: ItineraryResponse) -> list[PoolPlace]:
    """Known real places, plus anything already on the map (trips saved before
    the pool existed carry coordinates only on their own stops)."""
    pool = list(current.places)
    known = {_name_key(p.name) for p in pool}
    for day in current.itinerary:
        stops = [(a, a.type) for a in day.activities] + [(m, "restaurant") for m in day.meals]
        for stop, stop_type in stops:
            if stop.lat is not None and stop.lng is not None and _name_key(stop.name) not in known:
                known.add(_name_key(stop.name))
                pool.append(PoolPlace(name=stop.name, type=stop_type, lat=stop.lat, lng=stop.lng))
    return pool


def edit_itinerary(current: ItineraryResponse, instruction: str, target_day: Optional[int]) -> ItineraryResponse:
    scope = (
        f"Only change day {target_day}; return every other day exactly as it is."
        if target_day
        else "You may adjust any day as needed."
    )
    weather_lines = [
        f"  Day {d.day} ({d.date}): {d.weather.condition}, {d.weather.precipitation_probability}% chance of rain"
        for d in current.itinerary
        if d.weather
    ] or ["  (no forecast available)"]
    pool_lines = [
        f'  - "{p.name}" ({p.type})' + (" [OUTDOOR]" if is_outdoor(p.type) else "") for p in _edit_pool(current)
    ] or ["  (none available)"]

    prompt = f"""
You are editing an existing travel itinerary for {current.destination} based on the traveler's request.

CURRENT ITINERARY (JSON):
{json.dumps(_trimmed_for_prompt(current), ensure_ascii=False)}

TRAVELER'S REQUEST: "{instruction}"
{scope}

TOTAL BUDGET: ${current.total_budget:.0f}

WEATHER:
{chr(10).join(weather_lines)}

REAL PLACES you may add (type "restaurant" entries are for meals):
{chr(10).join(pool_lines)}

RULES:
{_GROUNDING_RULES}
- Places already in the itinerary may stay as they are.
- Respond with ONLY the complete updated itinerary as valid JSON matching this shape:

{_RESPONSE_SHAPE}
""".strip()

    data = _call_llm_with_retry(prompt)

    # A single-day edit must not touch the other days, whatever the model returns.
    if target_day:
        current_days = _trimmed_for_prompt(current)["itinerary"]
        edited = {d.get("day"): d for d in (data.get("itinerary") or []) if isinstance(d, dict)}
        data["itinerary"] = [
            edited.get(d["day"], d) if d["day"] == target_day else d for d in current_days
        ]
        data["budget_breakdown"] = {"shopping": current.budget_breakdown.shopping}

    return _finalize(
        data,
        destination=current.destination,
        dates=current.dates,
        total_budget=current.total_budget,
        pool=_edit_pool(current),
        weather=[d.weather for d in current.itinerary if d.weather],
        warnings=current.warnings,
    )
