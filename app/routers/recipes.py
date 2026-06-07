from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Recipe, RecipeIngredient, BurnRecipe
from app.schemas import RecipeCreate, RecipeUpdate, RecipeOut, RecipeRevisionOut
from typing import List
from datetime import datetime

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _is_in_use(db, recipe_id: int) -> bool:
    return db.query(BurnRecipe).filter(BurnRecipe.recipe_id == recipe_id).first() is not None


@router.get("/", response_model=List[RecipeOut])
def list_recipes(db: Session = Depends(get_db)):
    """Return the latest revision of each recipe base."""
    latest = db.query(
        func.max(Recipe.revision).label("max_rev"),
        Recipe.base_id
    ).group_by(Recipe.base_id).subquery()

    return db.query(Recipe).join(
        latest,
        (Recipe.base_id == latest.c.base_id) &
        (Recipe.revision == latest.c.max_rev)
    ).order_by(Recipe.name).all()


@router.get("/{recipe_id}/revisions", response_model=List[RecipeRevisionOut])
def list_revisions(recipe_id: int, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    base_id = r.base_id or r.id
    revisions = db.query(Recipe)\
                  .filter(Recipe.base_id == base_id)\
                  .order_by(Recipe.revision.desc()).all()
    result = []
    for rev in revisions:
        out = RecipeRevisionOut.model_validate(rev)
        out.in_use = _is_in_use(db, rev.id)
        result.append(out)
    return result


@router.post("/", response_model=RecipeOut, status_code=201)
def create_recipe(data: RecipeCreate, db: Session = Depends(get_db)):
    ingredients = data.ingredients
    payload = data.model_dump(exclude={"ingredients"})
    r = Recipe(**payload, revision=1)
    db.add(r); db.flush()
    r.base_id = r.id
    for i in ingredients:
        ing = RecipeIngredient(recipe_id=r.id, **i.model_dump())
        db.add(ing)
    db.commit(); db.refresh(r)
    return r


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    return r


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, data: RecipeUpdate, db: Session = Depends(get_db)):
    """Creates a new revision instead of editing in place."""
    existing = db.get(Recipe, recipe_id)
    if not existing:
        raise HTTPException(404, "Recipe not found")

    base_id = existing.base_id or existing.id
    max_rev = db.query(func.max(Recipe.revision))\
                .filter(Recipe.base_id == base_id).scalar() or 1

    update_data = data.model_dump(exclude_unset=True)
    ingredients_data = update_data.pop("ingredients", None)

    new_r = Recipe(
        base_id      = base_id,
        revision     = max_rev + 1,
        name         = update_data.get("name",         existing.name),
        description  = update_data.get("description",  existing.description),
        cone         = update_data.get("cone",         existing.cone),
        color        = update_data.get("color",        existing.color),
        surface      = update_data.get("surface",      existing.surface),
        firing_type  = update_data.get("firing_type",  existing.firing_type),
        notes        = update_data.get("notes",        existing.notes),
    )
    db.add(new_r); db.flush()

    if ingredients_data is not None:
        for i in data.ingredients:
            ing = RecipeIngredient(recipe_id=new_r.id, **i.model_dump())
            db.add(ing)
    else:
        for i in existing.ingredients:
            ing = RecipeIngredient(
                recipe_id  = new_r.id,
                element_id = i.element_id,
                amount     = i.amount,
                notes      = i.notes,
            )
            db.add(ing)

    db.commit(); db.refresh(new_r)
    return new_r


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    if _is_in_use(db, recipe_id):
        raise HTTPException(400, "Cannot delete — burns are using this revision")
    db.delete(r); db.commit()
