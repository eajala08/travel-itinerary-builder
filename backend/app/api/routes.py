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
from app.services.scoring import assign_restaurants, cluster_into_days, rank_candidates

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


async def _attach_walking_routes(itinerary: ItineraryResponse) -> None:
    """Adds a street-level walking route to each day whose stops all have known
    coordinates. Legs line up with the day's stops sorted by time."""

    async def route_for(day):
        stops = sorted([*day.activities, *day.meals], key=lambda stop: stop.time)
        if len(stops) < 2 or any(stop.lat is None or stop.lng is None for stop in stops):
            return None
        try:
            return await routes_service.get_walking_route(
                [Coordinates(lat=stop.lat, lng=stop.lng) for stop in stops]
            )
        except Exception as exc:  # noqa: BLE001 - routes are a nice-to-have
            logger.warning("Walking route lookup failed for day %s: %s", day.day, exc)
            return None

    routes = await asyncio.gather(*(route_for(day) for day in itinerary.itinerary))
    for day, route in zip(itinerary.itinerary, routes):
        day.route = route


@router.post("/generate-itinerary", response_model=ItineraryResponse)
async def generate_itinerary(trip: TripInput) -> ItineraryResponse:
    try:
        num_days = (date.fromisoformat(trip.end_date) - date.fromisoformat(trip.start_date)).days + 1
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Dates must be in YYYY-MM-DD format.") from exc
    if not 1 <= num_days <= 14:
        raise HTTPException(status_code=422, detail="Trips must be between 1 and 14 days long.")

    warnings: list[str] = []

    try:
        geocoded = await geocode_service.geocode_destination(trip.destination)
    except Exception as exc:  # noqa: BLE001 - deliberately broad, this is a hard stop
        raise HTTPException(status_code=422, detail=f"Could not find destination: {exc}") from exc

    places_result, weather_result = await asyncio.gather(
        places_service.search_places(geocoded.lat, geocoded.lng, list(trip.interests.keys())),
        weather_service.get_forecast(geocoded.lat, geocoded.lng, trip.start_date, trip.end_date),
        return_exceptions=True,
    )

    candidates = []
    if isinstance(places_result, BaseException):
        logger.warning("Overpass lookup failed: %s", places_result)
        warnings.append("Could not fetch nearby places, so this plan is not grounded in real locations.")
    else:
        candidates = places_result

    weather_days = []
    if isinstance(weather_result, BaseException):
        logger.warning("Weather lookup failed: %s", weather_result)
        warnings.append("Could not fetch a weather forecast for these dates.")
    else:
        weather_days = weather_result

    restaurants = [c for c in candidates if c.type == "restaurant"]
    sights = rank_candidates([c for c in candidates if c.type != "restaurant"], trip.interests)[
        : routes_service.MAX_CANDIDATES_FOR_MATRIX
    ]

    matrix: list[list[float]] = []
    if len(sights) >= 2:
        try:
            matrix = await routes_service.get_travel_time_matrix(
                [Coordinates(lat=c.lat, lng=c.lng) for c in sights]
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("OSRM lookup failed: %s", exc)
            warnings.append("Could not compute travel times; days may be less geographically tight.")

    # More options than the 3-4 a day needs, so the model can still choose.
    sight_clusters = cluster_into_days(sights, matrix, num_days=num_days, max_per_day=6)
    restaurant_clusters = assign_restaurants(sight_clusters, restaurants)

    try:
        # The LLM client is blocking; keep it off the event loop.
        itinerary = await asyncio.to_thread(
            itinerary_service.generate_itinerary,
            destination=trip.destination,
            start_date=trip.start_date,
            end_date=trip.end_date,
            budget=trip.budget,
            travelers=trip.travelers,
            interests=trip.interests,
            preferences=trip.preferences,
            notes=trip.notes,
            sights=sight_clusters,
            restaurants=restaurant_clusters,
            pool=[*sights, *restaurants],
            weather=weather_days,
            warnings=warnings,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to generate itinerary: {exc}") from exc

    await _attach_walking_routes(itinerary)
    return itinerary


@router.post("/edit-itinerary", response_model=ItineraryResponse)
async def edit_itinerary(request: EditRequest) -> ItineraryResponse:
    try:
        itinerary = await asyncio.to_thread(
            itinerary_service.edit_itinerary, request.itinerary, request.instruction, request.target_day
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to edit itinerary: {exc}") from exc

    await _attach_walking_routes(itinerary)
    return itinerary
