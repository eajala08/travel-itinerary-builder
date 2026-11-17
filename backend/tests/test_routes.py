from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import Candidate, GeocodeResult
from app.services.itinerary import generate_itinerary as real_generate_itinerary

client = TestClient(app)

TRIP = {"destination": "Rome", "start_date": "2026-09-14", "end_date": "2026-09-15", "budget": 800}


def _llm_stub(**kwargs):
    with patch(
        "app.services.itinerary._call_llm",
        return_value={
            "budget_breakdown": {"shopping": 0},
            "itinerary": [
                {"day": 1, "date": "2026-09-14", "theme": "t"},
                {"day": 2, "date": "2026-09-15", "theme": "t"},
            ],
        },
    ):
        return real_generate_itinerary(**kwargs)


def test_generate_survives_more_candidates_than_osrm_matrix():
    """60 places but OSRM caps at 40 — this used to 500 with an IndexError."""
    candidates = [Candidate(id=str(i), name=f"p{i}", type="museum", lat=41.9, lng=12.5) for i in range(60)]
    matrix_calls = []

    async def fake_matrix(coords):
        matrix_calls.append(len(coords))
        return [[0.0] * len(coords) for _ in coords]

    with (
        patch("app.services.geocode.geocode_destination", AsyncMock(return_value=GeocodeResult(lat=41.9, lng=12.5, display_name="Rome"))),
        patch("app.services.places.search_places", AsyncMock(return_value=candidates)),
        patch("app.services.weather.get_forecast", AsyncMock(side_effect=RuntimeError("down"))),
        patch("app.services.routes.get_travel_time_matrix", fake_matrix),
        patch("app.services.itinerary.generate_itinerary", side_effect=_llm_stub),
    ):
        response = client.post("/generate-itinerary", json={**TRIP, "interests": {"history": 8}})

    assert response.status_code == 200, response.text
    assert matrix_calls == [40]
    body = response.json()
    assert body["destination"] == "Rome"
    assert any("weather" in w.lower() for w in body["warnings"])


def test_generate_rejects_reversed_dates():
    response = client.post("/generate-itinerary", json={**TRIP, "end_date": "2026-09-01"})
    assert response.status_code == 422
