import asyncio
import logging
import math
from collections import defaultdict

import httpx

from app.models.schemas import Candidate
from app.services import cache

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# Fallback when Overpass is down or saturated, which happens often on the
# public instance. Same OpenStreetMap data, fewer tags (no cuisine).
PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse"
# Last resort. Nominatim's usage policy allows at most one request per second,
# so this path is slower and strictly sequential.
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_PHRASES: dict[str, list[str]] = {
    "food": ["restaurant", "cafe"],
    "culture": ["place of worship", "attraction"],
    "history": ["museum", "monument"],
    "fashion": ["clothes shop"],
    "shopping": ["mall", "department store"],
    "nature": ["park"],
    "nightlife": ["bar"],
    "sports": ["sports centre"],
}
_HEADERS = {"User-Agent": "travel-itinerary-builder/1.0"}

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


def _bbox(lat: float, lng: float, radius_m: int) -> str:
    dlat = radius_m / 111_000
    dlng = radius_m / (111_000 * max(math.cos(math.radians(lat)), 0.01))
    return f"{lat - dlat:.5f},{lng - dlng:.5f},{lat + dlat:.5f},{lng + dlng:.5f}"


def _set_clauses(filters: list[tuple[str, str, str]]) -> str:
    """One regex clause per tag key: much cheaper for Overpass than one clause per value."""
    by_key: dict[str, list[str]] = defaultdict(list)
    for key, value, _ in filters:
        by_key[key].append(value)
    return "".join(f'node["{key}"~"^({"|".join(values)})$"][name];' for key, values in by_key.items())


def _sight_filters(interests: list[str]) -> list[tuple[str, str, str]]:
    filters: list[tuple[str, str, str]] = []
    for category in sight_categories(interests):
        filters.extend(CATEGORY_TAGS[category])
    return filters


def build_query(lat: float, lng: float, radius_m: int, interests: list[str]) -> str:
    """Restaurants and sights are fetched as separate sets so that in a dense
    city one can't crowd the other out of the result limit."""
    return (
        f"[out:json][timeout:10][bbox:{_bbox(lat, lng, radius_m)}];"
        f"({_set_clauses(CATEGORY_TAGS['food'])})->.food;"
        f"({_set_clauses(_sight_filters(interests))})->.sights;"
        f".food out {MAX_RESTAURANTS};"
        f".sights out {MAX_SIGHTS};"
    )


def _candidate_type_for_tags(tags: dict[str, str]) -> str:
    for filters in CATEGORY_TAGS.values():
        for key, value, candidate_type in filters:
            if tags.get(key) == value:
                return candidate_type
    return "other"


def _candidate(osm_id, name, tags: dict, lat, lng, source: str) -> Candidate:
    return Candidate(
        id=str(osm_id), name=name, type=_candidate_type_for_tags(tags), lat=lat, lng=lng, tags=tags, source=source
    )


async def _from_overpass(lat: float, lng: float, radius_m: int, interests: list[str]) -> list[Candidate]:
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.post(
            OVERPASS_URL, data={"data": build_query(lat, lng, radius_m, interests)}, headers=_HEADERS
        )
    response.raise_for_status()
    return [
        _candidate(e["id"], e["tags"]["name"], e["tags"], e["lat"], e["lon"], "overpass")
        for e in response.json().get("elements", [])
        if e.get("tags", {}).get("name") and "lat" in e
    ]


async def _from_photon(lat: float, lng: float, radius_m: int, interests: list[str]) -> list[Candidate]:
    filters = CATEGORY_TAGS["food"] + _sight_filters(interests)

    async with httpx.AsyncClient(timeout=10) as client:

        async def one(key: str, value: str) -> list[Candidate]:
            response = await client.get(
                PHOTON_REVERSE_URL,
                params={"lat": lat, "lon": lng, "osm_tag": f"{key}:{value}", "limit": 20, "radius": radius_m / 1000},
                headers=_HEADERS,
            )
            response.raise_for_status()
            found = []
            for feature in response.json().get("features", []):
                props = feature.get("properties", {})
                if not props.get("name"):
                    continue
                f_lng, f_lat = feature["geometry"]["coordinates"]
                found.append(_candidate(props.get("osm_id"), props["name"], {key: value}, f_lat, f_lng, "photon"))
            return found

        # At most two at a time: bursting this free service gets the caller refused.
        limit = asyncio.Semaphore(2)

        async def polite(key: str, value: str) -> list[Candidate]:
            async with limit:
                return await one(key, value)

        results = await asyncio.gather(*(polite(k, v) for k, v, _ in filters), return_exceptions=True)

    candidates = [c for r in results if not isinstance(r, BaseException) for c in r]
    if not candidates and any(isinstance(r, BaseException) for r in results):
        raise next(r for r in results if isinstance(r, BaseException))
    return candidates


def _viewbox(lat: float, lng: float, radius_m: int) -> str:
    south, west, north, east = (float(x) for x in _bbox(lat, lng, radius_m).split(","))
    return f"{west},{north},{east},{south}"


async def _from_nominatim(lat: float, lng: float, radius_m: int, interests: list[str]) -> list[Candidate]:
    phrases = NOMINATIM_PHRASES["food"] + [p for c in sight_categories(interests) for p in NOMINATIM_PHRASES[c]]
    candidates: list[Candidate] = []
    async with httpx.AsyncClient(timeout=10) as client:
        for i, phrase in enumerate(phrases):
            if i:
                await asyncio.sleep(1.1)
            try:
                response = await client.get(
                    NOMINATIM_SEARCH_URL,
                    params={"q": phrase, "format": "jsonv2", "limit": 40, "bounded": 1, "viewbox": _viewbox(lat, lng, radius_m)},
                    headers=_HEADERS,
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                logger.warning("Nominatim search for %r failed: %s", phrase, exc)
                continue
            for row in response.json():
                if row.get("name"):
                    tags = {row["category"]: row["type"]}
                    candidates.append(
                        _candidate(row["osm_id"], row["name"], tags, float(row["lat"]), float(row["lon"]), "nominatim")
                    )
    return candidates


def _dedupe_and_cap(candidates: list[Candidate]) -> list[Candidate]:
    seen: set[str] = set()
    restaurants: list[Candidate] = []
    sights: list[Candidate] = []
    for c in candidates:
        if c.name in seen:
            continue
        seen.add(c.name)
        (restaurants if c.type == "restaurant" else sights).append(c)
    return restaurants[:MAX_RESTAURANTS] + sights[:MAX_SIGHTS]


async def search_places(
    lat: float, lng: float, interests: list[str], radius_m: int = 3000
) -> list[Candidate]:
    """Real restaurants plus real sights near a point. Restaurants have type "restaurant"."""
    cache_key = f"places:{lat:.3f},{lng:.3f}:{radius_m}:{','.join(sorted(sight_categories(interests)))}"
    cached = cache.get(cache_key)
    if cached is not None:
        # Copies, because ranking and clustering mutate candidates.
        return [c.model_copy() for c in cached]

    candidates: list[Candidate] = []
    for source in (_from_overpass, _from_photon, _from_nominatim):
        try:
            candidates = await source(lat, lng, radius_m, interests)
        except Exception as exc:  # noqa: BLE001 - try the next source
            logger.warning("%s failed (%s: %s)", source.__name__, type(exc).__name__, exc)
            continue
        if candidates:
            break

    candidates = _dedupe_and_cap(candidates)
    if candidates:
        cache.put(cache_key, candidates, ttl_seconds=3600)
    return [c.model_copy() for c in candidates]
