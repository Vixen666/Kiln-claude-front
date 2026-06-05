from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Recipe, RecipeIngredient
from app.schemas import RecipeCreate, RecipeUpdate, RecipeOut
from typing import List
from datetime import datetime

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _sync_ingredients(db, recipe, ingredients_data):
    for ing in recipe.ingredients:
        db.delete(ing)
    db.flush()
    for i in ingredients_data:
        ing = RecipeIngredient(recipe_id=recipe.id, **i.model_dump())
        db.add(ing)


@router.get("/", response_model=List[RecipeOut])
def list_recipes(db: Session = Depends(get_db)):
    return db.query(Recipe).order_by(Recipe.name).all()


@router.post("/", response_model=RecipeOut, status_code=201)
def create_recipe(data: RecipeCreate, db: Session = Depends(get_db)):
    if db.query(Recipe).filter(Recipe.name == data.name).first():
        raise HTTPException(400, "Recipe name already exists")
    ingredients = data.ingredients
    payload = data.model_dump(exclude={"ingredients"})
    recipe = Recipe(**payload)
    db.add(recipe); db.flush()
    for i in ingredients:
        ing = RecipeIngredient(recipe_id=recipe.id, **i.model_dump())
        db.add(ing)
    db.commit(); db.refresh(recipe)
    return recipe


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    return r


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, data: RecipeUpdate, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    update_data = data.model_dump(exclude_unset=True)
    ingredients_data = update_data.pop("ingredients", None)
    for k, v in update_data.items():
        setattr(r, k, v)
    r.updated_at = datetime.utcnow()
    if ingredients_data is not None:
        _sync_ingredients(db, r, data.ingredients)
    db.commit(); db.refresh(r)
    return r


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    db.delete(r); db.commit()
