"""
Barcelona Tourist Agent-Based Simulation
=========================================
Simulates N tourists navigating Barcelona POIs,
then uses Claude to generate post-trip sentiment reports.

Usage:
  python main.py                     # 10 agents, default settings
  python main.py --agents 50         # 50 agents
  python main.py --agents 20 --seed 42 --workers 3
  python main.py --agents 5 --no-sentiment   # skip LLM step
"""
import argparse
import json
import random
import sys
from pathlib import Path

from simulation.sentiment import analyse_all

# ── Dependency check ──────────────────────────────────────────────────────────


from models import POI, TouristProfile, POITracker
from simulation import (
    TouristAgent, AgentState,
    generate_profiles,
    analyse_all,
    save_results
)



DATA_FILE   = Path(__file__).parent / "data" / "barcelona_pois_model.json"
RESULTS_DIR = Path(__file__).parent / "results"
MAX_STEPS   = 30


# ── Simulation runner ─────────────────────────────────────────────────────────

def run_simulation(
    profiles: list[TouristProfile],
    pois: list[POI],
    max_steps: int = MAX_STEPS,
    verbose: bool = True,
) -> list[TouristAgent]:

    tracker = POITracker()
    tracker.setup(pois)
    agents = [TouristAgent(i, p, pois, tracker=tracker) for i, p in enumerate(profiles)]

    if verbose:
        print(f"\n── Simulation: {len(agents)} agents, {len(pois)} POIs ──")

    for step in range(max_steps):
        active = [a for a in agents if a.state != AgentState.DONE]
        if not active:
            break
        for agent in active:
            agent.step()

    if verbose:
        done    = sum(1 for a in agents if a.state == AgentState.DONE)
        visited = [len(a.visited) for a in agents]
        print(f"  Finished: {done}/{len(agents)} agents")
        print(f"  Avg POIs visited: {sum(visited)/len(visited):.1f}")
        print(f"  Total POI visits: {sum(visited)}")

    return agents, tracker


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Barcelona tourist simulation")
    parser.add_argument("--agents",       type=int,  default=10,    help="Number of tourist agents")
    parser.add_argument("--seed",         type=int,  default=None,  help="Random seed for reproducibility")
    parser.add_argument("--workers",      type=int,  default=5,     help="Parallel workers for sentiment API calls")
    parser.add_argument("--no-sentiment", action="store_true",      help="Skip LLM sentiment step")
    parser.add_argument("--verbose",      action="store_true",      help="Print per-agent details")
    parser.add_argument("--data",         type=str,  default=str(DATA_FILE), help="Path to POI JSON file")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
        print(f"Random seed: {args.seed}")

    # ── Load POIs ─────────────────────────────────────────────
    poi_path = Path(args.data)
    if not poi_path.exists():
        sys.exit(f"POI data not found: {poi_path}\nExpected: {DATA_FILE}")

    with open(poi_path) as f:
        pois = [POI(**p) for p in json.load(f)]
    print(f"Loaded {len(pois)} POIs from {poi_path.name}")

    # ── Generate tourist profiles ─────────────────────────────
    profiles = generate_profiles(args.agents, seed=args.seed)
    print(f"Generated {len(profiles)} tourist profiles")

    if args.verbose:
        for i, p in enumerate(profiles):
            print(f"  [{i}] {p.nationality}, {p.age}y, {p.budget_level}, "
                  f"{p.mobility_mode}, interests={p.interests[0] if p.interests else '?'}")

    # ── Run simulation ────────────────────────────────────────
    agents, tracker = run_simulation(profiles, pois, verbose=True)

    if args.verbose:
        print("\nPer-agent summaries:")
        for a in agents:
            s = a.summary()
            print(f"  [{s['agent_id']:>2}] {s['nationality']:<12} "
                  f"visited={s['pois_visited']} "
                  f"spent=€{s['money_spent']:.0f} "
                  f"fatigue={s['fatigue']:.2f} "
                  f"satisfaction={s['satisfaction']:.2f}")
            if args.verbose and a.visited:
                print(f"       → {' → '.join(p.name for p, _ in a.visited[:5])}"
                      + (" ..." if len(a.visited) > 5 else ""))

    # ── LLM sentiment analysis ────────────────────────────────
    if args.no_sentiment:
        print("\nSkipping sentiment analysis (--no-sentiment)")
        # Save simulation-only results
        RESULTS_DIR.mkdir(exist_ok=True)
        with open(RESULTS_DIR / "agents_no_sentiment.json", "w", encoding="utf-8") as f:
            json.dump([a.summary() for a in agents], f, indent=2)
        print(f"Agent summaries saved to {RESULTS_DIR}/agents_no_sentiment.json")
        return

    results = analyse_all(agents, max_workers=args.workers)

    if not results:
        print("No sentiment results generated.")
        return

    # ── Save and report ───────────────────────────────────────
    save_results(results, tracker, out_dir=str(RESULTS_DIR))


if __name__ == "__main__":
    main()