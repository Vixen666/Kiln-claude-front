from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models import Recipe, RecipeIngredient, BurnRecipe
from app.schemas import RecipeCreate, RecipeUpdate, RecipeOut, RecipeRevisionOut
from typing import List

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _load_recipe(db, recipe_id):
    return db.query(Recipe)\
             .options(joinedload(Recipe.ingredients)\
                      .joinedload(RecipeIngredient.element))\
             .filter(Recipe.id == recipe_id).first()


def _is_in_use(db, recipe_id: int) -> bool:
    return db.query(BurnRecipe)\
             .filter(BurnRecipe.recipe_id == recipe_id).first() is not None


@router.get("/", response_model=List[RecipeOut])
def list_recipes(db: Session = Depends(get_db)):
    """Return the latest revision of each recipe base, with ingredients."""
    latest = db.query(
        func.max(Recipe.revision).label("max_rev"),
        Recipe.base_id
    ).group_by(Recipe.base_id).subquery()

    ids = db.query(Recipe.id).join(
        latest,
        (Recipe.base_id == latest.c.base_id) &
        (Recipe.revision == latest.c.max_rev)
    ).all()
    id_list = [r.id for r in ids]

    return db.query(Recipe)\
             .options(joinedload(Recipe.ingredients)\
                      .joinedload(RecipeIngredient.element))\
             .filter(Recipe.id.in_(id_list))\
             .order_by(Recipe.name).all()


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


@router.get("/{recipe_id}/diff/{other_id}")
def diff_recipes(recipe_id: int, other_id: int, db: Session = Depends(get_db)):
    """Return a structured diff between two recipe revisions."""
    a = _load_recipe(db, recipe_id)
    b = _load_recipe(db, other_id)
    if not a or not b:
        raise HTTPException(404, "Recipe not found")

    changes = []

    # Field changes
    for field, label in [("name","Namn"),("cone","Kon"),("color","Färg"),
                          ("surface","Yta"),("firing_type","Bränningstyp"),("notes","Anteckningar")]:
        va, vb = getattr(a, field) or "", getattr(b, field) or ""
        if va != vb:
            changes.append({"type":"field","field":label,"from":va,"to":vb})

    # Ingredient changes
    a_ings = {i.element_id: i for i in a.ingredients}
    b_ings = {i.element_id: i for i in b.ingredients}
    all_ids = set(a_ings) | set(b_ings)

    for eid in all_ids:
        ai = a_ings.get(eid)
        bi = b_ings.get(eid)
        name = (ai or bi).element.name if (ai or bi) and (ai or bi).element else f"Element {eid}"
        if ai and not bi:
            changes.append({"type":"ingredient","name":name,"from":ai.amount,"to":None,"change":"removed"})
        elif bi and not ai:
            changes.append({"type":"ingredient","name":name,"from":None,"to":bi.amount,"change":"added"})
        elif ai.amount != bi.amount:
            diff = bi.amount - ai.amount
            changes.append({"type":"ingredient","name":name,
                            "from":ai.amount,"to":bi.amount,
                            "diff":diff,"change":"changed"})

    return {
        "from": {"id":a.id,"revision":a.revision,"name":a.name},
        "to":   {"id":b.id,"revision":b.revision,"name":b.name},
        "changes": changes,
    }


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
    db.commit()
    return _load_recipe(db, r.id)


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = _load_recipe(db, recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    return r


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, data: RecipeUpdate, db: Session = Depends(get_db)):
    existing = db.get(Recipe, recipe_id)
    if not existing:
        raise HTTPException(404, "Recipe not found")

    base_id = existing.base_id or existing.id
    if not existing.base_id:
        existing.base_id = existing.id
        db.flush()
    max_rev = db.query(func.max(Recipe.revision))                .filter(Recipe.base_id == base_id).scalar() or 1

    update_data      = data.model_dump(exclude_unset=True)
    ingredients_data = update_data.pop("ingredients", None)

    new_r = Recipe(
        base_id     = base_id,
        revision    = max_rev + 1,
        name        = update_data.get("name",        existing.name),
        description = update_data.get("description", existing.description),
        cone        = update_data.get("cone",        existing.cone),
        color       = update_data.get("color",       existing.color),
        surface     = update_data.get("surface",     existing.surface),
        firing_type = update_data.get("firing_type", existing.firing_type),
        notes       = update_data.get("notes",       existing.notes),
    )
    db.add(new_r); db.flush()

    if ingredients_data is not None:
        for i in ingredients_data:
            ing_dict = i if isinstance(i, dict) else i.model_dump()
            db.add(RecipeIngredient(recipe_id=new_r.id, **ing_dict))
    else:
        for i in (existing.ingredients or []):
            db.add(RecipeIngredient(
                recipe_id  = new_r.id,
                element_id = i.element_id,
                amount     = i.amount,
                notes      = i.notes or "",
            ))

    db.commit()
    return _load_recipe(db, new_r.id)


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    if _is_in_use(db, recipe_id):
        raise HTTPException(400, "Cannot delete — burns are using this revision")
    db.delete(r); db.commit()
