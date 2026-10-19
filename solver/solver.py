"""MTCH-1: global placement with Google OR-Tools CP-SAT.

Input is what Postgres' public.matching_problem() returns: families (people, medical watts, priority weight), shelters
(free seats and generator watts) and every family-shelter pair that already passes the hard constraints, with the same
cost the greedy matcher uses (distance + MTCH-3/MTCH-4 penalties, x10). The database re-checks whatever we return.

Objective, lexicographic through one big weight:
  1. maximise the total priority of placed families (weight = 1 + vulnerability score, as the greedy orders them);
  2. then minimise total cost.
Unlike the greedy, a high-priority family will take its second-best shelter when that lets another family be placed.
"""

from ortools.sat.python import cp_model


def solve(problem: dict, time_limit_s: float = 5.0) -> dict:
    families = {f["id"]: f for f in problem["families"]}
    shelters = {s["id"]: s for s in problem["shelters"]}
    pairs = [p for p in problem["pairs"] if p["f"] in families and p["s"] in shelters]

    model = cp_model.CpModel()
    x = {(p["f"], p["s"]): model.new_bool_var(f"x[{p['f']},{p['s']}]") for p in pairs}
    cost = {(p["f"], p["s"]): p["cost"] for p in pairs}

    by_family: dict[str, list] = {}
    by_shelter: dict[str, list] = {}
    for (f, s), v in x.items():
        by_family.setdefault(f, []).append(v)
        by_shelter.setdefault(s, []).append((f, v))

    for vs in by_family.values():
        model.add_at_most_one(vs)
    for s, row in by_shelter.items():
        model.add(sum(families[f]["people"] * v for f, v in row) <= shelters[s]["capacity"])
        powered = [(f, v) for f, v in row if families[f]["watt"] > 0]
        if powered:
            model.add(sum(families[f]["watt"] * v for f, v in powered) <= shelters[s]["power"])

    # One priority unit must outweigh any possible cost saving, so priority always wins over distance.
    worst: dict[str, int] = {}
    for (f, _), c in cost.items():
        worst[f] = max(worst.get(f, 0), c)
    big = 1 + sum(worst.values())
    model.maximize(sum(v * (big * families[f]["weight"] - cost[f, s]) for (f, s), v in x.items()))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_workers = 8
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": solver.status_name(status), "assignment": {}}
    return {
        "status": solver.status_name(status),  # OPTIMAL, or FEASIBLE when the time limit cut the proof short
        "assignment": {f: s for (f, s), v in x.items() if solver.value(v)},
        "wallTimeS": round(solver.wall_time, 3),
    }
