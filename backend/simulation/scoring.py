from models import TouristProfile, POI


def match_score(poi: POI, profile: TouristProfile) -> float:
    """Dot-product interest match + crowd/sustainability adjustments."""
    axes = [
        (poi.outdoor_score,       profile.outdoor_preference),
        (poi.cultural_score,      profile.cultural_interest),
        (poi.food_score,          profile.food_interest),
        (poi.architecture_score,  profile.architecture_interest),
        (poi.shopping_score,      profile.shopping_interest),
        (poi.nightlife_score,     profile.nightlife_interest),
        (poi.nature_score,        profile.nature_interest),
    ]
    score = sum(p * t for p, t in axes)

    # Penalise crowd-averse tourists at busy spots
    score -= poi.avg_crowd_level * profile.crowd_aversion

    # Reward sustainable spots
    score += poi.sustainability_score * profile.sustainability_sensitivity * 0.2

    # Local gem bonus for novelty seekers
    if poi.local_favourite:
        score += profile.novelty_seeking * 0.15

    # Hard filters
    if poi.entry_price_eur > profile.daily_budget_eur:
        return 0.0
    if profile.travel_with_kids and not poi.kid_friendly:
        score *= 0.4
    if profile.travel_with_seniors and not poi.senior_friendly:
        score *= 0.5

    return max(score, 0.0)
