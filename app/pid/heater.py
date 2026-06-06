"""
GPIO heater relay control using time-proportioning.
Cycle time is read from kiln.control_interval_ms.
"""
import time
import logging

log = logging.getLogger(__name__)


class Heater:
    def __init__(self, pin_bcm: int, cycle_time: float, max_duty: float = 1.0):
        self.pin        = pin_bcm
        self.cycle_time = cycle_time
        self.max_duty   = max(0.0, min(1.0, max_duty))
        self._duty      = 0.0
        self._real      = False

        try:
            import RPi.GPIO as GPIO
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            GPIO.setup(pin_bcm, GPIO.OUT, initial=GPIO.LOW)
            self._GPIO = GPIO
            self._real = True
            log.info("Heater GPIO%d ready — cycle=%.2fs max_duty=%.0f%%",
                     pin_bcm, cycle_time, max_duty * 100)
        except Exception as e:
            log.warning("GPIO unavailable (%s) — heater in mock mode", e)
            self._GPIO = None

    def set_duty(self, duty: float):
        """Apply duty cycle for one full cycle. Blocks for cycle_time seconds."""
        duty = max(0.0, min(self.max_duty, duty))
        self._duty = duty

        on_time  = duty * self.cycle_time
        off_time = self.cycle_time - on_time

        if on_time > 0.001:
            self._pin(True)
            time.sleep(on_time)
        if off_time > 0.001:
            self._pin(False)
            time.sleep(off_time)

    def off(self):
        self._duty = 0.0
        self._pin(False)
        log.info("Heater GPIO%d OFF", self.pin)

    def cleanup(self):
        self.off()
        if self._real and self._GPIO:
            try:
                self._GPIO.cleanup(self.pin)
            except Exception:
                pass

    def _pin(self, state: bool):
        if self._real and self._GPIO:
            self._GPIO.output(self.pin,
                              self._GPIO.HIGH if state else self._GPIO.LOW)

    @property
    def duty(self) -> float:
        return self._duty
