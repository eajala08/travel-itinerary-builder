import asyncio
import logging
from datetime import date

from fastapi import APIRouter, HTTPException

from app.models.schemas import Coordinates, EditRequest, ItineraryResponse, TripInput
from app.services import geocode as geocode_service
from app.services import itinerary as itinerary_service
from app.services import places as places_service
from app.services import routes as routes_service
from app.services import weather as weather_service
from app.services.scoring import cluster_into_days, rank_candidates

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.post("/generate-itinerary", response_model=ItineraryResponse)
async def generate_itinerary(trip: TripInput) -> ItineraryResponse:
    warnings: list[str] = []

    try:
        geocoded = await geocode_service.geocode_destination(trip.destination)
    except Exception as exc:  # noqa: BLE001 - deliberately broad, this is a hard stop
        raise HTTPException(status_code=422, detail=f"Could not find destination: {exc}") from exc

    # Places and weather are independent — fetch them concurrently.
    places_result, weather_result = await asyncio.gather(
        places_service.search_places(geocoded.lat, geocoded.lng, list(trip.interests.keys())),
        weather_service.get_forecast(geocoded.lat, geocoded.lng, trip.start_date, trip.end_date),
        return_exceptions=True,
    )

    candidates = []
    if isinstance(places_result, BaseException):
        logger.warning("Overpass lookup failed: %s", places_result)
        warnings.append("Could not fetch nearby places (Overpass unavailable); results may be sparse.")
    else:
        candidates = places_result

    weather_days = []
    if isinstance(weather_result, BaseException):
        logger.warning("Weather lookup failed: %s", weather_result)
        days_out = (date.fromisoformat(trip.start_date) - date.today()).days
        if days_out > weather_service.FORECAST_HORIZON_DAYS:
            warnings.append(
                f"Weather forecasts only reach {weather_service.FORECAST_HORIZON_DAYS} days ahead; "
                "this itinerary isn't weather-aware yet. Rebuild closer to the trip for weather tips."
            )
        else:
            warnings.append("Could not fetch weather forecast; itinerary won't be weather-aware.")
    else:
        weather_days = weather_result

    # OSRM's matrix is capped, so only cluster as many candidates as it covers;
    # the matrix is indexed in the same order as this list.
    ranked = rank_candidates(candidates, trip.interests)[: routes_service.MAX_CANDIDATES_FOR_MATRIX]

    matrix: list[list[float]] = []
    if len(ranked) >= 2:
        try:
            matrix = await routes_service.get_travel_time_matrix(
                [Coordinates(lat=c.lat, lng=c.lng) for c in ranked]
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("OSRM lookup failed: %s", exc)
            warnings.append("Could not compute travel times; day clustering is less precise.")

    clusters = cluster_into_days(ranked, matrix, num_days=trip.num_days)

    try:
        # The Groq SDK call is synchronous; run it off the event loop so one
        # slow generation doesn't block every other request.
        return await asyncio.to_thread(
            itinerary_service.generate_itinerary,
            destination=trip.destination,
            start_date=trip.start_date,
            end_date=trip.end_date,
            budget=trip.budget,
            travelers=trip.travelers,
            interests=trip.interests,
            preferences=trip.preferences,
            notes=trip.notes,
            clusters=clusters,
            weather=weather_days,
            warnings=warnings,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to generate itinerary: {exc}") from exc


@router.post("/edit-itinerary", response_model=ItineraryResponse)
async def edit_itinerary(request: EditRequest) -> ItineraryResponse:
    try:
        return await asyncio.to_thread(
            itinerary_service.edit_itinerary,
            request.itinerary,
            request.instruction,
            request.target_day,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to edit itinerary: {exc}") from exc
