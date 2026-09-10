import httpx

from app.models.schemas import Candidate

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

DEFAULT_CATEGORIES = ["food", "culture", "history"]


def _build_query(lat: float, lng: float, radius_m: int, categories: list[str]) -> str:
    tag_filters: list[tuple[str, str, str]] = []
    for category in categories:
        tag_filters.extend(CATEGORY_TAGS.get(category, []))
    if not tag_filters:
        for category in DEFAULT_CATEGORIES:
            tag_filters.extend(CATEGORY_TAGS[category])

    clauses = "\n".join(
        f'  node["{key}"="{value}"](around:{radius_m},{lat},{lng});'
        for key, value, _ in tag_filters
    )
    return f"""
[out:json][timeout:25];
(
{clauses}
);
out center 60;
"""


def _candidate_type_for_tags(tags: dict[str, str], tag_filters: list[tuple[str, str, str]]) -> str:
    for key, value, candidate_type in tag_filters:
        if tags.get(key) == value:
            return candidate_type
    return "other"


async def search_places(
    lat: float, lng: float, interests: list[str], radius_m: int = 5000
) -> list[Candidate]:
    tag_filters: list[tuple[str, str, str]] = []
    for category in interests or DEFAULT_CATEGORIES:
        tag_filters.extend(CATEGORY_TAGS.get(category, []))
    if not tag_filters:
        for category in DEFAULT_CATEGORIES:
            tag_filters.extend(CATEGORY_TAGS[category])

    query = _build_query(lat, lng, radius_m, interests)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(OVERPASS_URL, data={"data": query})
    response.raise_for_status()
    elements = response.json().get("elements", [])

    seen_names: set[str] = set()
    candidates: list[Candidate] = []
    for element in elements:
        tags = element.get("tags", {})
        name = tags.get("name")
        if not name or name in seen_names:
            continue
        seen_names.add(name)
        candidates.append(
            Candidate(
                id=str(element["id"]),
                name=name,
                type=_candidate_type_for_tags(tags, tag_filters),
                lat=element.get("lat") or element.get("center", {}).get("lat"),
                lng=element.get("lon") or element.get("center", {}).get("lon"),
                tags=tags,
                source="overpass",
            )
        )
    return candidates
