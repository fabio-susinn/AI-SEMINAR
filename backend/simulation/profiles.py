import json
import math
import random
from pathlib import Path
from models import POI, TouristProfile

DATA_FILE = Path(__file__).parent.parent / "data" / "barcelona_pois_model.json"

with open(DATA_FILE) as f:
    POIS = [POI(**p) for p in json.load(f)]

NATIONALITIES = [
    "Spanish", "French", "German", "British", "American",
    "Italian", "Japanese", "Brazilian", "Dutch", "Australian",
    "Canadian", "Chinese", "Argentinian", "Mexican", "Swedish",
]

INTEREST_PROFILE_TAGS = {

    "culture_lover": [
        "culture", "museum", "art", "contemporary-art", "modern-art",
        "history", "historic", "heritage", "UNESCO",
        "Picasso", "Miró", "MNAC",
        "gothic", "medieval", "roman", "romanesque",
        "cathedral", "monastery", "castle",
        "archaeological", "political", "1714",
        "theatre", "independent-theatre", "opera",
        "concerts", "exhibitions", "academic",
        "historic-palaces", "library",
        "sculpture", "sculptures",
        "cemetery", "mausoleums"
    ],

    "foodie": [
        "food", "seafood", "tapas",
        "market", "fresh-food",
        "local",
        "Sant Antoni", "El Born"
    ],

    "architecture": [
        "architecture", "modern-architecture",
        "modernisme", "Gaudí", "Domènech", "Puig", "Jujol",
        "iconic", "landmark",
        "modern", "modern-structure",
        "mosaic", "mosaic-roof",
        "neoclassical", "orientalist",
        "iron", "rooftop",
        "first-work", "Gaudí-lamps"
    ],

    "nature_hiker": [
        "nature", "park", "garden", "gardens",
        "botanic", "lake", "labyrinth",
        "roses", "peaceful", "quiet",
        "romantic", "beach",
        "views", "viewpoint", "panoramic",
        "sunset", "Montjuïc",
        "cable-car", "relaxing"
    ],

    "party_tourist": [
        "nightlife", "concerts",
        "rooftop", "sunset",
        "beach", "summer",
        "theatre", "independent-theatre"
    ],

    "shopper": [
        "market", "antiques",
        "flea-market", "books",
        "fresh-food",
        "Sant Antoni",
        "local"
    ],

    "backpacker": [
        "free-entry", "hidden", "hidden-gem",
        "photography", "street-art",
        "viewpoint", "panoramic", "sunset",
        "local", "historic",
        "Raval", "Gràcia", "Poblenou",
        "Gòtic", "El Born",
        "train-station",
        "anti-aircraft"
    ],

    "mixed": [
        "culture", "food", "architecture",
        "history", "museum", "art",
        "beach", "park", "views",
        "local", "iconic", "landmark",
        "modern", "historic",
        "nightlife", "market",
        "family", "sports",
        "zoo", "amusement-park",
        "1992", "olympic"
    ]
}


INTEREST_SETS = [
    ("culture_lover", 0.2, 0.9, 0.3, 0.8, 0.2, 0.1, 0.2),
    ("foodie", 0.3, 0.4, 0.95, 0.3, 0.4, 0.5, 0.1),
    ("architecture", 0.2, 0.7, 0.2, 0.98, 0.1, 0.1, 0.1),
    ("nature_hiker", 0.95, 0.3, 0.3, 0.2, 0.1, 0.0, 0.9),
    ("party_tourist", 0.4, 0.2, 0.6, 0.2, 0.5, 0.95, 0.2),
    ("shopper", 0.2, 0.3, 0.4, 0.3, 0.95, 0.4, 0.1),
    ("mixed", 0.5, 0.5, 0.5, 0.5, 0.3, 0.3, 0.4),
    ("backpacker", 0.6, 0.7, 0.5, 0.5, 0.2, 0.6, 0.6),
]


def _popularity_score(poi: POI) -> float:
    rating_score = (poi.google_rating / 5.0) if poi.google_rating is not None else 0.5
    review_score = 0.0
    if poi.review_count is not None and poi.review_count > 0:
        review_score = min(1.0, math.log10(poi.review_count) / math.log10(50_000))
    crowd_score = poi.avg_crowd_level
    local_bump = 0.15 if poi.local_favourite else 0.0
    raw = (
        0.40 * rating_score
        + 0.35 * review_score
        + 0.15 * crowd_score
        + 0.10 * (1.0 if poi.is_overtouristed else 0.0)
    ) + local_bump
    return min(1.0, raw)


def generate_awareness_set(
    profile: TouristProfile,
    pois: list[POI],
    min_pois: int = 3,
    max_pois: int = 8,
    seed: int | None = None,
) -> list[str]:
    if seed is not None:
        random.seed(seed)
    candidates = [(poi, _popularity_score(poi)) for poi in pois]
    if not candidates:
        return []
    t = (profile.available_hours - 6.0) / 6.0
    n_draw = max(min_pois, min(max_pois, round(min_pois + t * (max_pois - min_pois))))
    n_draw = min(n_draw, len(candidates))
    pois_list, weights = zip(*candidates)
    chosen = random.choices(pois_list, weights=weights, k=n_draw * 3)
    seen: set[str] = set()
    awareness: list[str] = []
    for poi in chosen:
        if poi.id not in seen:
            seen.add(poi.id)
            awareness.append(poi.id)
        if len(awareness) == n_draw:
            break
    if len(awareness) < n_draw:
        for poi, _ in sorted(candidates, key=lambda x: -x[1]):
            if poi.id not in seen:
                awareness.append(poi.id)
                seen.add(poi.id)
            if len(awareness) == n_draw:
                break
    return awareness


def generate_profile(seed: int | None = None) -> TouristProfile:
    if seed is not None:
        random.seed(seed)
    interests_label, outdoor, cultural, food, arch, shop, night, nature = random.choice(INTEREST_SETS)
    budget_level = random.choice(["low", "low", "medium", "medium", "medium", "high"])
    budget_map = {"low": (10, 20), "medium": (20, 40), "high": (40, 100)}
    daily_budget = round(random.uniform(*budget_map[budget_level]), 2)
    mobility = random.choice(["walking", "walking", "public_transport", "public_transport", "bike", "mixed"])
    walk_tol = random.choice(["low", "medium", "medium", "high"])
    walk_dist = {"low": 1.5, "medium": 3.5, "high": 7.0}[walk_tol]
    travel_with_kids = random.random() < 0.2
    travel_with_seniors = random.random() < 0.15
    group_size = random.choices([1, 2, 3, 4, 5], weights=[20, 35, 20, 15, 10])[0]
    available_hours = round(random.uniform(6, 12), 1)

    def jitter(v): return min(1.0, max(0.0, v + random.uniform(-0.15, 0.15)))

    profile = TouristProfile(
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
        interests=INTEREST_PROFILE_TAGS[interests_label],
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

    profile.awareness_set = generate_awareness_set(profile, POIS)
    return profile

def generate_profiles(n: int, seed: int | None = None) -> list[TouristProfile]:
    if seed is not None:
        random.seed(seed)
    return [generate_profile() for _ in range(n)]