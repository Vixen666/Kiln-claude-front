from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import BurnStatus


# ─── Kiln ────────────────────────────────────────────────────────────────────

class KilnBase(BaseModel):
    name: str
    description: str = ""

    pid_kp: float = 1.0
    pid_ki: float = 0.1
    pid_kd: float = 0.05

    temp_min: float = 0.0
    temp_max: float = 1300.0

    pin_heater: int = 17
    pin_sensor: int = 4
    pin_fan: Optional[int] = None

    sensor_type: str = "DS18B20"
    sensor_offset: float = 0.0

    control_interval_ms: int = 1000
    pwm_frequency: int = 50
    max_duty_cycle: float = 100.0

    safety_cutoff_temp: float = 1350.0
    watchdog_timeout_s: int = 30


class KilnCreate(KilnBase):
    pass


class KilnUpdate(KilnBase):
    name: Optional[str] = None


class KilnOut(KilnBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Template Curve Segment ───────────────────────────────────────────────────

class SegmentBase(BaseModel):
    position: int
    label: str = ""
    segment_type: str = "ramp"       # "ramp" | "hold"
    start_temp: float
    end_temp: float
    duration_minutes: float
    hold_minutes: float = 0.0
    notify_on_complete: bool = False


class SegmentCreate(SegmentBase):
    pass


class SegmentOut(SegmentBase):
    id: int
    template_id: int

    class Config:
        from_attributes = True


# ─── Template ─────────────────────────────────────────────────────────────────

class TemplateBase(BaseModel):
    name: str
    description: str = ""
    target_material: str = ""
    cone: str = ""
    notes: str = ""


class TemplateCreate(TemplateBase):
    segments: List[SegmentCreate] = []


class TemplateUpdate(TemplateBase):
    name: Optional[str] = None
    segments: Optional[List[SegmentCreate]] = None


class TemplateOut(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    segments: List[SegmentOut] = []

    class Config:
        from_attributes = True


# ─── Burn Log ─────────────────────────────────────────────────────────────────

class BurnLogCreate(BaseModel):
    elapsed_minutes: float
    actual_temp: float
    target_temp: float
    duty_cycle: float
    pid_p: float = 0.0
    pid_i: float = 0.0
    pid_d: float = 0.0
    event: Optional[str] = None


class BurnLogOut(BurnLogCreate):
    id: int
    burn_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


# ─── Burn ─────────────────────────────────────────────────────────────────────

class BurnBase(BaseModel):
    name: str
    kiln_id: int
    template_id: int
    notes: str = ""


class BurnCreate(BurnBase):
    pass


class BurnUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[BurnStatus] = None


class BurnOut(BurnBase):
    id: int
    status: BurnStatus
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    pid_kp_used: Optional[float]
    pid_ki_used: Optional[float]
    pid_kd_used: Optional[float]
    kiln: KilnOut
    template: TemplateOut
    recipes: List["BurnRecipeOut"] = []
    temp_alerts: List["BurnTempAlertOut"] = []
    comments: List["BurnCommentOut"] = []

    class Config:
        from_attributes = True


class BurnSummaryOut(BurnBase):
    id: int
    status: BurnStatus
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    kiln: KilnOut
    template: TemplateOut
    recipes: List["BurnRecipeOut"] = []

    class Config:
        from_attributes = True

# ─── Element ──────────────────────────────────────────────────────────────────

class ElementBase(BaseModel):
    name: str
    description: str = ""
    chemical_formula: str = ""
    supplier: str = ""
    location: str = ""
    stock_amount: float = 0.0
    stock_unit: str = "g"
    reorder_level: float = 0.0
    notes: str = ""

class ElementCreate(ElementBase):
    pass

class ElementUpdate(ElementBase):
    name: Optional[str] = None

class ElementOut(ElementBase):
    id: int
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Recipe Ingredient ────────────────────────────────────────────────────────

class RecipeIngredientBase(BaseModel):
    element_id: int
    amount: float
    notes: str = ""

class RecipeIngredientCreate(RecipeIngredientBase):
    pass

class RecipeIngredientOut(RecipeIngredientBase):
    id: int
    recipe_id: int
    element: ElementOut
    class Config:
        from_attributes = True

# ─── Recipe ───────────────────────────────────────────────────────────────────

class RecipeBase(BaseModel):
    name: str
    description: str = ""
    cone: str = ""
    color: str = ""
    surface: str = ""
    firing_type: str = ""
    notes: str = ""

class RecipeCreate(RecipeBase):
    ingredients: List[RecipeIngredientCreate] = []

class RecipeUpdate(RecipeBase):
    name: Optional[str] = None
    ingredients: Optional[List[RecipeIngredientCreate]] = None

class RecipeOut(RecipeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    ingredients: List[RecipeIngredientOut] = []
    class Config:
        from_attributes = True

class RecipeSummaryOut(RecipeBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

# ─── BurnRecipe ───────────────────────────────────────────────────────────────

class BurnRecipeCreate(BaseModel):
    recipe_id: int
    notes: str = ""

class BurnRecipeOut(BaseModel):
    id: int
    burn_id: int
    recipe_id: int
    notes: str
    recipe: RecipeSummaryOut
    class Config:
        from_attributes = True

# ─── Settings ─────────────────────────────────────────────────────────────────

class SettingsBase(BaseModel):
    discord_enabled:     bool = False
    discord_webhook_url: str  = ""

    resend_enabled:      bool = False
    resend_api_key:      str  = ""
    resend_from_email:   str  = "kiln@yourdomain.com"
    resend_to_email:     str  = ""

    ntfy_enabled:        bool = False
    ntfy_topic:          str  = ""
    ntfy_server:         str  = "https://ntfy.sh"

class SettingsUpdate(SettingsBase):
    pass

class SettingsOut(SettingsBase):
    id: int
    class Config:
        from_attributes = True

# ─── BurnTempAlert ────────────────────────────────────────────────────────────

class BurnTempAlertCreate(BaseModel):
    temperature:   float
    direction:     str  = "rising"   # "rising" | "falling"
    segment_index: Optional[int] = None
    label:         str  = ""

class BurnTempAlertUpdate(BaseModel):
    temperature:   Optional[float] = None
    direction:     Optional[str]   = None
    segment_index: Optional[int]   = None
    label:         Optional[str]   = None
    fired:         Optional[bool]  = None
    fired_at:      Optional[datetime] = None

class BurnTempAlertOut(BurnTempAlertCreate):
    id:       int
    burn_id:  int
    fired:    bool
    fired_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# ─── BurnComment ──────────────────────────────────────────────────────────────

class BurnCommentCreate(BaseModel):
    text:            str
    elapsed_minutes: Optional[float] = None
    author:          str = ""

class BurnCommentUpdate(BaseModel):
    text:   Optional[str] = None
    author: Optional[str] = None

class BurnCommentOut(BaseModel):
    id:              int
    burn_id:         int
    created_at:      datetime
    elapsed_minutes: Optional[float]
    text:            str
    author:          str
    class Config:
        from_attributes = True

# ─── Photo ────────────────────────────────────────────────────────────────────

class PhotoOut(BaseModel):
    id:         int
    created_at: datetime
    filename:   str
    original:   str
    title:      str
    notes:      str
    tags:       str          # comma-separated
    burn_id:    Optional[int]
    recipe_id:  Optional[int]
    url:        str = ""     # set at response time

    class Config:
        from_attributes = True

class PhotoUpdate(BaseModel):
    title:     Optional[str] = None
    notes:     Optional[str] = None
    tags:      Optional[str] = None
    burn_id:   Optional[int] = None
    recipe_id: Optional[int] = None
