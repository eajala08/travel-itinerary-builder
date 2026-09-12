import json
from unittest.mock import patch

from app.models.schemas import Preferences
from app.services.itinerary import generate_itinerary


def _fake_llm_response(**overrides) -> dict:
    base = {
        "destination": "WRONG CITY",
        "dates": ["1999-01-01"],
        "duration_days": 1,
        "total_budget": 999999,
        "estimated_spend": 100,
        "budget_breakdown": {"food": 25, "activities": 25, "transport": 25, "shopping": 25, "buffer": 0},
        "itinerary": [
            {
                "day": 1,
                "date": "2026-09-14",
                "theme": "Test day",
                "activities": [],
                "meals": [],
                "daily_spend": {"food": 0, "activities": 0, "transport": 0, "total": 0},
                "travel_tips": "",
            }
        ],
    }
    base.update(overrides)
    return base


def test_generate_itinerary_forces_requested_trip_fields():
    """The LLM's echoed destination/dates/budget must never override the actual request."""
    fake_response = _fake_llm_response()

    with patch("app.services.itinerary._call_llm", return_value=fake_response):
        result = generate_itinerary(
            destination="Tokyo, Japan",
            start_date="2026-09-14",
            end_date="2026-09-15",
            budget=1500,
            travelers=2,
            interests={"food": 8},
            preferences=Preferences(),
            notes="",
            clusters={1: []},
            weather=[],
            warnings=[],
        )

    assert result.destination == "Tokyo, Japan"
    assert result.dates == ["2026-09-14", "2026-09-15"]
    assert result.duration_days == 2
    assert result.total_budget == 1500
