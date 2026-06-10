"""Generate synthetic but realistic TouristProfile instances."""
import random
from models import TouristProfile

NATIONALITIES = [
    "Spanish", "French", "German", "British", "American",
    "Italian", "Japanese", "Brazilian", "Dutch", "Australian",
    "Canadian", "Chinese", "Argentinian", "Mexican", "Swedish",
]

INTEREST_SETS = [
    # (label, outdoor, cultural, food, arch, shop, night, nature)
    ("culture_lover",   0.2, 0.9, 0.3, 0.8, 0.2, 0.1, 0.2),
    ("foodie",          0.3, 0.4, 0.95, 0.3, 0.4, 0.5, 0.1),
    ("architecture",    0.2, 0.7, 0.2, 0.98, 0.1, 0.1, 0.1),
    ("nature_hiker",    0.95, 0.3, 0.3, 0.2, 0.1, 0.0, 0.9),
    ("party_tourist",   0.4, 0.2, 0.6, 0.2, 0.5, 0.95, 0.2),
    ("shopper",         0.2, 0.3, 0.4, 0.3, 0.95, 0.4, 0.1),
    ("mixed",           0.5, 0.5, 0.5, 0.5, 0.3, 0.3, 0.4),
    ("backpacker",      0.6, 0.7, 0.5, 0.5, 0.2, 0.6, 0.6),
]


def generate_profile(seed: int | None = None) -> TouristProfile:
    if seed is not None:
        random.seed(seed)

    interests_label, outdoor, cultural, food, arch, shop, night, nature = random.choice(INTEREST_SETS)
    budget_level = random.choice(["low", "low", "medium", "medium", "medium", "high"])
    budget_map   = {"low": (40, 80), "medium": (80, 180), "high": (180, 400)}
    daily_budget = round(random.uniform(*budget_map[budget_level]), 2)

    mobility = random.choice(["walking", "walking", "public_transport", "public_transport", "bike", "mixed"])
    walk_tol = random.choice(["low", "medium", "medium", "high"])
    walk_dist = {"low": 1.5, "medium": 3.5, "high": 7.0}[walk_tol]

    travel_with_kids    = random.random() < 0.2
    travel_with_seniors = random.random() < 0.15
    group_size          = random.choices([1, 2, 3, 4, 5], weights=[20, 35, 20, 15, 10])[0]

    available_hours = round(random.uniform(6, 12), 1)

    # Add noise to interest scores
    def jitter(v): return min(1.0, max(0.0, v + random.uniform(-0.15, 0.15)))

    return TouristProfile(
        age=random.randint(18, 72),
        nationality=random.choice(NATIONALITIES),
        group_size=group_size,
        travel_with_kids=travel_with_kids,
        travel_with_seniors=travel_with_seniors,
        budget_level=budget_level,
        daily_budget_eur=daily_budget,
        mobility_mode=mobility,
        walking_tolerance=walk_tol,
        max_walking_distance_km=walk_dist,
        interests=[interests_label],
        outdoor_preference=jitter(outdoor),
        cultural_interest=jitter(cultural),
        food_interest=jitter(food),
        architecture_interest=jitter(arch),
        shopping_interest=jitter(shop),
        nightlife_interest=jitter(night),
        nature_interest=jitter(nature),
        crowd_aversion=round(random.uniform(0.0, 1.0), 2),
        sustainability_sensitivity=round(random.uniform(0.0, 1.0), 2),
        novelty_seeking=round(random.uniform(0.0, 1.0), 2),
        available_hours=available_hours,
        trip_length_days=random.randint(1, 7),
    )


def generate_profiles(n: int, seed: int | None = None) -> list:
    if seed is not None:
        random.seed(seed)
    return [generate_profile() for _ in range(n)]
