import math

from app.models.schemas import Candidate

TYPE_TO_INTEREST: dict[str, str] = {
    "restaurant": "food",
    "temple": "culture",
    "culture": "culture",
    "museum": "history",
    "history": "history",
    "shopping": "fashion",
    "nature": "nature",
    "nightlife": "nightlife",
    "sports": "sports",
}

OUTDOOR_TYPES = {"nature", "sports"}


def compute_score(candidate: Candidate, interests: dict[str, int]) -> float:
    """Score a candidate 0-10 by how well its type matches the user's interest weights."""
    interest_key = TYPE_TO_INTEREST.get(candidate.type)
    if interest_key is None:
        return 0.0
    return float(interests.get(interest_key, 0))


def is_outdoor(candidate_type: str) -> bool:
    return candidate_type in OUTDOOR_TYPES


def rank_candidates(candidates: list[Candidate], interests: dict[str, int]) -> list[Candidate]:
    """Returns candidates sorted by score (desc), with .score populated."""
    for candidate in candidates:
        candidate.score = compute_score(candidate, interests)
    return sorted(candidates, key=lambda c: c.score or 0, reverse=True)


def cluster_into_days(
    candidates: list[Candidate],
    matrix: list[list[float]],
    num_days: int,
    max_per_day: int = 4,
) -> dict[int, list[Candidate]]:
    """
    Greedily assigns candidates (assumed already ranked, best first) to day
    clusters so that each day's activities are geographically close together.
    `matrix` must be indexed the same order as `candidates`; pass an empty
    matrix to fall back to a round-robin assignment with no geo-awareness.
    """
    clusters: dict[int, list[int]] = {day: [] for day in range(1, num_days + 1)}
    if not candidates:
        return {day: [] for day in range(1, num_days + 1)}

    for idx, candidate in enumerate(candidates):
        best_day = None
        best_avg = None
        for day, members in clusters.items():
            if len(members) >= max_per_day:
                continue
            if not matrix:
                # No geo data available: every cluster is equally "close".
                avg = 0.0
            elif not members:
                # Prefer joining a nearby populated cluster over starting a
                # new empty one, unless no populated cluster has room.
                avg = float("inf")
            else:
                avg = sum(matrix[idx][m] for m in members) / len(members)
            if best_avg is None or avg < best_avg:
                best_avg = avg
                best_day = day
        if best_day is not None:
            clusters[best_day].append(idx)

    result: dict[int, list[Candidate]] = {}
    for day, indices in clusters.items():
        assigned = [candidates[i] for i in indices]
        for candidate in assigned:
            candidate.cluster_day = day
        result[day] = assigned
    return result


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line (haversine) distance; good enough to pick the nearest restaurants."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (
        math.sin((p2 - p1) / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    )
    return 6371 * 2 * math.asin(math.sqrt(a))


def assign_restaurants(
    clusters: dict[int, list[Candidate]],
    restaurants: list[Candidate],
    per_day: int = 5,
) -> dict[int, list[Candidate]]:
    """
    Gives each day the restaurants nearest to that day's sights, so meals don't
    pull the traveler away from where they already are. Each restaurant goes to
    at most one day. Days with no sights take whatever is left, in order.
    """
    remaining = list(restaurants)
    assigned: dict[int, list[Candidate]] = {day: [] for day in clusters}

    for _ in range(per_day):
        for day, sights in clusters.items():
            if not remaining:
                return assigned
            if sights:
                center_lat = sum(s.lat for s in sights) / len(sights)
                center_lng = sum(s.lng for s in sights) / len(sights)
                pick = min(remaining, key=lambda r: _distance_km(center_lat, center_lng, r.lat, r.lng))
            else:
                pick = remaining[0]
            remaining.remove(pick)
            assigned[day].append(pick)
    return assigned
