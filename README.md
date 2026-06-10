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