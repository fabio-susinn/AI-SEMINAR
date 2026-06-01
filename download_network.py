import os
import osmnx as ox

PLACE       = "Barcelona, Spain"
NETWORK_TYPE = "drive"
OUTPUT_GRAPHML = "data/barcelona_network.graphml"
OUTPUT_PNG     = "assets/ubarcelona_network.png"

os.makedirs("data", exist_ok=True)
os.makedirs("assets", exist_ok=True)

print(f"Downloading '{NETWORK_TYPE}' network for: {PLACE}")
G = ox.graph_from_place(PLACE, network_type=NETWORK_TYPE, simplify=True)

nodes, edges = ox.graph_to_gdfs(G)
print(f"  Nodes : {len(nodes):,}")
print(f"  Edges : {len(edges):,}")

ox.save_graphml(G, OUTPUT_GRAPHML)
print(f"Graph saved → {OUTPUT_GRAPHML}")

fig, ax = ox.plot_graph(
    G,
    figsize=(12, 12),
    node_size=0,
    edge_linewidth=0.4,
    edge_color="#CCCCCC",
    bgcolor="#111111",
    show=False,
    close=True,
)
fig.savefig(OUTPUT_PNG, dpi=150, bbox_inches="tight")
print(f"Map image saved --> {OUTPUT_PNG}")