"""EvacFit solver service (F3): POST /solve with public.matching_problem() output, returns {family_id: shelter_id}.

Stateless and read-only: it never touches the database. The browser passes the answer to run_matching(p_prefer), where
Postgres re-validates every placement under the shelter lock and falls back to the greedy matcher for anything left.
"""

import pathlib
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from solver import solve  # noqa: E402


class Family(BaseModel):
    id: str = Field(max_length=100)
    people: int = Field(ge=1, le=1000)
    watt: int = Field(ge=0, le=100_000)
    weight: int = Field(ge=1, le=100)


class Shelter(BaseModel):
    id: str = Field(max_length=100)
    capacity: int = Field(ge=0, le=1_000_000)
    power: int = Field(ge=0, le=10_000_000)


class Pair(BaseModel):
    f: str = Field(max_length=100)
    s: str = Field(max_length=100)
    cost: int = Field(ge=0, le=1_000_000)


# shortcut: no caller authentication; size caps and the time limit bound the cost of abuse. Verify the Supabase JWT
# before exposing this beyond the prototype.
class Problem(BaseModel):
    event: str | None = None
    families: list[Family] = Field(max_length=10_000)
    shelters: list[Shelter] = Field(max_length=2_000)
    pairs: list[Pair] = Field(max_length=200_000)


app = FastAPI(title="EvacFit solver", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://evacfit.vercel.app", "http://localhost:5173", "http://localhost:4173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "engine": "ortools-cp-sat"}


@app.post("/solve")
def solve_endpoint(problem: Problem) -> dict:
    return solve(problem.model_dump(), time_limit_s=5.0)
