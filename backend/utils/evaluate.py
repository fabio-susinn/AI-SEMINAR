import sys
from pathlib import Path
import numpy as np
import pandas as pd
from tabulate import tabulate
import json

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))

from main import run_simulation
from models.POI import POI
from simulation.profiles import generate_profiles

DATA_FILE = ROOT_DIR / "data" / "barcelona_pois_model.json"

def calculate_gini(x):
    """Calculate the Gini coefficient to evaluate spatial inequality."""
    if len(x) == 0 or np.sum(x) == 0:
        return 0.0
    x = np.sort(x)
    n = len(x)
    index = np.arange(1, n + 1)
    return ((np.sum((2 * index - n - 1) * x)) / (n * np.sum(x)))

def run_comparative_evaluation(num_agents=100, seed=42):
    print(f"Initializing comparative evaluation with {num_agents} agents (Seed: {seed})")
    
    if not DATA_FILE.exists():
        sys.exit(f"Error: Could not find POI data at {DATA_FILE}")

    # Load identical POIs
    with open(DATA_FILE) as f:
        pois = [POI(**p) for p in json.load(f)]
    
    strategies = ["popularity", "interests", "sustainability"]
    evaluation_results = {}

    for strat in strategies:
        print(f"\nRunning simulation for strategy: '{strat}'...")
        # Re-generate identical profiles using fixed seed for fair comparison
        profiles = generate_profiles(num_agents, seed=seed)
        
        # Execute simulation (verbose=False to keep the console clean)
        agents, tracker = run_simulation(profiles, pois, strategy_name=strat, verbose=False)
        
        # --- Extract Base Metrics ---
        visit_counts = [tracker.get_live_crowd(poi.id) for poi in pois]
        total_visits = sum(len(a.visited) for a in agents)
        
        gini_index = calculate_gini(np.array(visit_counts))
        
        unique_pois_visited = len({p.id for a in agents for p, _ in a.visited})
        catalog_coverage = unique_pois_visited / len(pois) if pois else 0.0
        
        overtouristed_ids = {poi.id for poi in pois if poi.is_overtouristed}
        overtouristed_visits = sum(1 for a in agents for p, _ in a.visited if p.id in overtouristed_ids)
        overtourism_ratio = overtouristed_visits / max(1, total_visits)
        
        total_spend = sum(a.summary()['money_spent'] for a in agents)
        local_spend = sum(p.entry_price_eur for a in agents for p, _ in a.visited if p.local_favourite)
        local_revenue_ratio = local_spend / max(1, total_spend)
        
        # Diversity and Precision Metrics
        diversity_scores = []
        precision_scores = []
        
        for a in agents:
            if a.visited:
                unique_tags = set(tag for p, _ in a.visited for tag in p.tags)
                diversity_scores.append(len(unique_tags))
                
                # Calculate Precision
                if hasattr(a.profile, 'interests') and a.profile.interests:
                    matches = sum(1 for p, _ in a.visited if set(a.profile.interests).intersection(set(p.tags)))
                    precision_scores.append(matches / len(a.visited))

        avg_diversity = np.mean(diversity_scores) if diversity_scores else 0.0
        avg_precision = np.mean(precision_scores) if precision_scores else 0.0
        
        # Fairness Metrics
        low_budget_visits = [len(a.visited) for a in agents if a.profile.budget_level == "low"]
        high_budget_visits = [len(a.visited) for a in agents if a.profile.budget_level == "high"]
        avg_pois_low = np.mean(low_budget_visits) if low_budget_visits else 0.0
        avg_pois_high = np.mean(high_budget_visits) if high_budget_visits else 0.0
        
        family_sat = [a.summary()['satisfaction'] for a in agents if a.profile.travel_with_kids or a.profile.travel_with_seniors]
        solo_sat = [a.summary()['satisfaction'] for a in agents if not (a.profile.travel_with_kids or a.profile.travel_with_seniors)]
        avg_sat_family = np.mean(family_sat) if family_sat else 0.0
        avg_sat_solo = np.mean(solo_sat) if solo_sat else 0.0

        # Base Experience Metrics
        avg_satisfaction = np.mean([a.summary()['satisfaction'] for a in agents])
        avg_fatigue = np.mean([a.summary()['fatigue'] for a in agents])
        avg_pois_visited = np.mean([len(a.visited) for a in agents])
        
        # Store metrics 
        evaluation_results[strat] = {
            "Total Visits": total_visits,
            "Spatial Gini Index (Lower=Better)": round(gini_index, 3),
            "Overtourism Concentration %": f"{overtourism_ratio * 100:.1f}%",
            "Local Revenue Distribution %": f"{local_revenue_ratio * 100:.1f}%",
            "Catalog Coverage %": f"{catalog_coverage * 100:.1f}%",
            "Intra-List Diversity (Avg Unique Tags)": round(avg_diversity, 1),
            "Average Tourist Satisfaction": round(avg_satisfaction, 2),
            "Average Transit/Walk Fatigue": round(avg_fatigue, 2),
            "Avg POIs Visited": round(avg_pois_visited, 1),
            "Precision (Interest Match) %": f"{avg_precision * 100:.1f}%",
            "Fairness: Low Budget (Avg POIs)": round(avg_pois_low, 1),
            "Fairness: High Budget (Avg POIs)": round(avg_pois_high, 1),
            "Fairness: Vulnerable Sat (Kids/Senior)": round(avg_sat_family, 2),
            "Fairness: Standard Sat": round(avg_sat_solo, 2)
        }

    # Format and output comparison grid
    df = pd.DataFrame(evaluation_results).T
    print("\n=================================================================== SEMINAR EVALUATION METRICS REPORT ===================================================================")
    print(tabulate(df, headers='keys', tablefmt='grid'))
    print("=========================================================================================================================================================================\n")

if __name__ == "__main__":
    run_comparative_evaluation(num_agents=100, seed=1234)