from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Item, Photo
from app.schemas import ItemCreate, ItemUpdate, ItemOut
from typing import List, Optional

router = APIRouter(prefix="/api/items", tags=["items"])


def _load(db, item_id):
    return db.query(Item)\
             .options(joinedload(Item.photos),
                      joinedload(Item.burn),
                      joinedload(Item.recipe))\
             .filter(Item.id == item_id).first()


def _to_out(item: Item) -> ItemOut:
    out = ItemOut.model_validate(item)
    if item.burn:
        out.burn_name = item.burn.name
    if item.recipe:
        out.recipe_name = item.recipe.name
    # Add URL to photos
    for p in out.photos:
        p.url = f"/api/photos/file/{p.filename}"
    return out


@router.get("/", response_model=List[ItemOut])
def list_items(
    status:    Optional[str]  = None,
    tag:       Optional[str]  = None,
    published: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Item)\
          .options(joinedload(Item.photos),
                   joinedload(Item.burn),
                   joinedload(Item.recipe))\
          .order_by(Item.created_at.desc())

    if status:    q = q.filter(Item.status == status)
    if published is not None: q = q.filter(Item.published == published)
    if tag:       q = q.filter(Item.tags.contains(tag.strip().lower()))

    return [_to_out(i) for i in q.all()]


@router.post("/", response_model=ItemOut, status_code=201)
def create_item(data: ItemCreate, db: Session = Depends(get_db)):
    item = Item(**data.model_dump())
    if item.tags:
        item.tags = ",".join(t.strip().lower() for t in item.tags.split(",") if t.strip())
    db.add(item)
    db.commit()
    return _to_out(_load(db, item.id))


@router.get("/tags")
def list_tags(db: Session = Depends(get_db)):
    items = db.query(Item.tags).all()
    tags = set()
    for (t,) in items:
        for tag in (t or "").split(","):
            tag = tag.strip()
            if tag: tags.add(tag)
    return sorted(tags)


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = _load(db, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    return _to_out(item)


@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, data: ItemUpdate, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "tags" and v:
            v = ",".join(t.strip().lower() for t in v.split(",") if t.strip())
        setattr(item, k, v)
    db.commit()
    return _to_out(_load(db, item_id))


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()


@router.post("/{item_id}/photos/{photo_id}", response_model=ItemOut)
def attach_photo(item_id: int, photo_id: int, db: Session = Depends(get_db)):
    """Link an existing photo to this item."""
    item  = db.get(Item, item_id)
    photo = db.get(Photo, photo_id)
    if not item or not photo:
        raise HTTPException(404, "Item or photo not found")
    photo.item_id = item_id
    db.commit()
    return _to_out(_load(db, item_id))
