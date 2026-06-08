import os
import uuid
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Photo
from app.schemas import PhotoOut, PhotoUpdate
from typing import List, Optional

router = APIRouter(prefix="/api/photos", tags=["photos"])

# ── Storage config ────────────────────────────────────────
# Set UPLOAD_DIR env var to override:
#   Railway testing : leave unset → uses ./uploads/ (resets on redeploy)
#   Raspberry Pi    : UPLOAD_DIR=/home/pi/kiln-uploads
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB   = 20


def _ensure_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def _photo_url(filename: str) -> str:
    return f"/api/photos/file/{filename}"


def _to_out(photo: Photo) -> PhotoOut:
    out = PhotoOut.model_validate(photo)
    out.url = _photo_url(photo.filename)
    if photo.burn:
        out.burn_name = photo.burn.name
    return out


# ── Endpoints ─────────────────────────────────────────────

@router.post("/", response_model=PhotoOut, status_code=201)
async def upload_photo(
    file:      UploadFile = File(...),
    title:     str = Form(""),
    notes:     str = Form(""),
    tags:      str = Form(""),          # comma-separated
    burn_id:   Optional[int] = Form(None),
    recipe_id: Optional[int] = Form(None),
    item_id:   Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    # Validate type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type not allowed: {content_type}. Use JPEG, PNG, or WebP.")

    # Read and check size
    data = await file.read()
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large (max {MAX_SIZE_MB}MB)")

    # Save file
    _ensure_dir()
    ext      = mimetypes.guess_extension(content_type) or ".jpg"
    if ext == ".jpe": ext = ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    path     = os.path.join(UPLOAD_DIR, filename)

    with open(path, "wb") as f:
        f.write(data)

    # Clean and normalise tags
    clean_tags = ",".join(t.strip().lower() for t in tags.split(",") if t.strip())

    photo = Photo(
        filename  = filename,
        original  = file.filename or "",
        mimetype  = content_type,
        title     = title,
        notes     = notes,
        tags      = clean_tags,
        burn_id   = burn_id,
        recipe_id = recipe_id,
        item_id   = item_id,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return _to_out(photo)


@router.get("/file/{filename}")
def serve_file(filename: str):
    """Serve an uploaded image file."""
    # Security: only allow simple filenames, no path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400, "Invalid filename")
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path)


@router.get("/", response_model=List[PhotoOut])
def list_photos(
    tag:       Optional[str] = None,
    burn_id:   Optional[int] = None,
    recipe_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    from sqlalchemy.orm import joinedload
    q = db.query(Photo).options(joinedload(Photo.burn)).order_by(Photo.created_at.desc())
    if burn_id:   q = q.filter(Photo.burn_id   == burn_id)
    if recipe_id: q = q.filter(Photo.recipe_id == recipe_id)
    if tag:
        t = tag.strip().lower()
        q = q.filter(Photo.tags.contains(t))
    return [_to_out(p) for p in q.all()]


@router.get("/tags")
def list_tags(db: Session = Depends(get_db)):
    """Return all unique tags across all photos, sorted."""
    photos = db.query(Photo.tags).all()
    tags   = set()
    for (tag_str,) in photos:
        for t in tag_str.split(","):
            t = t.strip()
            if t:
                tags.add(t)
    return sorted(tags)


@router.get("/burns")
def list_burns_with_photos(db: Session = Depends(get_db)):
    """Return burns that have at least one photo."""
    from sqlalchemy.orm import joinedload
    photos = db.query(Photo).options(joinedload(Photo.burn))               .filter(Photo.burn_id != None).all()
    seen = {}
    for p in photos:
        if p.burn_id and p.burn_id not in seen:
            seen[p.burn_id] = p.burn.name if p.burn else f"Burn #{p.burn_id}"
    return [{"id": k, "name": v} for k, v in seen.items()]


@router.get("/{photo_id}", response_model=PhotoOut)
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    p = db.get(Photo, photo_id)
    if not p:
        raise HTTPException(404, "Photo not found")
    return _to_out(p)


@router.put("/{photo_id}", response_model=PhotoOut)
def update_photo(photo_id: int, data: PhotoUpdate, db: Session = Depends(get_db)):
    p = db.get(Photo, photo_id)
    if not p:
        raise HTTPException(404, "Photo not found")
    update = data.model_dump(exclude_unset=True)
    if "tags" in update and update["tags"] is not None:
        update["tags"] = ",".join(t.strip().lower() for t in update["tags"].split(",") if t.strip())
    for k, v in update.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.delete("/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    p = db.get(Photo, photo_id)
    if not p:
        raise HTTPException(404, "Photo not found")
    # Delete file from disk
    path = os.path.join(UPLOAD_DIR, p.filename)
    if os.path.isfile(path):
        os.remove(path)
    db.delete(p)
    db.commit()
