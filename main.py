from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import kilns, templates, burns, elements, recipes, settings
import os

app = FastAPI(title="Kiln Controller", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

app.include_router(kilns.router)
app.include_router(templates.router)
app.include_router(burns.router)
app.include_router(elements.router)
app.include_router(recipes.router)
app.include_router(settings.router)

static_dir = os.path.join(os.path.dirname(__file__), "static")

# Serve static assets (JS, CSS) — must come before the catch-all
if os.path.isdir(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

# SPA catch-all — only for non-asset, non-api routes
@app.get("/", include_in_schema=False)
def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    # Don't intercept API or asset requests
    if full_path.startswith("api/") or full_path.startswith("assets/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    return FileResponse(os.path.join(static_dir, "index.html"))
