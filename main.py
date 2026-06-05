from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import kilns, templates, burns, elements, recipes
import os

app = FastAPI(title="Kiln Controller", version="1.0.0")

# CORS — allows the React dev server (port 5173) to call the API
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

# Serve the built React frontend from /static
static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(static_dir) and os.listdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(os.path.join(static_dir, "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        index = os.path.join(static_dir, "index.html")
        return FileResponse(index)
