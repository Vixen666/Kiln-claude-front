from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, engine
from app.routers import kilns, templates, burns, elements, recipes, settings, comments, photos, system_logs
from app import migrations
import os
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="Kiln Controller", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()          # creates any missing tables
    migrations.run(engine)  # adds any missing columns to existing tables

app.include_router(kilns.router)
app.include_router(templates.router)
app.include_router(burns.router)
app.include_router(elements.router)
app.include_router(recipes.router)
app.include_router(settings.router)
app.include_router(comments.router)
app.include_router(photos.router)
app.include_router(system_logs.router)

static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

@app.get("/", include_in_schema=False)
def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("assets/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    return FileResponse(os.path.join(static_dir, "index.html"))
