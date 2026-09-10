import logging

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

    candidates = []
    try:
        candidates = await places_service.search_places(
            geocoded.lat, geocoded.lng, list(trip.interests.keys())
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Overpass lookup failed: %s", exc)
        warnings.append("Could not fetch nearby places (Overpass unavailable); results may be sparse.")

    weather_days = []
    try:
        weather_days = await weather_service.get_forecast(
            geocoded.lat, geocoded.lng, trip.start_date, trip.end_date
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Weather lookup failed: %s", exc)
        warnings.append("Could not fetch weather forecast; itinerary won't be weather-aware.")

    ranked = rank_candidates(candidates, trip.interests)

    matrix: list[list[float]] = []
    if len(ranked) >= 2:
        try:
            matrix = await routes_service.get_travel_time_matrix(
                [Coordinates(lat=c.lat, lng=c.lng) for c in ranked]
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("OSRM lookup failed: %s", exc)
            warnings.append("Could not compute travel times; day clustering is less precise.")

    start = trip.start_date
    end = trip.end_date
    from datetime import date

    num_days = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    clusters = cluster_into_days(ranked, matrix, num_days=max(num_days, 1))

    try:
        return itinerary_service.generate_itinerary(
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
        return itinerary_service.edit_itinerary(
            request.itinerary, request.instruction, request.target_day
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to edit itinerary: {exc}") from exc
