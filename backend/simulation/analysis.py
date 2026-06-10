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
                "poi_name":    poi.name,
                "category":    poi.category,
                "arrival_h":   round(arrival, 2),
                "price":       poi.entry_price_eur,
                "crowd":       poi.avg_crowd_level,
            })
    return pd.DataFrame(rows)


def print_report(agent_df: pd.DataFrame, poi_df: pd.DataFrame, itin_df: pd.DataFrame):
    sep = "─" * 52

    print(f"\n{'═'*52}")
    print("  SIMULATION REPORT")
    print(f"{'═'*52}")

    print(f"\n{sep}")
    print("  OVERVIEW")
    print(sep)
    print(f"  Agents analysed      : {len(agent_df)}")
    print(f"  Avg POIs visited     : {agent_df['pois_visited'].mean():.1f}")
    print(f"  Avg money spent      : €{agent_df['money_spent'].mean():.2f}")
    print(f"  Avg fatigue          : {agent_df['fatigue'].mean():.2f}/1.0")
    print(f"  Avg LLM score        : {agent_df['overall_score'].mean():.2f}/10")
    print(f"  Would recommend      : {agent_df['would_recommend'].mean()*100:.0f}%")
    print(f"  Would return         : {agent_df['would_return'].mean()*100:.0f}%")

    print(f"\n{sep}")
    print("  OVERALL SENTIMENT DISTRIBUTION")
    print(sep)
    counts = agent_df["overall_sentiment"].value_counts()
    for label in ["very_positive","positive","neutral","negative","very_negative"]:
        n = counts.get(label, 0)
        bar = "█" * int(n / len(agent_df) * 30)
        print(f"  {label:<18} {bar:<30} {n}")

    print(f"\n{sep}")
    print("  AVG SCORE BY INTEREST TYPE")
    print(sep)
    by_interest = agent_df.groupby("interests")["overall_score"].mean().sort_values(ascending=False)
    for interest, score in by_interest.items():
        print(f"  {interest:<20} {score:.2f}/10")

    print(f"\n{sep}")
    print("  AVG SCORE BY NATIONALITY  (min 2 agents)")
    print(sep)
    by_nat = (
        agent_df.groupby("nationality")
        .filter(lambda x: len(x) >= 2)
        .groupby("nationality")["overall_score"]
        .mean()
        .sort_values(ascending=False)
    )
    for nat, score in by_nat.items():
        print(f"  {nat:<20} {score:.2f}/10")

    print(f"\n{sep}")
    print("  EMOTIONAL ARC DISTRIBUTION")
    print(sep)
    for arc, n in agent_df["emotional_arc"].value_counts().items():
        print(f"  {arc:<35} {n}")

    if not poi_df.empty:
        print(f"\n{sep}")
        print("  TOP 10 MOST VISITED POIs")
        print(sep)
        top_visited = itin_df["poi_name"].value_counts().head(10)
        poi_scores  = poi_df.groupby("poi_name")["sentiment_n"].mean()
        for poi, count in top_visited.items():
            score = poi_scores.get(poi, None)
            score_str = f"{score:.1f}/5" if score else "n/a"
            print(f"  {poi:<38} visits={count}  sentiment={score_str}")

        print(f"\n{sep}")
        print("  TOP 10 BEST-RATED POIs  (min 2 ratings)")
        print(sep)
        best = (
            poi_df.groupby("poi_name")
            .filter(lambda x: len(x) >= 2)
            .groupby("poi_name")["sentiment_n"]
            .mean()
            .sort_values(ascending=False)
            .head(10)
        )
        for poi, score in best.items():
            print(f"  {poi:<38} {score:.2f}/5")

        print(f"\n{sep}")
        print("  BOTTOM 5 POIs  (most negative reactions)")
        print(sep)
        worst = (
            poi_df.groupby("poi_name")
            .filter(lambda x: len(x) >= 2)
            .groupby("poi_name")["sentiment_n"]
            .mean()
            .sort_values()
            .head(5)
        )
        for poi, score in worst.items():
            print(f"  {poi:<38} {score:.2f}/5")

    print(f"\n{'═'*52}\n")


def save_poi_states(tracker: POITracker, out_dir: str = "results"):
    rows = [s.to_dict() for s in tracker.sorted_by_visits()]

    # Save full JSON (includes visit_times array)
    with open(f"{out_dir}/poi_states.json", "w") as f:
        json.dump(rows, f, indent=2)

    # Save flat CSV (drop visit_times list)
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
):
    Path(out_dir).mkdir(exist_ok=True)

    agent_df = build_agent_df(results)
    poi_df   = build_poi_df(results)
    itin_df  = build_itinerary_df(results)

    agent_df.to_csv(f"{out_dir}/agents.csv",      index=False)
    poi_df.to_csv(f"{out_dir}/poi_sentiments.csv", index=False)
    itin_df.to_csv(f"{out_dir}/itineraries.csv",   index=False)

    # Full JSON dump
    full = []
    for agent, sentiment in results:
        full.append({
            "agent": agent.summary(),
            "profile": agent.profile.model_dump(),
            "sentiment": sentiment.model_dump(),
            "events": agent.events,
        })
    with open(f"{out_dir}/full_results.json", "w") as f:
        json.dump(full, f, indent=2)
    
    save_poi_states(tracker, out_dir)

    print(f"Results saved to {out_dir}/")
    print_report(agent_df, poi_df, itin_df)

    return agent_df, poi_df, itin_df