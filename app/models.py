from sqlalchemy import (
    Column, Integer, Float, String, Boolean, DateTime,
    ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class BurnStatus(str, enum.Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    ABORTED   = "aborted"


class Kiln(Base):
    __tablename__ = "kilns"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False, unique=True)
    description = Column(Text, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # PID tuning
    pid_kp      = Column(Float, default=1.0)
    pid_ki      = Column(Float, default=0.1)
    pid_kd      = Column(Float, default=0.05)

    # Temperature limits (Celsius)
    temp_min    = Column(Float, default=0.0)
    temp_max    = Column(Float, default=1300.0)

    # Raspberry Pi GPIO pins
    pin_heater  = Column(Integer, default=17)   # BCM pin for primary SSR
    pin_safety  = Column(Integer, nullable=True)  # BCM pin for failsafe SSR (normally HIGH, cuts on cutoff)
    pin_sensor  = Column(Integer, default=8)    # BCM pin for thermocouple CS
    pin_fan     = Column(Integer, nullable=True)  # optional cooling fan

    # Sensor config
    sensor_type     = Column(String, default="MAX31856")  # MAX31856 | MAX31855 | MOCK
    tc_type         = Column(String, default="K")          # K J N R S T E B thermocouple type
    sensor_offset   = Column(Float, default=0.0)           # calibration offset °C

    # Control
    control_interval_ms  = Column(Integer, default=1000)  # PID loop interval
    pwm_frequency        = Column(Integer, default=50)    # Hz
    max_duty_cycle       = Column(Float, default=100.0)   # % max power

    # PID control window (bang-bang assist)
    # If temp is more than pid_window_below °C BELOW setpoint → full power
    # If temp is more than pid_window_above °C ABOVE setpoint → zero power
    # Within the window → normal PID
    pid_window_below = Column(Float, default=0.0)   # 0 = disabled
    pid_window_above = Column(Float, default=0.0)   # 0 = disabled

    # Safety
    safety_cutoff_temp  = Column(Float, default=1350.0)   # hard cutoff °C
    watchdog_timeout_s  = Column(Integer, default=30)     # seconds

    # Logging
    log_level = Column(String, default="INFO")  # OFF ERROR WARNING INFO DEBUG

    burns    = relationship("Burn", back_populates="kiln")


class Template(Base):
    __tablename__ = "templates"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False, unique=True)
    description = Column(Text, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Metadata
    target_material = Column(String, default="")   # e.g. "Stoneware", "Porcelain"
    cone            = Column(String, default="")   # e.g. "Cone 6", "1000°C"
    notes           = Column(Text, default="")

    segments = relationship("TemplateCurveSegment", back_populates="template",
                            order_by="TemplateCurveSegment.position",
                            cascade="all, delete-orphan")
    burns    = relationship("Burn", back_populates="template")


class TemplateCurveSegment(Base):
    """
    One segment of a firing curve.
    Ramp: linear climb/descent from start_temp to end_temp over duration_minutes.
    Hold: flat soak at end_temp for hold_minutes.
    """
    __tablename__ = "template_curve_segments"

    id               = Column(Integer, primary_key=True, index=True)
    template_id      = Column(Integer, ForeignKey("templates.id"), nullable=False)
    position         = Column(Integer, nullable=False)   # ordering index
    label            = Column(String, default="")        # e.g. "Initial ramp", "Quartz inversion hold"

    segment_type     = Column(String, default="ramp")    # "ramp" | "hold"

    start_temp       = Column(Float, nullable=False)     # °C
    end_temp         = Column(Float, nullable=False)     # °C
    duration_minutes = Column(Float, nullable=False)     # ramp duration
    hold_minutes        = Column(Float, default=0.0)      # soak time at end_temp
    notify_on_complete  = Column(Boolean, default=False)  # send notification when segment finishes

    template = relationship("Template", back_populates="segments")


class Burn(Base):
    __tablename__ = "burns"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    kiln_id     = Column(Integer, ForeignKey("kilns.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)

    status      = Column(Enum(BurnStatus), default=BurnStatus.PENDING)
    notes       = Column(Text, default="")

    started_at   = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    # Power loss recovery
    resume_on_power_loss      = Column(Boolean, default=False)
    resume_timeout_minutes    = Column(Integer, default=30)  # abort if down longer

    # Snapshot of PID values at time of burn (in case kiln config changes later)
    pid_kp_used  = Column(Float, nullable=True)
    pid_ki_used  = Column(Float, nullable=True)
    pid_kd_used  = Column(Float, nullable=True)

    kiln     = relationship("Kiln",     back_populates="burns")
    template = relationship("Template", back_populates="burns")
    logs     = relationship("BurnLog",  back_populates="burn",
                            order_by="BurnLog.timestamp",
                            cascade="all, delete-orphan")
    recipes  = relationship("BurnRecipe", back_populates="burn",
                            cascade="all, delete-orphan")
    temp_alerts = relationship("BurnTempAlert", back_populates="burn",
                               order_by="BurnTempAlert.temperature",
                               cascade="all, delete-orphan")
    comments    = relationship("BurnComment", back_populates="burn",
                               order_by="BurnComment.created_at",
                               cascade="all, delete-orphan")
    photos      = relationship("Photo", back_populates="burn",
                               order_by="Photo.created_at",
                               cascade="all, delete-orphan")


# ── Element (raw glaze material) ──────────────────────────────────────────────

class Element(Base):
    __tablename__ = "elements"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False, unique=True)
    description = Column(Text, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Chemical / material info
    chemical_formula = Column(String, default="")   # e.g. SiO2
    supplier         = Column(String, default="")
    location         = Column(String, default="")   # shelf / bin / room

    # Stock
    stock_amount  = Column(Float, default=0.0)      # grams
    stock_unit    = Column(String, default="g")     # g | kg | lb
    reorder_level = Column(Float, default=0.0)      # alert threshold

    # Notes
    notes = Column(Text, default="")

    recipe_ingredients = relationship("RecipeIngredient", back_populates="element")


# ── Recipe ─────────────────────────────────────────────────────────────────────

class Recipe(Base):
    __tablename__ = "recipes"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False, unique=True)
    description = Column(Text, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Glaze metadata
    cone          = Column(String, default="")       # e.g. Cone 6
    color         = Column(String, default="")       # expected fired color
    surface       = Column(String, default="")       # matte / satin / gloss
    firing_type   = Column(String, default="")       # oxidation / reduction
    notes         = Column(Text, default="")

    ingredients = relationship("RecipeIngredient", back_populates="recipe",
                               cascade="all, delete-orphan")
    burns       = relationship("BurnRecipe", back_populates="recipe",
                               cascade="all, delete-orphan")
    photos      = relationship("Photo", back_populates="recipe",
                               order_by="Photo.created_at")


class RecipeIngredient(Base):
    """One material line in a glaze recipe — amount in grams (100g batch basis)."""
    __tablename__ = "recipe_ingredients"

    id         = Column(Integer, primary_key=True, index=True)
    recipe_id  = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    element_id = Column(Integer, ForeignKey("elements.id"), nullable=False)
    amount     = Column(Float, nullable=False)   # grams in 100g batch
    notes      = Column(String, default="")

    recipe  = relationship("Recipe",  back_populates="ingredients")
    element = relationship("Element", back_populates="recipe_ingredients")


# ── BurnRecipe (many-to-many Burn ↔ Recipe) ────────────────────────────────────

class BurnRecipe(Base):
    __tablename__ = "burn_recipes"

    id        = Column(Integer, primary_key=True, index=True)
    burn_id   = Column(Integer, ForeignKey("burns.id"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    notes     = Column(String, default="")   # e.g. "applied on interior"

    burn   = relationship("Burn",   back_populates="recipes")
    recipe = relationship("Recipe", back_populates="burns")


class BurnLog(Base):
    """Time-series log entries written by the PID controller during a burn."""
    __tablename__ = "burn_logs"

    id              = Column(Integer, primary_key=True, index=True)
    burn_id         = Column(Integer, ForeignKey("burns.id"), nullable=False)
    timestamp       = Column(DateTime, default=datetime.utcnow, index=True)
    elapsed_minutes = Column(Float, nullable=False)

    actual_temp     = Column(Float, nullable=False)    # °C measured
    target_temp     = Column(Float, nullable=False)    # °C setpoint at this moment
    duty_cycle      = Column(Float, nullable=False)    # 0–100 %
    pid_p           = Column(Float, default=0.0)
    pid_i           = Column(Float, default=0.0)
    pid_d           = Column(Float, default=0.0)
    event           = Column(String, nullable=True)    # e.g. "segment_change", "hold_start"

    burn = relationship("Burn", back_populates="logs")


# ── Settings (single-row config table) ────────────────────────────────────────

class Settings(Base):
    __tablename__ = "settings"

    id  = Column(Integer, primary_key=True, default=1)

    # Discord
    discord_enabled        = Column(Boolean, default=False)
    discord_webhook_url    = Column(String, default="")

    # Email via Resend
    resend_enabled         = Column(Boolean, default=False)
    resend_api_key         = Column(String, default="")
    resend_from_email      = Column(String, default="kiln@yourdomain.com")
    resend_to_email        = Column(String, default="")

    # Ntfy.sh push notifications
    ntfy_enabled           = Column(Boolean, default=False)
    ntfy_topic             = Column(String, default="")   # e.g. "my-kiln-alerts"
    ntfy_server            = Column(String, default="https://ntfy.sh")  # or self-hosted


# ── BurnTempAlert ──────────────────────────────────────────────────────────────

class BurnTempAlert(Base):
    """
    A one-shot temperature alert attached to a specific burn.

    direction:    "rising"  — fires when actual_temp crosses temp going up
                  "falling" — fires when actual_temp crosses temp going down

    segment_index: optional — if set, only triggers while the burn is in that
                   segment (0-based). Lets you set "1000°C rising in seg 1"
                   and "1000°C falling in seg 4" as separate alerts.

    fired:        set to True once triggered so it never fires again.
    """
    __tablename__ = "burn_temp_alerts"

    id            = Column(Integer, primary_key=True, index=True)
    burn_id       = Column(Integer, ForeignKey("burns.id"), nullable=False)

    temperature   = Column(Float, nullable=False)        # °C threshold
    direction     = Column(String, default="rising")     # "rising" | "falling"
    segment_index = Column(Integer, nullable=True)       # None = any segment
    label         = Column(String, default="")           # custom message
    fired         = Column(Boolean, default=False)       # True once triggered
    fired_at      = Column(DateTime, nullable=True)

    burn = relationship("Burn", back_populates="temp_alerts")


# ── BurnComment ────────────────────────────────────────────────────────────────

class BurnComment(Base):
    """
    A timestamped note posted during or after a burn.
    elapsed_minutes links it to a point on the chart — shown as a marker.
    """
    __tablename__ = "burn_comments"

    id              = Column(Integer, primary_key=True, index=True)
    burn_id         = Column(Integer, ForeignKey("burns.id"), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)
    elapsed_minutes = Column(Float, nullable=True)   # None = not linked to a time
    text            = Column(Text, nullable=False)
    author          = Column(String, default="")     # optional name

    burn = relationship("Burn", back_populates="comments")


# ── Photo ──────────────────────────────────────────────────────────────────────

class Photo(Base):
    """
    A photo attached to a burn and/or a recipe.
    Tags are stored as a comma-separated string for simplicity.
    File is stored on the local filesystem; filename is the UUID-based name.
    """
    __tablename__ = "photos"

    id          = Column(Integer, primary_key=True, index=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    filename    = Column(String, nullable=False)   # stored filename (uuid.ext)
    original    = Column(String, default="")       # original upload filename
    mimetype    = Column(String, default="")       # image/jpeg etc.

    title       = Column(String, default="")
    notes       = Column(Text,   default="")
    tags        = Column(String, default="")       # comma-separated, e.g. "mug,blue,cone6"

    # Optional links
    burn_id     = Column(Integer, ForeignKey("burns.id"),   nullable=True)
    recipe_id   = Column(Integer, ForeignKey("recipes.id"), nullable=True)

    burn   = relationship("Burn",   back_populates="photos")
    recipe = relationship("Recipe", back_populates="photos")


# ── SystemLog ──────────────────────────────────────────────────────────────────

class SystemLog(Base):
    """
    Persisted log entries from the Python logging system.
    Written by DBLogHandler — captures all log.info/warning/error calls
    from the PID controller and other modules.
    """
    __tablename__ = "system_logs"

    id         = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    level      = Column(String, nullable=False)   # DEBUG INFO WARNING ERROR CRITICAL
    logger     = Column(String, default="")       # e.g. "controller", "thermocouple"
    message    = Column(Text,   nullable=False)
    burn_id    = Column(Integer, ForeignKey("burns.id"), nullable=True)
