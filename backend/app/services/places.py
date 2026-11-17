import httpx

from app.models.schemas import Candidate
from app.services import cache

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Maps a user-facing interest key to Overpass tag filters and a candidate "type".
CATEGORY_TAGS: dict[str, list[tuple[str, str, str]]] = {
    "food": [
        ("amenity", "restaurant", "restaurant"),
        ("amenity", "cafe", "restaurant"),
        ("amenity", "fast_food", "restaurant"),
    ],
    "culture": [
        ("amenity", "place_of_worship", "temple"),
        ("tourism", "attraction", "culture"),
    ],
    "history": [
        ("tourism", "museum", "museum"),
        ("historic", "monument", "history"),
        ("historic", "castle", "history"),
    ],
    "fashion": [
        ("shop", "clothes", "shopping"),
        ("shop", "boutique", "shopping"),
    ],
    "shopping": [
        ("shop", "mall", "shopping"),
        ("shop", "department_store", "shopping"),
    ],
    "nature": [
        ("leisure", "park", "nature"),
        ("natural", "beach", "nature"),
    ],
    "nightlife": [
        ("amenity", "bar", "nightlife"),
        ("amenity", "nightclub", "nightlife"),
    ],
    "sports": [
        ("leisure", "stadium", "sports"),
        ("leisure", "sports_centre", "sports"),
    ],
}

DEFAULT_SIGHT_CATEGORIES = ["culture", "history"]
MAX_RESTAURANTS = 40
MAX_SIGHTS = 60


def sight_categories(interests: list[str]) -> list[str]:
    """Non-food categories to look up; every trip needs things to do between meals."""
    chosen = [c for c in interests if c != "food" and c in CATEGORY_TAGS]
    return chosen or DEFAULT_SIGHT_CATEGORIES


def _clauses(filters: list[tuple[str, str, str]], lat: float, lng: float, radius_m: int) -> str:
    return "\n".join(
        f'  node["{key}"="{value}"](around:{radius_m},{lat},{lng});' for key, value, _ in filters
    )


def build_query(lat: float, lng: float, radius_m: int, interests: list[str]) -> str:
    """Restaurants and sights are fetched as separate sets so that in a dense
    city one can't crowd the other out of the result limit."""
    sight_filters: list[tuple[str, str, str]] = []
    for category in sight_categories(interests):
        sight_filters.extend(CATEGORY_TAGS[category])

    return f"""
[out:json][timeout:25];
(
{_clauses(CATEGORY_TAGS["food"], lat, lng, radius_m)}
)->.food;
(
{_clauses(sight_filters, lat, lng, radius_m)}
)->.sights;
.food out center {MAX_RESTAURANTS};
.sights out center {MAX_SIGHTS};
"""


def _candidate_type_for_tags(tags: dict[str, str]) -> str:
    for filters in CATEGORY_TAGS.values():
        for key, value, candidate_type in filters:
            if tags.get(key) == value:
                return candidate_type
    return "other"


async def search_places(
    lat: float, lng: float, interests: list[str], radius_m: int = 5000
) -> list[Candidate]:
    """Real restaurants plus real sights near a point. Restaurants have type "restaurant"."""
    cache_key = f"places:{lat:.3f},{lng:.3f}:{radius_m}:{','.join(sorted(sight_categories(interests)))}"
    cached = cache.get(cache_key)
    if cached is not None:
        # Copies, because ranking and clustering mutate candidates.
        return [c.model_copy() for c in cached]

    query = build_query(lat, lng, radius_m, interests)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "travel-itinerary-builder/1.0"},
        )
    response.raise_for_status()
    elements = response.json().get("elements", [])

    seen_names: set[str] = set()
    candidates: list[Candidate] = []
    for element in elements:
        tags = element.get("tags", {})
        name = tags.get("name")
        lat_value = element.get("lat") or element.get("center", {}).get("lat")
        lng_value = element.get("lon") or element.get("center", {}).get("lon")
        if not name or name in seen_names or lat_value is None or lng_value is None:
            continue
        seen_names.add(name)
        candidates.append(
            Candidate(
                id=str(element["id"]),
                name=name,
                type=_candidate_type_for_tags(tags),
                lat=lat_value,
                lng=lng_value,
                tags=tags,
                source="overpass",
            )
        )

    cache.put(cache_key, candidates, ttl_seconds=3600)
    return [c.model_copy() for c in candidates]
