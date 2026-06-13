import json
from collections import defaultdict
from pathlib import Path

import pandas as pd

from .agent import TouristAgent
from models import TripSentiment, POITracker

SENTIMENT_NUM = {
    "very_positive": 5,
    "positive":      4,
    "neutral":       3,
    "negative":      2,
    "very_negative": 1,
}


def build_agent_df(results: list[tuple[TouristAgent, TripSentiment]]) -> pd.DataFrame:
    rows = []
    for agent, s in results:
        p = agent.profile
        rows.append({
            "agent_id":             agent.agent_id,
            "nationality":          p.nationality,
            "age":                  p.age,
            "budget_level":         p.budget_level,
            "mobility_mode":        p.mobility_mode,
            "interests":            p.interests[0] if p.interests else "unknown",
            "travel_with_kids":     p.travel_with_kids,
            "travel_with_seniors":  p.travel_with_seniors,
            "crowd_aversion":       p.crowd_aversion,
            "novelty_seeking":      p.novelty_seeking,
            # trip outcome
            "pois_visited":         len(agent.visited),
            "money_spent":          round(agent.money_spent, 2),
            "fatigue":              round(agent.fatigue, 3),
            "sim_satisfaction":     round(agent.satisfaction, 3),
            "hours_used":           round(agent.current_time - 9.0, 2),
            # llm sentiment
            "overall_sentiment":    s.overall_sentiment,
            "overall_score":        s.overall_score,
            "would_recommend":      s.would_recommend,
            "would_return":         s.would_return,
            "emotional_arc":        s.emotional_arc,
        })
    return pd.DataFrame(rows)


def build_poi_df(results: list[tuple[TouristAgent, TripSentiment]]) -> pd.DataFrame:
    rows = []
    for agent, s in results:        
        for ps in s.poi_sentiments:
            rows.append({
                "agent_id":    agent.agent_id,
                "poi_name":    ps.poi_name,
                "sentiment":   ps.sentiment,
                "sentiment_n": SENTIMENT_NUM.get(ps.sentiment, 3),
                "reason":      ps.reason,
            })
    return pd.DataFrame(rows)


def build_itinerary_df(results: list[tuple[TouristAgent, TripSentiment]]) -> pd.DataFrame:
    rows = []
    for agent, _ in results:
        for order, (poi, arrival) in enumerate(agent.visited):
            rows.append({
                "agent_id":    agent.agent_id,
                "order":       order,
                "poi_id":      poi.id,
                "poi_name":    poi.name,
                "category":    poi.category,
                "arrival_h":   round(arrival, 2),
                "price":       poi.entry_price_eur,
                "crowd":       poi.avg_crowd_level,
            })
    return pd.DataFrame(rows)


def save_poi_states(tracker: POITracker, out_dir: str = "results"):
    rows = [s.to_dict() for s in tracker.sorted_by_visits()]

    with open(f"{out_dir}/poi_states.json", "w") as f:
        json.dump(rows, f, indent=2)

    df = pd.DataFrame([{k: v for k, v in r.items() if k != "visit_times"} for r in rows])
    df.to_csv(f"{out_dir}/poi_states.csv", index=False)

    # Print top 15
    print(f"\n── POI visit counts ──")
    print(f"  {'POI':<40} {'visits':>6}  {'avg_dwell':>9}  {'peak_h':>6}")
    print(f"  {'─'*40} {'─'*6}  {'─'*9}  {'─'*6}")
    for row in rows[:15]:
        peak = f"{row['peak_hour']:.0f}h" if row['peak_hour'] is not None else "n/a"
        print(
            f"  {row['poi_name']:<40} "
            f"{row['total_visits']:>6}  "
            f"{row['avg_dwell_hours']:>8.2f}h  "
            f"{peak:>6}"
        )


def save_results(
    results: list[tuple[TouristAgent, TripSentiment]],
    tracker : POITracker,
    out_dir: str = "results",
    no_sentiment: bool = False,
):
    Path(out_dir).mkdir(exist_ok=True)

    agent_df = build_agent_df(results)
    agent_df.to_csv(f"{out_dir}/agents.csv", index=False)

    if not no_sentiment:
        poi_df = build_poi_df(results)
        poi_df.to_csv(f"{out_dir}/poi_sentiments.csv", index=False)
    
    itin_df  = build_itinerary_df(results)
    itin_df.to_csv(f"{out_dir}/itineraries.csv",   index=False)

    full = []
    for agent, sentiment in results:
        full.append({
            "agent": agent.summary(),
            "profile": agent.profile.model_dump(),
            "sentiment": sentiment.model_dump() if not no_sentiment else None,
            "events": agent.events,
        })
    with open(f"{out_dir}/full_results.json", "w") as f:
        json.dump(full, f, indent=2)
    
    save_poi_states(tracker, out_dir)

    print(f"Results saved to {out_dir}/")