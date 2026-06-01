import os
from bs4 import BeautifulSoup
import requests

url = "https://www.timeout.es/barcelona/es/que-hacer/que-ver-en-barcelona-50-lugares-que-no-te-puedes-perder"
filename = "data/timeout_barcelona.html"
txt_output_filename = "data/barcelona_pois.txt"

headers = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/137.0.0.0 Safari/537.36"
    )
}

title_replacements = {
    "52. Mercat Encants Vells Fira de Bellcaire": "52. Mercat dels Encants de Barcelona",
    "50.Templo Romano de Augusto":"50.Temple d'August",
    "49.Jardines del Palau de les Heures":"49.Jardins del Palau de les Heures",
    "47.Biblioteca Pública Arús":"",
    "45.El Born Centre de Cultura i Memòria":"",
    "42.Mercat de les Flors/ Teatre Lliure":"",
    "41.CCCB. Centre de Cultura Contemporània de Barcelona":"",
    "40.Anilla Olímpica de Montjuïc":"",
    "38.Cementerios":"",
    "34.Plaza Prim":"",
    "30.Plaza de la Virreina":"",
    "26.Manzana de la Discordia":"",
    "24.Recinto Modernista de Sant Pau":"",
    "23.Plaza de Sant Felip Neri":"",
    "21.Montaña de Montjuïc":"",
    "20.Plaza de Sant Jaume":"",
    "17.Sant Pere de les Puel·les": "",
    "13.Macba/ Plaza dels Àngels":""
}

if not os.path.exists(filename):
    print("Fetching from the web...")
    response = requests.get(url, headers=headers)
    response.raise_for_status()

    # Save the HTML content to a file
    with open(filename, "w", encoding="utf-8") as f:
        f.write(response.text)
    print(f"Saved HTML to {filename}")
else:
    print(f"Loading local file: {filename}")

with open(filename, "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "lxml")
articles = soup.find_all("article")
article_titles = []

for article in articles:
    try:
        h3_tag = article.find("h3", {"data-testid": "tile-title_testID"})
        
        if h3_tag:
            title_text = h3_tag.get_text(strip=True)
            
            article_titles.append(title_text)
        else:
            print("Warning: Found an article container but no h3 title tag inside it.")
            
    except Exception as e:
        print(f"An error occurred while processing an article: {e}")

print(article_titles)

with open(txt_output_filename, "w", encoding="utf-8") as out_f:
    for title in article_titles[1:]:
        out_f.write(f"{title}\n")

print(f"Successfully saved {len(article_titles[1:])} POIs to {txt_output_filename}")