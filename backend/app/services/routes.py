import httpx

from app.models.schemas import Coordinates

# Public demo server; only the "driving" profile is available on it (no
# walking/foot profile), so travel times are an approximation used purely
# for relative geographic clustering, not turn-by-turn directions.
OSRM_URL = "http://router.project-osrm.org/table/v1/driving"

MAX_CANDIDATES_FOR_MATRIX = 40


async def get_travel_time_matrix(coordinates: list[Coordinates]) -> list[list[float]]:
    """Returns a seconds-based pairwise travel time matrix. Empty matrix on failure."""
    if len(coordinates) < 2:
        return []
    coords = coordinates[:MAX_CANDIDATES_FOR_MATRIX]
    coord_str = ";".join(f"{c.lng},{c.lat}" for c in coords)

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{OSRM_URL}/{coord_str}",
            params={"annotations": "duration"},
            headers={"User-Agent": "travel-itinerary-builder/1.0"},
        )
    response.raise_for_status()
    data = response.json()
    durations = data.get("durations")
    if not durations:
        raise ValueError("OSRM returned no duration matrix")
    return durations
