import httpx

from app.models.schemas import GeocodeResult
from app.services import cache

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


async def geocode_destination(destination: str) -> GeocodeResult:
    cache_key = f"geocode:{destination.strip().lower()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            NOMINATIM_URL,
            params={"q": destination, "format": "json", "limit": 1},
            headers={"User-Agent": "travel-itinerary-builder/1.0"},
        )
    response.raise_for_status()
    results = response.json()
    if not results:
        raise ValueError(f"Could not find location: {destination}")
    top = results[0]
    result = GeocodeResult(
        lat=float(top["lat"]),
        lng=float(top["lon"]),
        display_name=top["display_name"],
    )
    cache.put(cache_key, result, ttl_seconds=24 * 3600)
    return result
