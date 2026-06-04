def run_agent_simulation(profile: AwareTouristProfile, recommended_pois: List[POI]) -> TripSentiment:
    # Starting coordinates (e.g., Plaça Catalunya)
    current_lat, current_lng = 41.3851, 2.1734 
    poi_sentiments = []
    total_score = 7.0 
    
    for poi in recommended_pois:
        dist = calculate_distance_km(current_lat, current_lng, poi.lat, poi.lng)
        
        # Update internal agent state
        profile.money_spent += poi.entry_price_eur
        profile.fatigue += (poi.avg_visit_duration_hours * 0.15) + (dist * 0.1)
        
        # Calculate local sentiment
        poi_match = calculate_aware_matching_score(profile, poi)
        crowd_penalty = poi.avg_crowd_level * profile.crowd_aversion
        sentiment_score = poi_match - crowd_penalty - (profile.fatigue * 0.2)
        
        # Determine sentiment category
        if sentiment_score > 1.2:
            sent_str, reason = "very_positive", f"Loved the match and the incredible {poi.category} environment."
            total_score += 0.5
        elif sentiment_score > 0.5:
            sent_str, reason = "positive", "Great experience, fits my travel style well."
            total_score += 0.2
        elif sentiment_score > -0.2:
            sent_str, reason = "neutral", "It was okay, but I was getting a bit tired."
        else:
            sent_str, reason = "negative", "Too crowded, far, or expensive for my current energy level."
            total_score -= 0.6
            
        poi_sentiments.append(POISentiment(poi_name=poi.name, sentiment=sent_str, reason=reason))
        
        # Move agent
        current_lat, current_lng = poi.lat, poi.lng

    final_score = max(0.0, min(10.0, total_score))
    
    if final_score >= 8.0:
        overall_sentiment = "very_positive"
    elif final_score >= 6.5:
        overall_sentiment = "positive"
    elif final_score >= 5.0:
        overall_sentiment = "neutral"
    elif final_score >= 3.0:
        overall_sentiment = "negative"
    else:
        overall_sentiment = "very_negative"
    
    return TripSentiment(
        overall_sentiment=overall_sentiment,
        overall_score=final_score,
        summary=f"A {overall_sentiment} exploration of Barcelona.",
        highlights=[p.poi_name for p in poi_sentiments if p.sentiment in ["very_positive", "positive"]],
        pain_points=[p.poi_name for p in poi_sentiments if p.sentiment in ["negative", "very_negative"]],
        would_recommend=final_score >= 6.5,
        would_return=final_score >= 7.5,
        poi_sentiments=poi_sentiments,
        emotional_arc="started_strong_tired_out" if profile.fatigue > 0.7 else "consistently_positive",
        suggested_improvements=["Incorporate more rest periods."] if profile.fatigue > 0.8 else []
    )

# 5. Frontend Graph Generator
def generate_aware_network_data(agent: AwareTouristProfile, recommended_pois: List[POI], all_pois: List[POI]) -> dict:
    agent_node_id = f"agent_{agent.id}"
    nodes = [{"id": agent_node_id, "label": f"Agent {agent.id} ({agent.nationality})", "group": "agent"}]
    edges = []
    added_poi_ids = set()
    
    def add_poi_node(poi: POI):
        if poi.id not in added_poi_ids:
            nodes.append({
                "id": f"poi_{poi.id}", 
                "label": poi.name, 
                "group": "poi", 
                "category": poi.category
            })
            added_poi_ids.add(poi.id)

    # Map Previous Knowledge (Awareness Set)
    for poi in all_pois:
        if poi.id in agent.awareness_set:
            add_poi_node(poi)
            edges.append({
                "from": agent_node_id,
                "to": f"poi_{poi.id}",
                "type": "aware_of",
                "label": "Known Prior"
            })

    # Map Recommendations & Sequence
    prev_poi_id = None
    for idx, poi in enumerate(recommended_pois):
        add_poi_node(poi)
        
        edges.append({
            "from": agent_node_id,
            "to": f"poi_{poi.id}",
            "type": "recommended",
            "weight": calculate_aware_matching_score(agent, poi)
        })
        
        if prev_poi_id:
            edges.append({
                "from": f"poi_{prev_poi_id}",
                "to": f"poi_{poi.id}",
                "type": "sequence_path",
                "step": idx + 1
            })
        prev_poi_id = poi.id
        
    return {"nodes": nodes, "edges": edges}

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    # Load environment
    all_pois = load_pois("barcelona_pois_model.json")
    
    # Create an Agent (High architecture interest, high novelty seeking)
    agent = AwareTouristProfile(
        age=28,
        nationality="Canadian",
        group_size=2,
        travel_with_kids=False,
        travel_with_seniors=False,
        budget_level="medium",
        daily_budget_eur=100.0,
        mobility_mode="walking",
        walking_tolerance="high",
        max_walking_distance_km=15.0,
        interests=["architecture", "gaudi", "photography", "markets"],
        outdoor_preference=0.7,
        cultural_interest=0.8,
        food_interest=0.6,
        architecture_interest=0.9,
        shopping_interest=0.2,
        nightlife_interest=0.3,
        nature_interest=0.4,
        crowd_aversion=0.6,
        sustainability_sensitivity=0.8,
        novelty_seeking=0.8, # Wants to see new things
        available_hours=8.0,
        trip_length_days=3,
        awareness_set=["18", "7", "26"] # Sagrada Familia, Park Guell, Casa Batllo/Manzana
    )


def main():
    pass

if __name__ == "__main__":
    main()