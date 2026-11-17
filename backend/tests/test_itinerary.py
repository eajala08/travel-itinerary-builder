from unittest.mock import patch

from app.models.schemas import Candidate, ItineraryResponse, Preferences, WeatherDay
from app.services.itinerary import edit_itinerary, generate_itinerary

TEMPLE = Candidate(id="1", name="Senso-ji", type="temple", lat=35.7148, lng=139.7967)
RAMEN = Candidate(id="2", name="Ramen Yoroiya", type="restaurant", lat=35.7135, lng=139.7955)
RAIN = WeatherDay(date="2026-09-14", condition="Rain", temp_c=21, precipitation_probability=80)


def _llm_day(day: int, activities=None, meals=None, transport=10) -> dict:
    return {
        "day": day,
        "theme": f"Theme {day}",
        "activities": activities or [],
        "meals": meals or [],
        "daily_spend": {"transport": transport, "total": 99999},
        "travel_tips": "",
    }


def _generate(llm_response: dict, end_date: str = "2026-09-14") -> ItineraryResponse:
    with patch("app.services.itinerary._call_llm", return_value=llm_response):
        return generate_itinerary(
            destination="Tokyo, Japan",
            start_date="2026-09-14",
            end_date=end_date,
            budget=1500,
            travelers=2,
            interests={"culture": 8},
            preferences=Preferences(),
            notes="",
            sights={1: [TEMPLE]},
            restaurants={1: [RAMEN]},
            pool=[TEMPLE, RAMEN],
            weather=[RAIN],
            warnings=[],
        )


def test_trip_fields_come_from_the_request_not_the_model():
    result = _generate(
        {"destination": "WRONG CITY", "dates": ["1999-01-01"], "total_budget": 999999, "itinerary": [_llm_day(1)]},
        end_date="2026-09-15",
    )
    assert result.destination == "Tokyo, Japan"
    assert result.dates == ["2026-09-14", "2026-09-15"]
    assert result.duration_days == 2
    assert result.total_budget == 1500


def test_coordinates_come_from_looked_up_places_not_the_model():
    result = _generate(
        {
            "itinerary": [
                _llm_day(
                    1,
                    activities=[
                        {"time": "09:00", "name": "senso-ji ", "lat": 1.0, "lng": 2.0, "estimated_cost": 0},
                        {"time": "11:00", "name": "Invented Tower", "lat": 3.0, "lng": 4.0, "estimated_cost": 20},
                    ],
                    meals=[{"time": "12:30", "type": "lunch", "name": "Ramen Yoroiya", "budget": 30}],
                )
            ]
        }
    )
    real, invented = result.itinerary[0].activities
    assert (real.lat, real.lng, real.verified) == (TEMPLE.lat, TEMPLE.lng, True)
    assert (invented.lat, invented.lng, invented.verified) == (None, None, False)
    assert result.itinerary[0].meals[0].verified is True
    assert [pin["name"] for pin in result.map_pins] == ["senso-ji ", "Ramen Yoroiya"]


def test_spend_totals_are_computed_not_trusted():
    result = _generate(
        {
            "estimated_spend": 1,
            "budget_breakdown": {"shopping": 50, "food": 1, "buffer": 1},
            "itinerary": [
                _llm_day(
                    1,
                    activities=[{"time": "09:00", "name": "Senso-ji", "estimated_cost": 20}],
                    meals=[{"time": "12:30", "type": "lunch", "name": "Ramen Yoroiya", "budget": 30}],
                    transport=10,
                )
            ],
        }
    )
    assert result.itinerary[0].daily_spend.total == 60
    assert result.estimated_spend == 110
    assert result.budget_breakdown.food == 30
    assert result.budget_breakdown.buffer == 1390


def test_weather_is_attached_from_the_forecast():
    result = _generate({"itinerary": [_llm_day(1)]})
    assert result.itinerary[0].weather.condition == "Rain"


def test_single_day_edit_cannot_change_other_days():
    current = _generate(
        {
            "itinerary": [
                _llm_day(1, activities=[{"time": "09:00", "name": "Senso-ji", "estimated_cost": 0}]),
                _llm_day(2, activities=[{"time": "09:00", "name": "Senso-ji", "estimated_cost": 0}]),
            ]
        },
        end_date="2026-09-15",
    )
    model_rewrites_everything = {
        "budget_breakdown": {"shopping": 500},
        "itinerary": [
            _llm_day(1, meals=[{"time": "12:30", "type": "lunch", "name": "Ramen Yoroiya", "budget": 30}]),
            _llm_day(2, meals=[{"time": "12:30", "type": "lunch", "name": "Ramen Yoroiya", "budget": 30}]),
        ],
    }
    with patch("app.services.itinerary._call_llm", return_value=model_rewrites_everything):
        edited = edit_itinerary(current, "more food", target_day=2)

    assert [a.name for a in edited.itinerary[0].activities] == ["Senso-ji"]
    assert edited.itinerary[0].meals == []
    assert [m.name for m in edited.itinerary[1].meals] == ["Ramen Yoroiya"]
    assert edited.budget_breakdown.shopping == 0
    assert edited.total_budget == 1500


def test_shopping_allowance_is_capped():
    result = _generate({"budget_breakdown": {"shopping": 1400}, "itinerary": [_llm_day(1)]})
    assert result.budget_breakdown.shopping == 300
