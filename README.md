# Barcelona Network Explorer

A full-stack application for exploring, simulating, and analyzing the Barcelona tourism, powered by a local LLM (Llama 3.1) via Ollama (sentiment analysis), a FastAPI backend, and a React frontend. This application was developed for the AI-Seminar course of the MAI UPC.

---

## Project Structure

```
.
├── backend/
│   ├── data/               # Input datasets (POIs, network data, etc.)
│   ├── models/             # Data models
│   ├── results/            # Simulation output (persisted via Docker volume)
│   ├── scoring/            # Scoring logic
│   ├── simulation/         # Simulation engine
│   ├── server.py           # FastAPI entry point
│   ├── Dockerfile
│   └── pyproject.toml
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── graphData.js
│       ├── GraphOverlay.jsx
│       ├── InfoPanel.jsx
│       ├── ItineraryPanel.jsx
│       ├── Statistics.jsx
│       ├── index.css
│       └── index.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── download_network.py     # Script to download network graph data
├── get_POIS_loc.py         # Script to fetch POI locations
├── get_POIS_title.py       # Script to fetch POI titles
├── compose.yml             # Docker Compose configuration
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (JSX), served via Nginx |
| Backend | Python, FastAPI (uv) |
| LLM | Llama 3.1 via Ollama |
| Containerization | Docker + Docker Compose |
| GPU Support | NVIDIA (optional, for Ollama) |

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- *(Optional)* NVIDIA GPU with drivers installed and [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) for GPU-accelerated inference

### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. (Optional) Download network and POI data

```bash
python get_POIS_loc.py
python get_POIS_title.py
```
These scripts will creat the raw .geojson file which later has been manually modified to include the attributes and correct latitude and longitude coordinates.

However, the repository already contains the data used, there is no need to re-execute the scripts.

### 3. Start all services

```bash
docker compose up --build
```

This will:

- Build and start the **FastAPI backend** on port `8000`
- Build and start the **React frontend** on port `80`
- Start the **Ollama** service on port `11434`
- Automatically pull the **Llama 3.1** model (via the `ollama-pull` service)

> The first startup may take several minutes while Ollama downloads the Llama 3.1 model (~4–8 GB depending on quantization).

### 4. Open the app

Navigate to [http://localhost](http://localhost) in your browser.

---

## ⚙️ Services

### `backend`
FastAPI server that exposes the simulation and scoring APIs. It communicates with Ollama at `http://ollama:11434/api/generate`.

- **Port:** `8000`
- **Volumes:** `./backend/results` and `./backend/data` are mounted for persistence

### `frontend`
React single-page application served through Nginx.

- **Port:** `80`
- **API target:** configured at build time via `REACT_APP_API_URL=http://localhost:8000`

### `ollama`
Local LLM inference server running Llama 3.1.

- **Port:** `11434`
- **Volume:** `ollama_models` (persisted across restarts)
- **GPU:** Uses all available NVIDIA GPUs if present

### `ollama-pull`
A one-shot service that waits for Ollama to be healthy, then pulls the `llama3.1` model. Runs once and exits.

---

## Data Persistence

| Volume / Mount | Purpose |
|---|---|
| `./backend/results` | Simulation outputs |
| `./backend/data` | Input datasets |
| `ollama_models` (Docker volume) | Downloaded LLM model weights |

---

## Networking

All services communicate over a shared Docker bridge network called `barcelona_net`. The frontend reaches the backend via the host machine (`localhost:8000`), while backend-to-Ollama communication happens internally over the Docker network.

---

## Stopping the Application

```bash
docker compose down
```

To also remove the Ollama model volume (this will require re-downloading the model next time):

```bash
docker compose down -v
```

---

## Environment Variables

| Variable | Service | Default | Description |
|---|---|---|---|
| `OLLAMA_URL` | backend | `http://ollama:11434/api/generate` | Ollama inference endpoint |
| `PYTHONUNBUFFERED` | backend | `1` | Enables real-time Python logging |
| `PYTHONPATH` | backend | `/app/..` | Python module resolution path |
| `REACT_APP_API_URL` | frontend (build arg) | `http://localhost:8000` | Backend API base URL |
| `OLLAMA_HOST` | ollama-pull | `http://ollama:11434` | Ollama host for the pull service |