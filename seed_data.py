#!/usr/bin/env python3
"""
seed_data.py — Fyller databasen med vanliga keramiska råmaterial och glasyrrecept.

Kör från kiln/-mappen:
    python seed_data.py

Eller mot Railway:
    API_URL=https://din-app.up.railway.app python seed_data.py
"""

import os
import requests
import json

API_URL = os.environ.get("API_URL", "http://localhost:8000")

def post(path, data):
    r = requests.post(f"{API_URL}/api{path}", json=data)
    if r.status_code in (200, 201):
        print(f"  ✓ {data.get('name', path)}")
        return r.json()
    elif r.status_code == 400 and "already exists" in r.text:
        print(f"  – {data.get('name', path)} (finns redan)")
        # Fetch existing
        name = data.get("name", "")
        all_r = requests.get(f"{API_URL}/api{path}")
        if all_r.ok:
            for item in all_r.json():
                if item["name"] == name:
                    return item
        return None
    else:
        print(f"  ✗ {data.get('name', path)}: {r.status_code} {r.text[:120]}")
        return None


# ── RÅMATERIAL (Elements) ──────────────────────────────────────────────────────

print("\n📦 Skapar råmaterial…\n")

elements_data = [

    # ── Kiselkällor ──
    dict(name="Kvarts", description="Ren kiseldioxid. Vanligaste kiselkällan.",
         chemical_formula="SiO₂", supplier="Digitalfire / Keramikmaterial",
         location="Hylla A1", stock_amount=5000, stock_unit="g",
         reorder_level=500,
         notes="Mycket fin kornstorlek (200 mesh). Höjer glasyrmognad och hårdhet."),

    dict(name="Flint", description="Bränd och mald kiseldioxid. Alternativ till kvarts.",
         chemical_formula="SiO₂", supplier="Keramikmaterial",
         location="Hylla A1", stock_amount=2000, stock_unit="g",
         reorder_level=300,
         notes="Ger jämnare yta än kvarts i vissa glasyrtyper."),

    # ── Fältspater ──
    dict(name="Kaliumfältspat", description="Naturfältspat, KNaO-Al₂O₃-SiO₂. Vanlig flussmedelsråvara.",
         chemical_formula="KAlSi₃O₈", supplier="Keramikmaterial",
         location="Hylla A2", stock_amount=8000, stock_unit="g",
         reorder_level=1000,
         notes="Ger glasyr en mjuk, mogen yta. Används i stor andel i de flesta glasyrrecept."),

    dict(name="Natriumfältspat (Albite)", description="Natriumrik fältspat.",
         chemical_formula="NaAlSi₃O₈", supplier="Keramikmaterial",
         location="Hylla A2", stock_amount=3000, stock_unit="g",
         reorder_level=300,
         notes="Lägre smältpunkt än kaliumfältspat. Ger blankare yta."),

    dict(name="Cornwallsten", description="Naturlig blandningsfältspat från Cornwall.",
         chemical_formula="K₂O·Al₂O₃·8SiO₂", supplier="Sneyd Ceramics",
         location="Hylla A2", stock_amount=5000, stock_unit="g",
         reorder_level=500,
         notes="Populär engelska råvara. Ger mjuka, halvblanka ytor i kon 6."),

    dict(name="Nefelin syenit", description="Fältspat med låg kiselhalt. Stark flussverkan.",
         chemical_formula="NaAlSiO₄", supplier="Keramikmaterial",
         location="Hylla A2", stock_amount=4000, stock_unit="g",
         reorder_level=400,
         notes="Sänker smältpunkten. Bra i mat-glasyrrecept med kornighet."),

    # ── Lermineral ──
    dict(name="Kaolin (EPK)", description="Ren eldfast lera. Ger hållbarhet och suspension.",
         chemical_formula="Al₂Si₂O₅(OH)₄", supplier="Digitalfire",
         location="Hylla B1", stock_amount=6000, stock_unit="g",
         reorder_level=600,
         notes="EPK = Edgar Plastic Kaolin. Håller glasyrslipingen i suspension. Minskar krypning."),

    dict(name="Kalcinerad kaolin", description="Bränd kaolin utan kemiskt bundet vatten.",
         chemical_formula="Al₂Si₂O₅", supplier="Keramikmaterial",
         location="Hylla B1", stock_amount=2000, stock_unit="g",
         reorder_level=200,
         notes="Blandas med EPK för att minska glasyrens krympning vid torkning."),

    dict(name="OM-4 Boll lera", description="Mjuk plastisk lera. Ger god suspension.",
         chemical_formula="Al₂Si₂O₅(OH)₄", supplier="Digitalfire",
         location="Hylla B1", stock_amount=3000, stock_unit="g",
         reorder_level=300,
         notes="Alternativ till EPK. Ger ännu bättre suspension men mer krympning."),

    # ── Kalk och dolomit ──
    dict(name="Whiting (kalciumkarbonat)", description="Krita/kalk. Stabilisator och flussmedel vid höga temperaturer.",
         chemical_formula="CaCO₃", supplier="Keramikmaterial",
         location="Hylla B2", stock_amount=4000, stock_unit="g",
         reorder_level=400,
         notes="Viktig källa för kalcium (CaO) i glasyr. Ger hård, kemiskt beständig glasyr."),

    dict(name="Dolomit", description="Kalcium-magnesiumkarbonat. Ger matthet och kremig textur.",
         chemical_formula="CaMg(CO₃)₂", supplier="Keramikmaterial",
         location="Hylla B2", stock_amount=3000, stock_unit="g",
         reorder_level=300,
         notes="Kombinerar CaO och MgO. Typisk ingrediens i Matt-glasyrrecept."),

    dict(name="Magnesiumkarbonat", description="Lätt magnesiumkälla. Mattningsmedel.",
         chemical_formula="MgCO₃", supplier="Keramikmaterial",
         location="Hylla B2", stock_amount=1500, stock_unit="g",
         reorder_level=200,
         notes="Ger mycket stark matthet. Används sparsamt — för mycket ger torr, sträv yta."),

    # ── Zink, Barium, Strontium ──
    dict(name="Zinkoxid", description="Flussmedel och mattningsmedel. Ger kristallina ytor.",
         chemical_formula="ZnO", supplier="Keramikmaterial",
         location="Hylla C1", stock_amount=1000, stock_unit="g",
         reorder_level=100,
         notes="Kan ge kristallbildning vid långsam kylning. Oxiderande bränning ger bäst resultat."),

    dict(name="Bariumkarbonat", description="Starkt flussmedel. Ger satin- till mattyta.",
         chemical_formula="BaCO₃", supplier="Keramikmaterial",
         location="Hylla C1", stock_amount=1000, stock_unit="g",
         reorder_level=100,
         notes="⚠ Giftigt — använd andningsskydd vid vägning. Ger unik sidenmatt yta."),

    dict(name="Strontiumkarbonat", description="Alternativ till barium, mindre toxiskt.",
         chemical_formula="SrCO₃", supplier="Keramikmaterial",
         location="Hylla C1", stock_amount=800, stock_unit="g",
         reorder_level=100,
         notes="Liknar bariumkarbonat i effekt men säkrare att hantera. Ger mjuk, halvmatt glasyr."),

    # ── Talkning och benaska ──
    dict(name="Talk", description="Magnesiumsilikat. Flussmedel vid lägre temperaturer.",
         chemical_formula="Mg₃Si₄O₁₀(OH)₂", supplier="Keramikmaterial",
         location="Hylla C2", stock_amount=2000, stock_unit="g",
         reorder_level=200,
         notes="Bra i låg-temperatur glasyrrecept (kon 06–04). Ger opacitet och matthet."),

    dict(name="Benaska (Bone Ash)", description="Kalciumfosfat från bränt ben. Opacifierare.",
         chemical_formula="Ca₃(PO₄)₂", supplier="Keramikmaterial",
         location="Hylla C2", stock_amount=500, stock_unit="g",
         reorder_level=100,
         notes="Ger mjuk opacitet och silkig yta. Klassisk ingrediens i engelsk benporslin."),

    # ── Opacifierare ──
    dict(name="Zirkoniumsilikat (Zircopax)", description="Vit opacifierare. Ger krita-vit glasyr.",
         chemical_formula="ZrSiO₄", supplier="Digitalfire",
         location="Hylla D1", stock_amount=2000, stock_unit="g",
         reorder_level=200,
         notes="Vanligaste opacifieraren. 8–12% ger opak vit glasyr. Höjer smältpunkten något."),

    dict(name="Titaniumdioxid", description="Opacifierare och strukturskapare.",
         chemical_formula="TiO₂", supplier="Keramikmaterial",
         location="Hylla D1", stock_amount=500, stock_unit="g",
         reorder_level=100,
         notes="Lägre andel än zirkon. Ger varmare, kremig opacitet och kan skapa rörelse i glasyrerna."),

    # ── Färgoxider ──
    dict(name="Koboltkarbonat", description="Blå färgoxid. Kraftig — används i liten mängd.",
         chemical_formula="CoCO₃", supplier="Keramikmaterial",
         location="Hylla D2", stock_amount=200, stock_unit="g",
         reorder_level=50,
         notes="0.5–2% ger intensivt blått. Karbonat löser sig jämnare än oxid. Fungerar i reduktion och oxidation."),

    dict(name="Koboltoxid", description="Blå färgoxid. Kraftigare än karbonat.",
         chemical_formula="CoO", supplier="Keramikmaterial",
         location="Hylla D2", stock_amount=100, stock_unit="g",
         reorder_level=30,
         notes="0.25–1% räcker. Kan ge fläckar om den inte dispergeras väl."),

    dict(name="Kopparkarbonat", description="Grön/turkos färgoxid i oxidation, röd i reduktion.",
         chemical_formula="CuCO₃", supplier="Keramikmaterial",
         location="Hylla D2", stock_amount=300, stock_unit="g",
         reorder_level=50,
         notes="2–4% ger grönt. I reduktion → kopparrött (chun). ⚠ Flyktigt vid höga temperaturer."),

    dict(name="Järnoxid (röd)", description="Vanligaste färgoxiden. Ger brunt, amber och celadon.",
         chemical_formula="Fe₂O₃", supplier="Keramikmaterial",
         location="Hylla D2", stock_amount=1000, stock_unit="g",
         reorder_level=100,
         notes="2–4% ger amber/brun i oxidation. I reduktion → grågrönt (celadon) vid 1–2%. 8–12% ger temmoku-svart."),

    dict(name="Mangankarbonat", description="Lila-brun färgoxid. Ger unika texturer.",
         chemical_formula="MnCO₃", supplier="Keramikmaterial",
         location="Hylla D3", stock_amount=300, stock_unit="g",
         reorder_level=50,
         notes="2–5% ger lila-brunt. Kombineras ofta med kobolt för lila. ⚠ Undvik höga halter — manganångor vid bränning."),

    dict(name="Rutyl", description="Titaniumdioxid med järn. Ger rörelse och textur i glasyr.",
         chemical_formula="TiO₂ + Fe₂O₃", supplier="Keramikmaterial",
         location="Hylla D3", stock_amount=500, stock_unit="g",
         reorder_level=100,
         notes="5–10% ger beige-gul med streakad textur. Populär i moderna hantverk-glasyrrecept."),

    dict(name="Kromoxid", description="Grön färgoxid. Ger olivgrönt.",
         chemical_formula="Cr₂O₃", supplier="Keramikmaterial",
         location="Hylla D3", stock_amount=200, stock_unit="g",
         reorder_level=50,
         notes="1–2% ger olivgrönt. Reagerar med zink → brunt. Reagerar med tenn → rosa/röd (viktigt att veta!)."),

    dict(name="Nickeloxid", description="Grå-grön färgoxid. Ger nedtonade, jordiga toner.",
         chemical_formula="NiO", supplier="Keramikmaterial",
         location="Hylla D3", stock_amount=150, stock_unit="g",
         reorder_level=30,
         notes="1–3% ger grå-grönt eller brunt beroende på glasyr. Bra som modifierare av andra oxider."),

    # ── Fritter ──
    dict(name="Frit 3134", description="Borsylfrit. Vanlig flussmedelskomponent.",
         chemical_formula="Na₂O·B₂O₃·2SiO₂ (approx)", supplier="Digitalfire",
         location="Hylla E1", stock_amount=3000, stock_unit="g",
         reorder_level=300,
         notes="Ger borsyra och natrium i säker, olöslig form. Standard-ingrediens i kon 6 glasyrrecept."),

    dict(name="Frit 3195", description="Kalcium-borfrit. Låg smältpunkt.",
         chemical_formula="CaO·B₂O₃·SiO₂ (approx)", supplier="Digitalfire",
         location="Hylla E1", stock_amount=2000, stock_unit="g",
         reorder_level=200,
         notes="Bra för glasyrrecept som behöver extra flussverkan utan att bli för blanka."),
]

elements = {}
for e in elements_data:
    result = post("/elements/", e)
    if result:
        elements[e["name"]] = result["id"]

print(f"\n  → {len(elements)} råmaterial klara.\n")


# ── GLASYRRECEPT ───────────────────────────────────────────────────────────────

print("⚗️  Skapar glasyrrecept…\n")

def recipe(name, description, cone, color, surface, firing_type, notes, ingredients_raw):
    """ingredients_raw = list of (element_name, amount_g)"""
    ingredients = []
    for el_name, amount in ingredients_raw:
        if el_name not in elements:
            print(f"    ⚠ Saknar element: {el_name}")
            continue
        ingredients.append({"element_id": elements[el_name], "amount": amount, "notes": ""})

    return post("/recipes/", dict(
        name=name, description=description, cone=cone,
        color=color, surface=surface, firing_type=firing_type,
        notes=notes, ingredients=ingredients,
    ))


# ── Kon 6 oxidation ──

recipe(
    name        = "Standard Vit Kon 6",
    description = "Enkel, pålitlig vit glasyr för kon 6 oxidation. Bra grund att modifiera.",
    cone        = "Kon 6 / 1222°C",
    color       = "Vit",
    surface     = "Gloss",
    firing_type = "Oxidation",
    notes       = "Klassisk 'Pete Pinnell' vit. Fungerar på stengods och porslin. Tillägg: +10% Zircopax för opak vit.",
    ingredients_raw = [
        ("Kaliumfältspat",              25),
        ("Whiting (kalciumkarbonat)",   20),
        ("Kaolin (EPK)",                20),
        ("Kvarts",                      25),
        ("Dolomit",                     10),
    ],
)

recipe(
    name        = "Celadon Ljusgrön",
    description = "Klassisk celadon-glasyr. Bäst i reduktion men fungerar i oxidation med järnoxid.",
    cone        = "Kon 6 / 1222°C",
    color       = "Ljusgrön / grå-grön",
    surface     = "Gloss",
    firing_type = "Reduktion",
    notes       = "I reduktion → kallt grå-grön celadon. I oxidation → varm amber-grön. Tjocklek påverkar mycket.",
    ingredients_raw = [
        ("Kaliumfältspat",              30),
        ("Whiting (kalciumkarbonat)",   20),
        ("Kvarts",                      30),
        ("Kaolin (EPK)",                15),
        ("Järnoxid (röd)",               5),
    ],
)

recipe(
    name        = "Koboltblå Satin",
    description = "Djupblå satinmatt glasyr. Vacker på strukturerade ytor.",
    cone        = "Kon 6 / 1222°C",
    color       = "Djupblå",
    surface     = "Satin",
    firing_type = "Oxidation",
    notes       = "Kobolthalten kan justeras: 0.5% = ljusblå, 2% = djupblå, 3%+ = svartblå.",
    ingredients_raw = [
        ("Kaliumfältspat",              25),
        ("Nefelin syenit",              10),
        ("Whiting (kalciumkarbonat)",   20),
        ("Dolomit",                     10),
        ("Kaolin (EPK)",                15),
        ("Kvarts",                      18),
        ("Koboltkarbonat",               2),
    ],
)

recipe(
    name        = "Temmoku (Järnsvart)",
    description = "Klassisk kinesisk högjärns-glasyr. Svart med bruna reflexer.",
    cone        = "Kon 10 / 1300°C",
    color       = "Svart med brun kant",
    surface     = "Gloss",
    firing_type = "Reduktion",
    notes       = "Tunnt applicerad → rödbrunt. Tjockt applicerad → blåsvart. Klassisk på skålar och koppar.",
    ingredients_raw = [
        ("Kaliumfältspat",              40),
        ("Whiting (kalciumkarbonat)",   10),
        ("Kaolin (EPK)",                10),
        ("Kvarts",                      30),
        ("Järnoxid (röd)",              10),
    ],
)

recipe(
    name        = "Opak Vit (Zirkon)",
    description = "Ren opak vit. Tät, jämn yta. Bra för funktionell keramik.",
    cone        = "Kon 6 / 1222°C",
    color       = "Krita-vit",
    surface     = "Gloss",
    firing_type = "Oxidation",
    notes       = "Tinn-vit utan tenn. Zirkoniumsilikat ger hög opacitet. Bra för lergods som ska målas med underglasr.",
    ingredients_raw = [
        ("Frit 3134",                   25),
        ("Kaliumfältspat",              20),
        ("Whiting (kalciumkarbonat)",   15),
        ("Kaolin (EPK)",                10),
        ("Kvarts",                      20),
        ("Zirkoniumsilikat (Zircopax)", 10),
    ],
)

recipe(
    name        = "Rutyl Matt Beige",
    description = "Varm beige-gul matt glasyr med rörelse. Populär studio-glasyr.",
    cone        = "Kon 6 / 1222°C",
    color       = "Beige / gulbrun med textur",
    surface     = "Matte",
    firing_type = "Oxidation",
    notes       = "Rutylet skapar karakteristisk streakad rörelse. Kylningshastigheten påverkar texturen.",
    ingredients_raw = [
        ("Nefelin syenit",              30),
        ("Whiting (kalciumkarbonat)",   20),
        ("Dolomit",                     10),
        ("Kaolin (EPK)",                15),
        ("Kvarts",                      15),
        ("Rutyl",                       10),
    ],
)

recipe(
    name        = "Koppargrön Transparens",
    description = "Klar grön glasyr. Visar lergodsets textur.",
    cone        = "Kon 6 / 1222°C",
    color       = "Transparent grön",
    surface     = "Gloss",
    firing_type = "Oxidation",
    notes       = "Transparent bas med koppargrönt. Lägg ovanpå engobe eller texturerat gods för bäst effekt.",
    ingredients_raw = [
        ("Kaliumfältspat",              30),
        ("Whiting (kalciumkarbonat)",   20),
        ("Kaolin (EPK)",                10),
        ("Kvarts",                      35),
        ("Kopparkarbonat",               3),
        ("Kaolin (EPK)",                 2),
    ],
)

recipe(
    name        = "Shino (Vit Reduktion)",
    description = "Klassisk japansk Shino-glasyr. Tjock, vit med orange eldmärken.",
    cone        = "Kon 10 / 1300°C",
    color       = "Vit med orange/röda fläckar",
    surface     = "Matte",
    firing_type = "Reduktion",
    notes       = "Appliceras tjockt (2–3 lager). Eldmärken uppstår vid reduktionskylning. Klassisk på muggar och fat.",
    ingredients_raw = [
        ("Nefelin syenit",              75),
        ("Kaolin (EPK)",                25),
    ],
)

recipe(
    name        = "Lavendel (Mangan-Kobolt)",
    description = "Mjukt lila-lavendel. Kombinerar mangan och kobolt.",
    cone        = "Kon 6 / 1222°C",
    color       = "Lavendel / lila",
    surface     = "Satin",
    firing_type = "Oxidation",
    notes       = "Känslig för glasyrens tjocklek — tunnt ger ljuslila, tjockt ger djupare lila-grå.",
    ingredients_raw = [
        ("Kaliumfältspat",              25),
        ("Whiting (kalciumkarbonat)",   20),
        ("Dolomit",                      5),
        ("Kaolin (EPK)",                15),
        ("Kvarts",                      30),
        ("Mangankarbonat",               3),
        ("Koboltkarbonat",               1),
        ("Zirkoniumsilikat (Zircopax)",  1),
    ],
)

recipe(
    name        = "Svart Matt (Järn-Kobolt)",
    description = "Djup mattsvart glasyr. Klassisk modern studio-glasyr.",
    cone        = "Kon 6 / 1222°C",
    color       = "Mattsvart",
    surface     = "Matte",
    firing_type = "Oxidation",
    notes       = "Kombinationen järn + kobolt + mangan ger djupt svart. Fungerar som kontrast till ljusa glasyrrecept.",
    ingredients_raw = [
        ("Kaliumfältspat",              25),
        ("Whiting (kalciumkarbonat)",   20),
        ("Dolomit",                     10),
        ("Kaolin (EPK)",                15),
        ("Kvarts",                      20),
        ("Järnoxid (röd)",               8),
        ("Koboltkarbonat",               2),
    ],
)

print("\n✅ Klart! Öppna Elements och Recipes i KilnOS för att se all data.\n")
EOF
