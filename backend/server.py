import json
import random
import pandas as pd

from scoring import ScoringFactory
from models import (
    POI, POITracker,
    SimulationRequest, SimulationResponse,
    AgentItineraryResponse
)

from simulation import (
    generate_profiles,
    TouristAgent, AgentState,
    analyse_all,
    save_results,
)

from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from contextlib import asynccontextmanager

GLOBAL_STATE = {
    "df": None
}

DATA_FILE   = Path(__file__).parent / "data" / "barcelona_pois_model.json"
RESULTS_DIR = Path(__file__).parent / "results"
CSV_PATH    = RESULTS_DIR / "itineraries.csv"

with open(DATA_FILE) as f:
    POIS = [POI(**p) for p in json.load(f)]


def load_simulation_data_to_cache():
    """Reads the generated CSV into memory and optimizes it for O(1) lookups."""
    if not CSV_PATH.exists():
        return

    try:
        df = pd.read_csv(CSV_PATH)

        hours = df["arrival_h"].astype(int)
        minutes = ((df["arrival_h"] - hours) * 60).round().astype(int)

        overflow = minutes == 60
        hours = hours + overflow.astype(int)
        minutes = minutes.mask(overflow, 0)

        df["timestamp"] = hours.astype(str).str.zfill(2) + ":" + minutes.astype(str).str.zfill(2)

        df = df.sort_values(by=["agent_id", "order"])

        GLOBAL_STATE["df"] = df.set_index("agent_id")
    except Exception as e:
        print(f"Error caching simulation data: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cache existing results when server boots up
    load_simulation_data_to_cache()
    yield
    # Cleanup on shutdown if needed


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def run_simulation(profiles, pois, strategy, max_steps=30):
    tracker = POITracker()
    tracker.setup(pois)
    agents = [TouristAgent(i, p, pois, tracker=tracker, strategy=strategy) for i, p in enumerate(profiles)]

    for _ in range(max_steps):
        active = [a for a in agents if a.state != AgentState.DONE]
        if not active:
            break
        for agent in active:
            agent.step()

    return agents, tracker


#POSTS
@app.post("/api/simulate", response_model=SimulationResponse)
def simulate(req: SimulationRequest):
    try:
        if req.seed is not None:
            random.seed(req.seed)

        strategy = ScoringFactory.get_strategy(req.strategy)
        profiles = generate_profiles(req.agents, seed=req.seed)
        agents, tracker = run_simulation(profiles, POIS, strategy, max_steps=30 )

        poi_states = [s.to_dict() for s in tracker.sorted_by_visits()]
        agent_summaries = [a.summary() for a in agents]

        if req.no_sentiment:
            RESULTS_DIR.mkdir(exist_ok=True)
            with open(RESULTS_DIR / "agents_no_sentiment.json", "w") as f:
                json.dump(agent_summaries, f, indent=2)
            
            load_simulation_data_to_cache()
            
            return SimulationResponse(
                agents=agent_summaries,
                poi_states=poi_states,
                sentiment=None,
            )

        results = analyse_all(agents, max_workers=req.workers)

        if not results:
            raise HTTPException(status_code=500, detail="Sentiment analysis returned no results")

        save_results(results, tracker, out_dir=str(RESULTS_DIR))

        load_simulation_data_to_cache()

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


#GETS
@app.get("/api/pois")
def get_pois():
    return POIS


@app.get("/api/agents/{agent_id}/itinerary", response_model=AgentItineraryResponse)
def get_agent_itinerary(agent_id: int):
    df = GLOBAL_STATE.get("df")
    
    if df is None:
        raise HTTPException(
            status_code=503, 
            detail="Itinerary engine cache is uninitialized. Please run a simulation first."
        )
    
    if agent_id not in df.index:
        raise HTTPException(
            status_code=404, 
            detail=f"No itinerary data logs found for Agent #{agent_id}"
        )
        
    try:
        agent_data = df.loc[[agent_id]]
              
        steps = agent_data.reset_index().to_dict(orient="records")
        
        return AgentItineraryResponse(
            agent_id=agent_id,
            itinerary=steps
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data slice error: {str(e)}")