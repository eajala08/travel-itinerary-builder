from app.models.schemas import Candidate
from app.services.scoring import (
    cluster_into_days,
    compute_score,
    is_outdoor,
    rank_candidates,
)


def make_candidate(id_: str, type_: str, lat: float = 0, lng: float = 0) -> Candidate:
    return Candidate(id=id_, name=id_, type=type_, lat=lat, lng=lng)


def test_compute_score_matches_interest_weight():
    candidate = make_candidate("temple-1", "temple")
    assert compute_score(candidate, {"culture": 9, "food": 2}) == 9.0


def test_compute_score_defaults_to_zero_for_unlisted_interest():
    candidate = make_candidate("museum-1", "museum")
    assert compute_score(candidate, {"culture": 9}) == 0.0


def test_compute_score_unknown_type_is_zero():
    candidate = make_candidate("mystery-1", "other")
    assert compute_score(candidate, {"culture": 10, "food": 10}) == 0.0


def test_is_outdoor():
    assert is_outdoor("nature") is True
    assert is_outdoor("sports") is True
    assert is_outdoor("museum") is False


def test_rank_candidates_orders_by_score_desc():
    low = make_candidate("food-1", "restaurant")
    high = make_candidate("temple-1", "temple")
    ranked = rank_candidates([low, high], {"food": 2, "culture": 9})
    assert [c.id for c in ranked] == ["temple-1", "food-1"]
    assert ranked[0].score == 9.0


def test_cluster_into_days_respects_max_per_day():
    candidates = [make_candidate(f"c{i}", "restaurant") for i in range(6)]
    clusters = cluster_into_days(candidates, matrix=[], num_days=2, max_per_day=3)
    assert len(clusters) == 2
    for members in clusters.values():
        assert len(members) <= 3
    total_assigned = sum(len(members) for members in clusters.values())
    assert total_assigned == 6


def test_cluster_into_days_sets_cluster_day_on_candidates():
    candidates = [make_candidate(f"c{i}", "restaurant") for i in range(2)]
    clusters = cluster_into_days(candidates, matrix=[], num_days=2, max_per_day=1)
    for day, members in clusters.items():
        for candidate in members:
            assert candidate.cluster_day == day


def test_cluster_into_days_handles_empty_candidates():
    clusters = cluster_into_days([], matrix=[], num_days=3)
    assert clusters == {1: [], 2: [], 3: []}


def test_cluster_into_days_prefers_geographically_close_members():
    a = make_candidate("a", "restaurant")
    b = make_candidate("b", "restaurant")
    c = make_candidate("c", "restaurant")
    # a & b are close (10s apart); c is far from both (1000s)
    matrix = [
        [0, 10, 1000],
        [10, 0, 1000],
        [1000, 1000, 0],
    ]
    clusters = cluster_into_days([a, b, c], matrix=matrix, num_days=2, max_per_day=2)
    day_of = {candidate.id: day for day, members in clusters.items() for candidate in members}
    assert day_of["a"] == day_of["b"]
    assert day_of["c"] != day_of["a"]
