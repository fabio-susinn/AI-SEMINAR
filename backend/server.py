import json
import random
import pandas as pd
import numpy as np
import uvicorn

from scoring import ScoringFactory
from models import (
    POI, POITracker,
    SimulationRequest, SimulationResponse,
    AgentItineraryResponse,
    FairnessMetrics, EvaluationMetricsResponse,
    VisitMetricsResponse
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
    "df": None,          # itineraries DataFrame indexed by agent_id
    "poi_states": None,  # list of poi_state dicts (includes visit_times)
}

DATA_FILE        = Path(__file__).parent / "data" / "barcelona_pois_model.json"
RESULTS_DIR      = Path(__file__).parent / "results"
CSV_PATH         = RESULTS_DIR / "itineraries.csv"
POI_STATES_PATH  = RESULTS_DIR / "poi_states.json"
AGENTS_SIM = None
POI_TRACKER = None

with open(DATA_FILE) as f:
    POIS = [POI(**p) for p in json.load(f)]


def load_simulation_data_to_cache(agent, tracker):
    """Reads the generated CSVs/JSONs into memory and optimizes for fast lookups."""
    global AGENTS_SIM, POI_TRACKER
    AGENTS_SIM = agent
    POI_TRACKER = tracker
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
        print(f"Error caching itineraries: {e}")

    try:
        if POI_STATES_PATH.exists():
            with open(POI_STATES_PATH) as f:
                GLOBAL_STATE["poi_states"] = json.load(f)
    except Exception as e:
        print(f"Error caching poi_states: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cache existing results when server boots up
    load_simulation_data_to_cache(AGENTS_SIM, POI_TRACKER)
    yield  

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

        results = analyse_all(agents, max_workers=req.workers, run_sentiment=not req.no_sentiment)

        if req.no_sentiment:
            RESULTS_DIR.mkdir(exist_ok=True)
            with open(RESULTS_DIR / "agents_no_sentiment.json", "w") as f:
                json.dump(agent_summaries, f, indent=2)
            sentiment_out = None
            
        else:
            sentiment_out = [
                {"agent": agent.summary(), "sentiment": sentiment.model_dump()}
                for agent, sentiment in results
            ]

        save_results(results, tracker, out_dir=str(RESULTS_DIR), no_sentiment=req.no_sentiment)
        load_simulation_data_to_cache(agents, tracker)

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

@app.get("/api/visit-metrics", response_model=VisitMetricsResponse)
def get_visit_metrics():
    """Returns pre-aggregated visit stats driven entirely from the in-memory cache."""
    itin_df_indexed = GLOBAL_STATE.get("df")
    poi_states      = GLOBAL_STATE.get("poi_states")

    if itin_df_indexed is None or poi_states is None:
        raise HTTPException(
            status_code=503,
            detail="Visit metrics are unavailable. Please run a simulation first."
        )

    try:
        itin_df = itin_df_indexed.reset_index()

        top_pois = [
            {
                "poi_id":    int(s["poi_id"]),
                "poi_name":  s["poi_name"],
                "visits":    int(s["total_visits"]),
                "avg_dwell": round(float(s["avg_dwell_hours"]), 2),
            }
            for s in poi_states
            if s["total_visits"] > 0
        ][:10]

        nb_map = {int(s["poi_id"]): s.get("neighborhood", "Unknown") or "Unknown" for s in poi_states}
        itin_df["neighbourhood"] = itin_df["poi_id"].map(nb_map).fillna("Unknown")
        nb_counts = (
            itin_df.groupby("neighbourhood")
            .size()
            .reset_index(name="visits")
            .sort_values("visits", ascending=False)
        )
        by_neighbourhood = nb_counts.rename(columns={"neighbourhood": "neighbourhood"}).to_dict(orient="records")

        cat_counts = (
            itin_df.groupby("category")
            .size()
            .reset_index(name="visits")
            .sort_values("visits", ascending=False)
        )
        by_category = cat_counts.to_dict(orient="records")

        buckets = {h: 0 for h in range(9, 22)}
        for s in poi_states:
            for t in s.get("visit_times", []):
                h = int(t)
                if 9 <= h <= 21:
                    buckets[h] += 1
        by_hour = [{"hour": h, "label": f"{h}h", "count": count} for h, count in sorted(buckets.items())]

        return VisitMetricsResponse(
            top_pois=top_pois,
            by_neighbourhood=by_neighbourhood,
            by_category=by_category,
            by_hour=by_hour,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error computing visit metrics: {str(e)}")


@app.get("/api/metrics", response_model=EvaluationMetricsResponse)
def get_simulation_metrics():
    global AGENTS_SIM, POI_TRACKER

    if AGENTS_SIM is None or POI_TRACKER is None:
        raise HTTPException(
            status_code=503,
            detail="Simulation metrics are unavailable. Please run a simulation first."
        )

    try:
        agents = AGENTS_SIM
        pois = POIS

        # Helper function for Gini calculation
        def calculate_gini(x):
            if len(x) == 0 or np.sum(x) == 0:
                return 0.0
            x = np.sort(x)
            n = len(x)
            index = np.arange(1, n + 1)
            return float((np.sum((2 * index - n - 1) * x)) / (n * np.sum(x)))

        # 1. Base Visit Metrics
        # Assuming tracker has a method to get historical total or live aggregate crowd info per POI
        visit_counts = [POI_TRACKER.get_live_crowd(poi.id) for poi in pois]
        gini_index = calculate_gini(np.array(visit_counts))

        total_visits = sum(len(a.visited) for a in agents)
        
        unique_pois_visited = len({p.id for a in agents for p, _ in a.visited})
        catalog_coverage = unique_pois_visited / len(pois) if pois else 0.0

        # 2. Overtourism Metric
        # Safely checks for 'is_overtouristed' attribute on POI model
        overtouristed_ids = {poi.id for poi in pois if getattr(poi, 'is_overtouristed', False)}
        overtouristed_visits = sum(1 for a in agents for p, _ in a.visited if p.id in overtouristed_ids)
        overtourism_ratio = overtouristed_visits / max(1, total_visits)

        # 3. Revenue Distribution Metric
        total_spend = sum(a.summary().get('money_spent', 0) for a in agents)
        local_spend = sum(getattr(p, 'entry_price_eur', 0) for a in agents for p, _ in a.visited if getattr(p, 'local_favourite', False))
        local_revenue_ratio = local_spend / max(1, total_spend)

        # 4. Diversity, Precision and Experience Aggregations
        diversity_scores = []
        precision_scores = []
        satisfaction_scores = []
        fatigue_scores = []
        pois_visited_counts = []

        low_budget_visits = []
        high_budget_visits = []
        family_sat = []
        solo_sat = []

        for a in agents:
            summary = a.summary()
            num_visited = len(a.visited)
            
            # General tracking arrays
            satisfaction_scores.append(summary.get('satisfaction', 0.0))
            fatigue_scores.append(summary.get('fatigue', 0.0))
            pois_visited_counts.append(num_visited)

            if a.visited:
                # Diversity
                unique_tags = set(tag for p, _ in a.visited for tag in getattr(p, 'tags', []))
                diversity_scores.append(len(unique_tags))
                
                # Precision matching
                profile = getattr(a, 'profile', None)
                interests = getattr(profile, 'interests', []) if profile else []
                if interests:
                    matches = sum(1 for p, _ in a.visited if set(interests).intersection(set(getattr(p, 'tags', []))))
                    precision_scores.append(matches / num_visited)

            # Fairness grouping (Budget)
            budget_level = getattr(a.profile, 'budget_level', 'unknown') if hasattr(a, 'profile') else 'unknown'
            if budget_level == "low":
                low_budget_visits.append(num_visited)
            elif budget_level == "high":
                high_budget_visits.append(num_visited)

            # Fairness grouping (Vulnerability/Demographics)
            has_kids = getattr(a.profile, 'travel_with_kids', False) if hasattr(a, 'profile') else False
            has_seniors = getattr(a.profile, 'travel_with_seniors', False) if hasattr(a, 'profile') else False
            
            if has_kids or has_seniors:
                family_sat.append(summary.get('satisfaction', 0.0))
            else:
                solo_sat.append(summary.get('satisfaction', 0.0))

        # Averages computation
        avg_diversity = float(np.mean(diversity_scores)) if diversity_scores else 0.0
        avg_precision = float(np.mean(precision_scores)) if precision_scores else 0.0
        avg_satisfaction = float(np.mean(satisfaction_scores)) if satisfaction_scores else 0.0
        avg_fatigue = float(np.mean(fatigue_scores)) if fatigue_scores else 0.0
        avg_pois_visited = float(np.mean(pois_visited_counts)) if pois_visited_counts else 0.0

        avg_pois_low = float(np.mean(low_budget_visits)) if low_budget_visits else 0.0
        avg_pois_high = float(np.mean(high_budget_visits)) if high_budget_visits else 0.0
        avg_sat_family = float(np.mean(family_sat)) if family_sat else 0.0
        avg_sat_solo = float(np.mean(solo_sat)) if solo_sat else 0.0

        # Return organized model mapping perfectly to validation layer
        return EvaluationMetricsResponse(
            total_visits=total_visits,
            spatial_gini_index=round(gini_index, 3),
            overtourism_concentration_ratio=round(overtourism_ratio, 3),
            local_revenue_distribution_ratio=round(local_revenue_ratio, 3),
            catalog_coverage_ratio=round(catalog_coverage, 3),
            intra_list_diversity_avg_tags=round(avg_diversity, 1),
            average_tourist_satisfaction=round(avg_satisfaction, 2),
            average_transit_walk_fatigue=round(avg_fatigue, 2),
            avg_pois_visited=round(avg_pois_visited, 1),
            precision_interest_match_ratio=round(avg_precision, 3),
            fairness_metrics=FairnessMetrics(
                low_budget_avg_pois=round(avg_pois_low, 1),
                high_budget_avg_pois=round(avg_pois_high, 1),
                vulnerable_group_avg_satisfaction=round(avg_sat_family, 2),
                standard_group_avg_satisfaction=round(avg_sat_solo, 2)
            )
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error computing live simulation metrics: {str(e)}")
    
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)