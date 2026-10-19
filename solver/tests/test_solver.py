"""Assert-based self-check: python tests/test_solver.py (from evacfit/solver). Mirrors web/src/lib/matching.check.ts."""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from solver import solve  # noqa: E402

problem = json.loads((pathlib.Path(__file__).parent / "medan_flood_problem.json").read_text())


def check_feasible(p: dict, assignment: dict) -> None:
    fam = {f["id"]: f for f in p["families"]}
    allowed = {(q["f"], q["s"]) for q in p["pairs"]}
    for s in p["shelters"]:
        mine = [f for f, ss in assignment.items() if ss == s["id"]]
        assert sum(fam[f]["people"] for f in mine) <= s["capacity"], f"{s['id']} overbooked"
        assert sum(fam[f]["watt"] for f in mine) <= s["power"], f"{s['id']} power overbooked"
    assert all(pair in allowed for pair in assignment.items()), "only pairs that passed the hard constraints"


# 1. Seed data (Kantor Camat Medan Johor still unverified): same outcome as the greedy, 11 placed, Hasibuan in backlog.
baseline = {
    **problem,
    "shelters": [s for s in problem["shelters"] if s["id"] != "sh-04"],
    "pairs": [q for q in problem["pairs"] if q["s"] != "sh-04"],
}
r = solve(baseline)
check_feasible(baseline, r["assignment"])
assert r["status"] == "OPTIMAL", r
assert len(r["assignment"]) == 11 and "fam-09" not in r["assignment"], r
print("baseline ok:", r["status"], len(r["assignment"]), "placed, unplaced:", sorted({f["id"] for f in problem["families"]} - r["assignment"].keys()))

# 2. Live data after the coordinator verified sh-04: everyone fits.
r = solve(problem)
check_feasible(problem, r["assignment"])
assert len(r["assignment"]) == 12, r
print("with sh-04 ok:", r["status"], len(r["assignment"]), "placed")

# 3. Where greedy fails: the top-priority family takes the only seat another family can use.
#    Greedy: A (weight 9) -> X (cheapest), B (weight 6, fits only X) -> unplaced. CP-SAT: A -> Y, B -> X, both placed.
trap = {
    "families": [{"id": "A", "people": 4, "watt": 0, "weight": 9}, {"id": "B", "people": 4, "watt": 0, "weight": 6}],
    "shelters": [{"id": "X", "capacity": 4, "power": 0}, {"id": "Y", "capacity": 4, "power": 0}],
    "pairs": [{"f": "A", "s": "X", "cost": 10}, {"f": "A", "s": "Y", "cost": 20}, {"f": "B", "s": "X", "cost": 10}],
}
r = solve(trap)
assert r["assignment"] == {"A": "Y", "B": "X"}, r
print("greedy trap ok:", r["assignment"])

# 4. Power is a hard limit too.
power = {
    "families": [{"id": "A", "people": 1, "watt": 600, "weight": 5}, {"id": "B", "people": 1, "watt": 600, "weight": 5}],
    "shelters": [{"id": "X", "capacity": 10, "power": 1000}],
    "pairs": [{"f": "A", "s": "X", "cost": 1}, {"f": "B", "s": "X", "cost": 1}],
}
r = solve(power)
check_feasible(power, r["assignment"])
assert len(r["assignment"]) == 1, r
print("power ok")
