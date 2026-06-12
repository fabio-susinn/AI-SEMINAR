"""LLM-powered post-trip sentiment analysis using local Ollama."""
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.error

from .agent import TouristAgent
from models import TripSentiment

OLLAMA_URL   = "http://barcelona_ollama:11434/api/generate"
OLLAMA_MODEL = "llama3.1:latest"   # change to whichever model you pulled

SENTIMENT_SCHEMA = """{
  "overall_sentiment": "very_positive"|"positive"|"neutral"|"negative"|"very_negative",
  "overall_score": float 0-10,
  "summary": "2-3 sentence first-person narrative",
  "highlights": ["best moments as strings"],
  "pain_points": ["frustrations as strings"],
  "would_recommend": bool,
  "would_return": bool,
  "poi_sentiments": [
    {"poi_name": "string", "sentiment": "very_positive"|"positive"|"neutral"|"negative"|"very_negative", "reason": "one sentence"}
  ],
  "emotional_arc": "consistently_positive"|"started_strong_tired_out"|"slow_start_great_finish"|"mixed_throughout"|"mostly_negative",
  "suggested_improvements": ["suggestions as strings"]
}"""


def build_trip_narrative(agent: TouristAgent) -> str:
    p = agent.profile
    poi_lines = "\n".join([
        f"  {i+1}. {poi.name} "
        f"(category={poi.category}, price=€{poi.entry_price_eur:.0f}, "
        f"crowd={poi.avg_crowd_level:.1f}, arrived={t:.1f}h)"
        for i, (poi, t) in enumerate(agent.visited)
    ]) or "  (no POIs visited)"

    return f"""TOURIST PROFILE
- Age: {p.age} | Nationality: {p.nationality}
- Group: {p.group_size} people | Kids: {p.travel_with_kids} | Seniors: {p.travel_with_seniors}
- Budget: {p.budget_level} (€{p.daily_budget_eur:.0f}/day) | Spent: €{agent.money_spent:.2f}
- Mobility: {p.mobility_mode} | Walking tolerance: {p.walking_tolerance}
- Interests: {', '.join(p.interests)}
- Scores → outdoor:{p.outdoor_preference:.1f} cultural:{p.cultural_interest:.1f} food:{p.food_interest:.1f} arch:{p.architecture_interest:.1f} shop:{p.shopping_interest:.1f} night:{p.nightlife_interest:.1f} nature:{p.nature_interest:.1f}
- Crowd aversion: {p.crowd_aversion:.1f} | Novelty seeking: {p.novelty_seeking:.1f}

TRIP OUTCOME
- POIs visited: {len(agent.visited)} over {agent.current_time - 9.0:.1f}h (of {p.available_hours:.0f}h available)
- Final fatigue: {agent.fatigue:.2f}/1.0
- Final satisfaction score: {agent.satisfaction:.2f}

ITINERARY
{poi_lines}"""


def _call_ollama(prompt: str, retries: int = 3) -> str:
    payload = json.dumps({
        "model":  OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",        # forces JSON output mode
        "options": {
            "temperature": 0.3,  # lower = more consistent JSON
            "num_predict": 1200,
        },
    }).encode("utf-8")

    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                OLLAMA_URL,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result["response"]
        except urllib.error.URLError as e:
            if "Connection refused" in str(e):
                raise RuntimeError(
                    "Ollama is not running. Start it with: ollama serve"
                ) from e
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise


def analyse_trip(agent: TouristAgent, retries: int = 3) -> TripSentiment | None:
    narrative = build_trip_narrative(agent)

    prompt = f"""You are simulating the authentic post-trip sentiment of a tourist who just finished a day in Barcelona.

Based on their profile and itinerary, write a realistic sentiment report from their perspective.

Consider:
- How well each POI matched their stated interests
- Fatigue: >0.8 means exhausted, <0.3 means energetic
- Crowd aversion vs actual crowd levels at visited spots
- Budget: did they overspend or stay comfortable?
- Whether they saw enough given their available hours

Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation, no extra keys):
{SENTIMENT_SCHEMA}

Trip data:
{narrative}"""

    for attempt in range(retries):
        try:
            text = _call_ollama(prompt)

            # Strip accidental markdown fences
            text = text.strip()
            if text.startswith("```"):
                text = "\n".join(text.split("\n")[1:])
            if text.endswith("```"):
                text = "\n".join(text.split("\n")[:-1])

            data = json.loads(text.strip())
            return TripSentiment(**data)

        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  [!] Sentiment failed for agent {agent.agent_id}: {e}")
                return None


def analyse_all(
    agents: list[TouristAgent],
    run_sentiment: bool = True,
    max_workers: int = 2,
) -> list[tuple[TouristAgent, TripSentiment]]:
    
    eligible = [a for a in agents if a.visited]

    if not run_sentiment:
        return [
            (agent, TripSentiment())
            for agent in eligible
        ]
    
    results  = []

    print(f"\n── Sentiment analysis: {len(eligible)} agents (model: {OLLAMA_MODEL}) ──")
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(analyse_trip, agent): agent for agent in eligible}
        for future in as_completed(futures):
            agent     = futures[future]
            sentiment = future.result()
            if sentiment:
                results.append((agent, sentiment))
                print(
                    f"  agent {agent.agent_id:>3} [{agent.profile.nationality:<12}] "
                    f"{sentiment.overall_sentiment:<16} {sentiment.overall_score:.1f}/10"
                )

    return results