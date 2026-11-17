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


SCORE_SLACK = 2.0


def cluster_into_days(
    candidates: list[Candidate],
    matrix: list[list[float]],
    num_days: int,
    max_per_day: int = 4,
) -> dict[int, list[Candidate]]:
    """
    Builds each day as one compact area: seed it with the best-scoring place
    left, then grow it with the places closest to what's already in the day.
    Growth only considers places scoring within SCORE_SLACK of the seed, so
    proximity never trades away the user's interests entirely.

    `candidates` must be ranked best first, and `matrix` indexed in the same
    order. With an empty matrix, days are simply filled in rank order.
    """
    remaining = list(range(len(candidates)))
    clusters: dict[int, list[int]] = {}

    def score(i: int) -> float:
        return candidates[i].score or 0.0

    for day in range(1, num_days + 1):
        if not remaining:
            clusters[day] = []
            continue
        seed = remaining.pop(0)
        members = [seed]
        while len(members) < max_per_day and remaining:
            if not matrix:
                pick = remaining[0]
            else:
                eligible = [i for i in remaining if score(i) >= score(seed) - SCORE_SLACK] or remaining
                pick = min(eligible, key=lambda i: sum(matrix[i][m] for m in members) / len(members))
            remaining.remove(pick)
            members.append(pick)
        clusters[day] = members

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
