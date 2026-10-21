"""Etappe 5: Lokale Web-App – Embodied Carbon Pavillon Stockerau.

Starten (aus dem Projektordner):
    python webapp/app.py            -> http://localhost:8501
oder:
    uvicorn webapp.app:app --port 8501

Daten: webapp/static/data.json (erzeugt mit etappe5_webapp_data.py)
"""
from __future__ import annotations

import json
import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")

with open(os.path.join(STATIC, "data.json"), encoding="utf-8") as f:
    DATA = json.load(f)

app = FastAPI(title="Embodied Carbon – Pavillon Stockerau")


@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC, "index.html"))


@app.get("/api/data")
def get_data():
    return DATA


app.mount("/static", StaticFiles(directory=STATIC), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8501)
