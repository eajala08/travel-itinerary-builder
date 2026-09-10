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
