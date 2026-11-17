from typing import Optional

import httpx

from app.models.schemas import Coordinates, DayRoute, RouteLeg
from app.services import cache

# Public demo server; only the "driving" profile is available on it, so these
# times are used purely for relative geographic clustering.
OSRM_TABLE_URL = "http://router.project-osrm.org/table/v1/driving"

# FOSSGIS-hosted OSRM with a walking profile, used for the per-day route a
# traveler actually follows on foot.
OSRM_FOOT_ROUTE_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot"

MAX_CANDIDATES_FOR_MATRIX = 40
_HEADERS = {"User-Agent": "travel-itinerary-builder/1.0"}


def _coord_string(coordinates: list[Coordinates]) -> str:
    return ";".join(f"{c.lng:.5f},{c.lat:.5f}" for c in coordinates)


async def get_travel_time_matrix(coordinates: list[Coordinates]) -> list[list[float]]:
    """Pairwise travel time in seconds. Callers must pass at most MAX_CANDIDATES_FOR_MATRIX points."""
    if len(coordinates) < 2:
        return []
    coord_str = _coord_string(coordinates[:MAX_CANDIDATES_FOR_MATRIX])

    cache_key = f"matrix:{coord_str}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{OSRM_TABLE_URL}/{coord_str}", params={"annotations": "duration"}, headers=_HEADERS
        )
    response.raise_for_status()
    durations = response.json().get("durations")
    if not durations:
        raise ValueError("OSRM returned no duration matrix")
    cache.put(cache_key, durations, ttl_seconds=3600)
    return durations


async def get_walking_route(stops: list[Coordinates]) -> Optional[DayRoute]:
    """Street-level walking route through the stops in order, with one leg per hop."""
    if len(stops) < 2:
        return None
    coord_str = _coord_string(stops)

    cache_key = f"route:{coord_str}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{OSRM_FOOT_ROUTE_URL}/{coord_str}",
            params={"overview": "full", "geometries": "geojson"},
            headers=_HEADERS,
        )
    response.raise_for_status()
    routes = response.json().get("routes") or []
    if not routes:
        return None

    route = DayRoute(
        geometry=[[lat, lng] for lng, lat in routes[0]["geometry"]["coordinates"]],
        legs=[
            RouteLeg(duration_min=round(leg["duration"] / 60), distance_km=round(leg["distance"] / 1000, 1))
            for leg in routes[0]["legs"]
        ],
    )
    cache.put(cache_key, route, ttl_seconds=3600)
    return route
