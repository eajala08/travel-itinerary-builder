from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.models.schemas import (
    Candidate,
    ItineraryResponse,
    Preferences,
    TripInput,
    WeatherDay,
)
from app.services.itinerary import edit_itinerary, generate_itinerary
from app.services.scoring import cluster_into_days


def _activity(name: str, cost: float = 10, lat: float = 1.0, lng: float = 2.0) -> dict:
    return {
        "time": "09:00",
        "name": name,
        "type": "museum",
        "description": "d",
        "lat": lat,
        "lng": lng,
        "estimated_cost": cost,
    }


def _meal(name: str, budget: float = 15) -> dict:
    return {"time": "12:30", "type": "lunch", "name": name, "lat": 1.0, "lng": 2.0, "budget": budget}


def _day(day: int, date: str, activities=None, meals=None, transport: float = 5) -> dict:
    return {
        "day": day,
        "date": date,
        "theme": f"Day {day}",
        "activities": activities or [],
        "meals": meals or [],
        "daily_spend": {"food": 999, "activities": 999, "transport": transport, "total": 999},
        "travel_tips": "",
    }


def _llm(days: list[dict], shopping: float = 20) -> dict:
    return {
        "destination": "x",
        "dates": [],
        "duration_days": 0,
        "total_budget": 0,
        "estimated_spend": 12345,
        "budget_breakdown": {"food": 1, "activities": 1, "transport": 1, "shopping": shopping, "buffer": 1},
        "itinerary": days,
    }


def _generate(llm_data: dict, weather=None) -> ItineraryResponse:
    with patch("app.services.itinerary._call_llm", return_value=llm_data):
        return generate_itinerary(
            destination="Lisbon",
            start_date="2026-09-14",
            end_date="2026-09-15",
            budget=500,
            travelers=2,
            interests={},
            preferences=Preferences(),
            notes="",
            clusters={1: [], 2: []},
            weather=weather or [],
            warnings=["w1"],
        )


def test_generate_attaches_weather_to_matching_day():
    weather = [
        WeatherDay(date="2026-09-14", condition="Rain", temp_c=18, precipitation_probability=80),
        WeatherDay(date="2026-09-15", condition="Clear", temp_c=25, precipitation_probability=0),
    ]
    result = _generate(_llm([_day(1, "2026-09-14"), _day(2, "2026-09-15")]), weather)
    assert result.itinerary[0].weather.condition == "Rain"
    assert result.itinerary[1].weather.condition == "Clear"


def test_generate_recomputes_spend_so_numbers_add_up():
    days = [
        _day(1, "2026-09-14", activities=[_activity("A", 10), _activity("B", 30)], meals=[_meal("M", 15)]),
        _day(2, "2026-09-15", meals=[_meal("N", 25)], transport=10),
    ]
    result = _generate(_llm(days, shopping=20))
    d1, d2 = result.itinerary
    assert (d1.daily_spend.food, d1.daily_spend.activities, d1.daily_spend.total) == (15, 40, 60)
    assert d2.daily_spend.total == 35
    assert result.budget_breakdown.food == 40
    assert result.budget_breakdown.activities == 40
    assert result.budget_breakdown.transport == 15
    assert result.estimated_spend == 60 + 35 + 20
    assert result.budget_breakdown.buffer == 500 - 115


def test_generate_rebuilds_map_pins_with_order():
    days = [_day(1, "2026-09-14", activities=[_activity("A"), _activity("B")])]
    result = _generate(_llm(days))
    assert [(p["name"], p["day"], p["order"]) for p in result.map_pins] == [("A", 1, 1), ("B", 1, 2)]


def _existing() -> ItineraryResponse:
    weather = [WeatherDay(date="2026-09-14", condition="Rain", temp_c=18, precipitation_probability=80)]
    days = [
        _day(1, "2026-09-14", activities=[_activity("Keep me")]),
        _day(2, "2026-09-15", activities=[_activity("Old day 2")]),
    ]
    return _generate(_llm(days), weather)


def test_edit_with_target_day_only_replaces_that_day():
    current = _existing()
    llm_out = _llm(
        [
            _day(1, "2026-09-14", activities=[_activity("LLM changed day 1 anyway")]),
            _day(2, "2026-09-15", activities=[_activity("New day 2")]),
        ]
    )
    with patch("app.services.itinerary._call_llm", return_value=llm_out):
        result = edit_itinerary(current, "change day 2", target_day=2)

    assert result.itinerary[0].activities[0].name == "Keep me"
    assert result.itinerary[1].activities[0].name == "New day 2"
    assert {p["name"] for p in result.map_pins} == {"Keep me", "New day 2"}


def test_edit_preserves_weather_and_warnings():
    current = _existing()
    llm_out = _llm([_day(1, "2026-09-14"), _day(2, "2026-09-15")])
    with patch("app.services.itinerary._call_llm", return_value=llm_out):
        result = edit_itinerary(current, "cheaper", target_day=None)
    assert result.itinerary[0].weather.condition == "Rain"
    assert result.warnings == ["w1"]


def test_cluster_ignores_matrix_smaller_than_candidate_list():
    """OSRM is capped at 40 coords; more candidates than that used to raise IndexError."""
    candidates = [Candidate(id=str(i), name=str(i), type="museum", lat=0, lng=0) for i in range(5)]
    small_matrix = [[0, 1], [1, 0]]
    clusters = cluster_into_days(candidates, small_matrix, num_days=2, max_per_day=4)
    assert sum(len(v) for v in clusters.values()) == 5


@pytest.mark.parametrize(
    "overrides",
    [
        {"start_date": "2026-09-15", "end_date": "2026-09-14"},
        {"start_date": "2026-09-01", "end_date": "2026-09-30"},
        {"budget": 0},
        {"travelers": 0},
        {"destination": "   "},
        {"start_date": "not-a-date"},
    ],
)
def test_trip_input_rejects_bad_values(overrides):
    base = {"destination": "Paris", "start_date": "2026-09-14", "end_date": "2026-09-16", "budget": 500}
    base.update(overrides)
    with pytest.raises(ValidationError):
        TripInput(**base)
