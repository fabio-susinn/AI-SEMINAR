scoring --> diferentes srtaegias de recomendacion 

que graficos de plots podemos implementar en el report y en la web

limpiar datos

web modificar api call

sentiment analysis --> 


aware matching strategies --> 


investigar que plots i metricas




docker compose up --build



# Strategy hierarchy
---
1. PopularityBasedStrategy — non-personalised baseline
2. InterestsBasedStrategy — personalised, user-centric
3. SustainabilityAwareStrategy — multi-criteria, system-centric


# Personalized
Content-based filtering (Pazzani & Billsus, 2007) scores items by how well
    their attributes align with expressed user preferences.  Here, both tourist
    profiles and POIs share a common 7-dimensional interest space
    (cultural, architecture, food, outdoor, shopping, nightlife, nature),
    making a weighted dot-product the natural relevance measure.
 
    Tag overlap provides a discrete boost for exact-match interests (e.g. a
    tourist with interest "architecture" receives extra weight for POIs tagged
    "modernisme" or "gothic").
 
    Hard constraint filters encode non-negotiable access requirements:
    budget, physical accessibility for seniors, and child-friendliness.  These
    are applied as zero-out filters rather than soft penalties, since a
    constraint violation makes the POI genuinely unsuitable regardless of
    interest match — the tourist simply cannot or will not go there.
 
    Crowd aversion is modelled as a negative adjustment: a tourist who dislikes
    crowds will down-score busy POIs even if they are otherwise a perfect match.
    This is the key mechanism that can already disperse tourists away from
    hotspots when the profile warrants it.

# Sustainability
    Standard recommenders optimise for individual utility, which — when applied
    at scale — reproduces and amplifies existing spatial inequalities in tourist
    flows (Gretzel et al., 2020; UNWTO, 2019).
    Component details
    
    RELEVANCE (α = 0.40)
        Same 7-d dot-product as the interests-based strategy, but normalised
        so interest match never dominates the total.  Tourists must find the
        recommendation personally appealing — otherwise adoption collapses.
 
    SUSTAINABILITY (β = 0.20)
        poi.sustainability_score encodes environmental and socio-economic
        factors (e.g. locally owned, low carbon footprint, fair wages).
        Amplified by the tourist's own sustainability_sensitivity, which makes
        the bonus opt-in: eco-conscious tourists receive a stronger signal
        toward sustainable options.
 
    EQUITY / DISTRIBUTION (γ = 0.25)
        local_favourite flag identifies neighbourhood gems that receive
        disproportionately little tourist traffic relative to their quality.
        Promoting them redistributes footfall and economic benefit across the
        city, reducing spatial inequality (Koens et al., 2018).
        The bonus scales with novelty_seeking so that tourists who enjoy
        off-the-beaten-path experiences receive a stronger signal.
 
    DE-CROWDING (δ = 0.25)
        A penalty proportional to (avg_crowd_level × crowd_aversion).
        Unlike the interests-based strategy, this is applied to ALL tourists —
        not just those with high crowd_aversion — because systemic overcrowding
        is a negative externality regardless of individual preference.
        is_overtouristed applies an additional hard-coded malus to the most
        congested POIs, ensuring the system actively steers tourists away from
        them even when their relevance score is high


# Barcelona Tourist Simulation — Project Roadmap

## Overview

Agent-based evaluation system for a multi-criteria sustainable POI recommender in Barcelona.
Compares three strategies (popularity-based, interests-based, sustainability-aware) across simulated tourist populations.


---

## Phase 1 — Infrastructure ✅ Done

| Task | Status |
|------|--------|
| Project structure — `models/`, `simulation/`, `scoring/`, `utils/` packages | ✅ Done |
| Pydantic models — `POI`, `TouristProfile`, `POITracker`, `TripSentiment` | ✅ Done |
| 55 Barcelona POIs dataset (`barcelona_pois_model.json`) | ✅ Done |
| Three scoring strategies — popularity, interests, sustainability | ✅ Done |
| `ScoringFactory` with strategy selection | ✅ Done |
| `TouristAgent` with `step()`, fatigue, satisfaction, itinerary tracking | ✅ Done |
| Dynamic crowd level tracking (`live_crowd_level` in `POIState`) | ✅ Done |
| End-to-end simulation verified with 10 agents | ✅ Done |

---

## Phase 2 — Scale & Crowding 🔵 To do

### 2.1 Large-scale simulations (required)

The statement asks for thousands of tourists for statistical significance.
Run at least 500–1000 agents per strategy using the same seed for fair comparison.

```bash
python3 main.py --agents 1000 --seed 42 --no-sentiment --strategy popularity
python3 main.py --agents 1000 --seed 42 --no-sentiment --strategy interests
python3 main.py --agents 1000 --seed 42 --no-sentiment --strategy sustainability
```

### 2.2 Neighbourhood-level crowding indicators (required)

The statement explicitly mentions *"accumulation of tourists in certain neighbourhoods"* as a key outcome.
Currently only POI-level tracking exists. Group POIs by `district` and compute:

- Total visits per neighbourhood per strategy
- Gini coefficient of visit distribution across neighbourhoods
- Top-3 most visited neighbourhoods per strategy

Add a `neighbourhood_stats()` method to `POITracker` or as a post-processing step in `analysis.py`.

### 2.3 Dynamic crowd level updates (done)

`live_crowd_level` in `POIState` now updates as agents visit. Scoring strategies use the live value via `tracker.get_live_crowd(poi_id)`.

### 2.4 Dynamic crowd decay (optional)

Currently crowd level only increases within a simulation run. A time-decay function (crowd drops after dwell time expires) would make the simulation more realistic. Already partially implemented via the `_update_crowd` method which counts only currently-present agents.

---

## Phase 3 — Evaluation Metrics 🔴 To do

This is the academic core of the work. The statement requires comparison across strategies on multiple dimensions.

### 3.1 POI visit distribution analysis (required)

For each strategy, compute:
- Visit counts per POI
- **Gini coefficient** — measures inequality of visit distribution (0 = perfectly equal, 1 = all visits to one POI)
- **Top-10% concentration** — what % of total visits go to the 10% most visited POIs
- Whether overtouristed POIs (`is_overtouristed=True`) receive fewer visits under sustainability

```python
# example metric
def gini(visits: list[int]) -> float:
    n = len(visits)
    visits = sorted(visits)
    return sum((2*i - n - 1) * v for i, v in enumerate(visits, 1)) / (n * sum(visits))
```

### 3.2 Precision & diversity metrics (required)

- **Precision** — for each agent, what fraction of visited POIs match their primary interest category
- **Intra-list diversity** — average pairwise category distance across an agent's itinerary (are recommendations varied or repetitive?)
- **Coverage** — how many of the 55 POIs are visited at least once across all agents

### 3.3 Fairness analysis (required)

The statement mentions fairness and trustworthiness. Check whether certain profiles are systematically disadvantaged:
- Average POIs visited by budget level (`low` vs `medium` vs `high`)
- Average satisfaction by mobility mode
- Whether seniors/kids profiles receive 0-score recommendations more often under interests-based vs sustainability-aware

### 3.4 Movement & flow analysis (optional)

- Average travel distance between consecutive POIs per strategy
- Neighbourhood transition matrix — how often do agents cross from one district to another
- Spatial spread: standard deviation of visited POI coordinates

---

## Phase 4 — Sentiment & Reporting 🟡 Partial

### 4.1 LLM sentiment analysis (required)

`sentiment.py` is built but requires Ollama running locally with `llama3.2`. Two options:

**Option A — Ollama (local):**
```bash
ollama serve
ollama pull llama3.2
python3 main.py --agents 20 --seed 42 --strategy interests
```

**Option B — Claude API (more reliable):**
Replace the `_call_ollama()` function in `sentiment.py` with a call to the Anthropic API using `claude-haiku-4-5-20251001` for cost efficiency at scale.

### 4.2 Cross-strategy comparison report (required)

Currently each strategy saves results to its own folder but there is no script that loads all three and compares them side by side. Add a `compare_strategies.py` script that:

1. Loads `results/popularity/agents_no_sentiment.json`
2. Loads `results/interests/agents_no_sentiment.json`
3. Loads `results/sustainability/agents_no_sentiment.json`
4. Outputs a unified comparison table with avg POIs visited, avg satisfaction, avg money spent, and POI concentration metrics

### 4.3 Visualisations (optional)

- Bar chart: POI visit counts per strategy (top 20 POIs)
- Heatmap: visit concentration by neighbourhood across strategies
- Box plot: satisfaction distribution by tourist profile type
- Line chart: cumulative visits to overtouristed POIs over simulation steps

---

## Summary Table

| Phase | Task | Priority | Status |
|-------|------|----------|--------|
| 1 | Project infrastructure | — | ✅ Done |
| 1 | 55 POI dataset | — | ✅ Done |
| 1 | Three scoring strategies | — | ✅ Done |
| 1 | Agent simulator | — | ✅ Done |
| 1 | Dynamic crowd tracking | — | ✅ Done |
| 2 | Large-scale runs (1000+ agents) | Required | ⬜ To do |
| 2 | Neighbourhood-level crowding | Required | ⬜ To do |
| 3 | POI visit distribution + Gini | Required | ⬜ To do |
| 3 | Precision & diversity metrics | Required | ⬜ To do |
| 3 | Fairness analysis | Required | ⬜ To do |
| 3 | Movement & flow analysis | Optional | ⬜ To do |
| 4 | LLM sentiment analysis | Required | 🔶 Partial |
| 4 | Cross-strategy comparison report | Required | ⬜ To do |
| 4 | Visualisations | Optional | ⬜ To do |

---

## Running the full pipeline

```bash
# activate environment
source .venv/bin/activate

# run all three strategies
python3 main.py --agents 1000 --seed 42 --no-sentiment --strategy popularity
python3 main.py --agents 1000 --seed 42 --no-sentiment --strategy interests
python3 main.py --agents 1000 --seed 42 --no-sentiment --strategy sustainability

# compare results
python3 compare_strategies.py
```