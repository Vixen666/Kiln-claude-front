"""
controller.py — PID control loop integrated into the FastAPI process.

Runs in a background thread started by the /start endpoint.
Reads all config from the database directly (no HTTP overhead).
Writes log entries directly to the database.
Fires notifications through the existing notifications module.

One controller instance per active burn. Tracked in _active_controllers.
"""

import logging
import threading
import time
from datetime import datetime

from app.database     import SessionLocal
from app.models       import Burn, BurnLog, BurnStatus, Settings
from app.notifications import send_notifications
from app.pid.algorithm    import PID
from app.pid.curve        import FiringCurve
from app.pid.heater       import Heater
from app.pid.thermocouple import make_sensor, ThermocoupleError

log = logging.getLogger(__name__)

# Track running controllers by burn_id so we can abort them
_active_controllers: dict[int, "KilnController"] = {}
_lock = threading.Lock()


def start_controller(burn_id: int):
    """
    Start the PID controller for a burn in a background thread.
    Called from the /start endpoint after the burn is marked RUNNING.
    """
    with _lock:
        if burn_id in _active_controllers:
            log.warning("Controller already running for burn %d", burn_id)
            return
        ctrl = KilnController(burn_id)
        _active_controllers[burn_id] = ctrl

    t = threading.Thread(target=ctrl.run, name=f"kiln-pid-{burn_id}", daemon=True)
    t.start()
    log.info("PID controller thread started for burn %d", burn_id)


def stop_controller(burn_id: int):
    """Signal the controller for a burn to stop (called by /abort endpoint)."""
    with _lock:
        ctrl = _active_controllers.get(burn_id)
    if ctrl:
        ctrl.stop()
        log.info("Stop signal sent to controller for burn %d", burn_id)
    else:
        log.warning("No active controller for burn %d", burn_id)


class KilnController:
    def __init__(self, burn_id: int):
        self.burn_id  = burn_id
        self._stop    = threading.Event()

    def stop(self):
        self._stop.set()

    def run(self):
        db = SessionLocal()
        heater = None
        try:
            self._run(db)
        except Exception as e:
            log.exception("Controller error for burn %d: %s", self.burn_id, e)
            self._mark_aborted(db, "controller_error")
        finally:
            if heater:
                heater.cleanup()
            db.close()
            with _lock:
                _active_controllers.pop(self.burn_id, None)
            log.info("Controller for burn %d exited", self.burn_id)

    def _run(self, db):
        # ── Load burn + kiln from DB ───────────────────────
        burn = db.get(Burn, self.burn_id)
        if not burn:
            log.error("Burn %d not found", self.burn_id)
            return

        kiln = burn.kiln
        segs = burn.template.segments

        log.info("Burn: %s | Kiln: %s | Template: %s (%d segs)",
                 burn.name, kiln.name, burn.template.name, len(segs))

        # ── Build firing curve ─────────────────────────────
        curve = FiringCurve(segs)

        # ── Read all timing from kiln config ───────────────
        cycle_time  = kiln.control_interval_ms / 1000.0   # seconds per cycle
        max_duty    = kiln.max_duty_cycle / 100.0          # 0.0–1.0
        cutoff      = kiln.safety_cutoff_temp
        watchdog_s  = kiln.watchdog_timeout_s

        log.info("Cycle: %.2fs | MaxDuty: %.0f%% | Cutoff: %.0f°C | Watchdog: %ds",
                 cycle_time, max_duty * 100, cutoff, watchdog_s)

        # ── PID ────────────────────────────────────────────
        pid = PID(
            kp         = kiln.pid_kp,
            ki         = kiln.pid_ki,
            kd         = kiln.pid_kd,
            cycle_time = cycle_time,
            output_max = max_duty,
        )
        pid.reset()

        # ── Hardware ───────────────────────────────────────
        heater = Heater(
            pin_bcm    = kiln.pin_heater,
            cycle_time = cycle_time,
            max_duty   = max_duty,
        )

        sensor = make_sensor(
            sensor_type = kiln.sensor_type,
            cs_pin_bcm  = kiln.pin_sensor,
            tc_type     = getattr(kiln, 'tc_type', 'K'),
            offset      = kiln.sensor_offset,
        )

        # ── Loop state ─────────────────────────────────────
        start_time      = time.monotonic()
        prev_seg_idx    = 0
        consec_errors   = 0
        max_errors      = max(1, watchdog_s // int(cycle_time))
        last_good_temp  = 20.0

        log.info("PID loop starting. Total: %.1f min (%.1fh)",
                 curve.total_minutes, curve.total_minutes / 60)

        # ── Main loop ──────────────────────────────────────
        while not self._stop.is_set():
            elapsed_min = (time.monotonic() - start_time) / 60.0

            # Done?
            if curve.is_complete(elapsed_min):
                log.info("Curve complete at %.1f min", elapsed_min)
                break

            # ── Read temperature ───────────────────────────
            try:
                actual_temp    = sensor.read()
                last_good_temp = actual_temp
                consec_errors  = 0
            except ThermocoupleError as e:
                consec_errors += 1
                log.error("Thermocouple error %d/%d: %s",
                          consec_errors, max_errors, e)
                if consec_errors >= max_errors:
                    log.critical("Watchdog: too many sensor errors — aborting")
                    heater.off()
                    self._mark_aborted(db, "sensor_watchdog")
                    return
                actual_temp = last_good_temp  # coast for one cycle
                time.sleep(cycle_time)
                continue

            # ── Safety cutoff ──────────────────────────────
            if actual_temp >= cutoff:
                log.critical("SAFETY CUTOFF: %.1f°C ≥ %.1f°C", actual_temp, cutoff)
                heater.off()
                self._mark_aborted(db, "safety_cutoff")
                return

            # ── Setpoint from curve ────────────────────────
            target_temp, seg_idx, _ = curve.target_at(elapsed_min)

            # ── PID compute ────────────────────────────────
            duty = pid.compute(target_temp, actual_temp)

            # Feed mock sensor if in simulation mode
            if hasattr(sensor, 'set_duty'):
                sensor.set_duty(duty)

            # ── Segment change detection ───────────────────
            event = None
            if seg_idx != prev_seg_idx:
                event = f"segment_change:{prev_seg_idx}"
                seg   = curve.segments[prev_seg_idx]
                log.info("→ Segment %d done: %s",
                         prev_seg_idx, seg.label or f"seg{prev_seg_idx}")

                # Notification if segment has notify_on_complete
                if seg.notify_on_complete:
                    settings = db.get(Settings, 1)
                    if settings:
                        send_notifications(
                            settings,
                            burn_name     = burn.name,
                            segment_label = seg.label or f"Segment {prev_seg_idx + 1}",
                            actual_temp   = actual_temp,
                            elapsed_minutes = elapsed_min,
                        )

                prev_seg_idx = seg_idx

            # ── Check temp alerts ──────────────────────────
            self._check_temp_alerts(db, burn, actual_temp,
                                    last_good_temp, elapsed_min, seg_idx)

            # ── Write log entry to DB ──────────────────────
            entry = BurnLog(
                burn_id         = self.burn_id,
                elapsed_minutes = round(elapsed_min, 4),
                actual_temp     = round(actual_temp, 2),
                target_temp     = round(target_temp, 2),
                duty_cycle      = round(duty * 100, 2),
                pid_p           = round(pid.p_term, 4),
                pid_i           = round(pid.i_term, 4),
                pid_d           = round(pid.d_term, 4),
                event           = event,
                timestamp       = datetime.utcnow(),
            )
            db.add(entry)
            db.commit()

            log.debug("%.1fmin | %.1f°C→%.1f°C | duty=%.1f%% | "
                      "P=%.3f I=%.3f D=%.3f | seg=%d",
                      elapsed_min, actual_temp, target_temp,
                      duty * 100, pid.p_term, pid.i_term, pid.d_term, seg_idx)

            # ── Drive heater (blocks for cycle_time seconds) ──
            heater.set_duty(duty)

        # ── Stop signal received ───────────────────────────
        heater.off()
        heater.cleanup()

        if self._stop.is_set():
            log.info("Stop signal received — burn will be aborted by endpoint")
        else:
            self._mark_completed(db)

    def _check_temp_alerts(self, db, burn, curr_temp,
                            prev_temp, elapsed_min, seg_idx):
        """Fire any unfired temperature threshold alerts."""
        from app.models import BurnTempAlert
        alerts = db.query(BurnTempAlert).filter(
            BurnTempAlert.burn_id == burn.id,
            BurnTempAlert.fired   == False,
        ).all()

        for alert in alerts:
            if alert.segment_index is not None and alert.segment_index != seg_idx:
                continue
            crossed = (
                (alert.direction == "rising"  and prev_temp < alert.temperature <= curr_temp) or
                (alert.direction == "falling" and prev_temp > alert.temperature >= curr_temp)
            )
            if not crossed:
                continue

            alert.fired    = True
            alert.fired_at = datetime.utcnow()
            db.commit()

            direction_word = "↑ rising" if alert.direction == "rising" else "↓ falling"
            label = alert.label or f"{alert.temperature}°C {direction_word}"
            log.info("Temp alert fired: %s", label)

            settings = db.get(Settings, 1)
            if settings:
                send_notifications(
                    settings,
                    burn_name       = burn.name,
                    segment_label   = f"Temp alert: {label}",
                    actual_temp     = curr_temp,
                    elapsed_minutes = elapsed_min,
                )

    def _mark_completed(self, db):
        burn = db.get(Burn, self.burn_id)
        if burn:
            burn.status       = BurnStatus.COMPLETED
            burn.completed_at = datetime.utcnow()
            db.commit()
            log.info("Burn %d marked COMPLETED", self.burn_id)

    def _mark_aborted(self, db, reason: str):
        burn = db.get(Burn, self.burn_id)
        if burn and burn.status == BurnStatus.RUNNING:
            burn.status       = BurnStatus.ABORTED
            burn.completed_at = datetime.utcnow()
            db.commit()
            log.warning("Burn %d marked ABORTED (%s)", self.burn_id, reason)
