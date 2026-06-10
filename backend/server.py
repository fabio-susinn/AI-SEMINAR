import json
import random

from models import (
    POI, POITracker,
    SimulationRequest, SimulationResponse
    )

from simulation import (
    generate_profiles,
    TouristAgent, AgentState,
    analyse_all,
    save_results,
    )

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE   = Path(__file__).parent / "data" / "barcelona_pois_model.json"
RESULTS_DIR = Path(__file__).parent / "results"

with open(DATA_FILE) as f:
    POIS = [POI(**p) for p in json.load(f)]


def run_simulation(profiles, pois, max_steps=30):
    tracker = POITracker()
    tracker.setup(pois)
    agents = [TouristAgent(i, p, pois, tracker=tracker) for i, p in enumerate(profiles)]

    for _ in range(max_steps):
        active = [a for a in agents if a.state != AgentState.DONE]
        if not active:
            break
        for agent in active:
            agent.step()

    return agents, tracker


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/api/simulate", response_model=SimulationResponse)
def simulate(req: SimulationRequest):
    try:
        if req.seed is not None:
            random.seed(req.seed)

        profiles = generate_profiles(req.agents, seed=req.seed)
        agents, tracker = run_simulation(profiles, POIS)

        poi_states = [s.to_dict() for s in tracker.sorted_by_visits()]
        agent_summaries = [a.summary() for a in agents]

        if req.no_sentiment:
            RESULTS_DIR.mkdir(exist_ok=True)
            with open(RESULTS_DIR / "agents_no_sentiment.json", "w") as f:
                json.dump(agent_summaries, f, indent=2)
            return SimulationResponse(
                agents=agent_summaries,
                poi_states=poi_states,
                sentiment=None,
            )

        results = analyse_all(agents, max_workers=req.workers)

        if not results:
            raise HTTPException(status_code=500, detail="Sentiment analysis returned no results")

        save_results(results, tracker, out_dir=str(RESULTS_DIR))

        sentiment_out = [
            {"agent": agent.summary(), "sentiment": sentiment.model_dump()}
            for agent, sentiment in results
        ]

        return SimulationResponse(
            agents=agent_summaries,
            poi_states=poi_states,
            sentiment=sentiment_out,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pois")
def get_pois():
    return POIS