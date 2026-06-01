import json
import re
import osmnx as ox

# Define file names
input_filename = "data/barcelona_pois.txt"
output_filename = "data/barcelona_pois.geojson"

venues_list = []

try:
    with open(input_filename, "r", encoding="utf-8") as f:
        for line in f:
            cleaned_line = line.strip()
            if cleaned_line:
                venues_list.append(cleaned_line)
except FileNotFoundError:
    print(f"Error: The file '{input_filename}' was not found.")
    print("Please create it and paste your list inside before running.")
    exit()

# Initialize standard GeoJSON structure
geojson_data = {"type": "FeatureCollection", "features": []}

print(f"Loaded {len(venues_list)} items. Starting OSMnx geocoding...\n")

for item in venues_list:
    # 1. Extract the ID number from the start of the line (e.g., "56." -> 56)
    id_match = re.match(r"^(\d+)\.", item)
    item_id = int(id_match.group(1)) if id_match else None

    # Clean title for querying
    clean_title = re.sub(r"^\d+\.\s*", "", item)

    lat, lon = None, None

    # 2. Geocoding logic
    try:
        query = f"{clean_title}, Barcelona, Spain"
        lat, lon = ox.geocode(query)
        print(f"✅ Found: {clean_title} -> ({lat}, {lon})")

    except Exception:
        try:
            # Fallback strategy if the full name fails
            short_title = clean_title.split(" Fira ")[0].split(" de ")[0]
            if len(short_title) > 5 and short_title != clean_title:
                fallback_query = f"{short_title}, Barcelona, Spain"
                lat, lon = ox.geocode(fallback_query)
                print(
                    f"⚠️ Found via fallback '{short_title}': {clean_title} -> ({lat}, {lon})"
                )
            else:
                raise Exception()
        except Exception:
            print(f"❌ Not Found (Saving with null coordinates): {clean_title}")
            lat, lon = None, None

    # 3. Create the GeoJSON feature (keeping null geometry if not found)
    if lat is not None and lon is not None:
        geometry = {
            "type": "Point",
            "coordinates": [lon, lat],  # GeoJSON format is [longitude, latitude]
        }
    else:
        geometry = None  # Valid GeoJSON layout for empty/unlocated features

    feature = {
        "type": "Feature",
        "id": item_id,
        "properties": {
            "id": item_id,
            "name": clean_title,
            "original_line": item,
        },
        "geometry": geometry,
    }
    geojson_data["features"].append(feature)

# 4. Save the full GeoJSON dataset
with open(output_filename, "w", encoding="utf-8") as out_f:
    json.dump(geojson_data, out_f, ensure_ascii=False, indent=4)

print("\n" + "=" * 40)
print(
    f"Finished processing! Saved all {len(geojson_data['features'])} items to the file."
)
print(f"File Location: {output_filename}")
print("=" * 40)