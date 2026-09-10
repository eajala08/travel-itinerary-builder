import httpx

from app.models.schemas import GeocodeResult

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


async def geocode_destination(destination: str) -> GeocodeResult:
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
    return GeocodeResult(
        lat=float(top["lat"]),
        lng=float(top["lon"]),
        display_name=top["display_name"],
    )
