"""
GPIO heater relay control using time-proportioning.

Two SSR support:
  pin_heater  — primary SSR, switched by PID duty cycle
  pin_safety  — failsafe SSR (optional)
                Normally HIGH (conducting).
                Pulled LOW by safety_cutoff() to cut power even if
                the primary SSR fails in the closed/on state.

Wiring note:
  Primary SSR:  Pi GPIO → SSR input+, SSR output in series with element
  Failsafe SSR: Pi GPIO → SSR input+, SSR output in series with primary SSR
                (so cutting the failsafe cuts the whole circuit)
"""
import time
import logging

log = logging.getLogger(__name__)


class Heater:
    def __init__(self, pin_bcm: int, cycle_time: float,
                 max_duty: float = 1.0, pin_safety: int = None):
        self.pin        = pin_bcm
        self.pin_safety = pin_safety
        self.cycle_time = cycle_time
        self.max_duty   = max(0.0, min(1.0, max_duty))
        self._duty      = 0.0
        self._real      = False
        self._GPIO      = None

        try:
            import RPi.GPIO as GPIO
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)

            # Primary SSR — starts LOW (off)
            GPIO.setup(pin_bcm, GPIO.OUT, initial=GPIO.LOW)

            # Failsafe SSR — starts HIGH (conducting/safe)
            if pin_safety is not None:
                GPIO.setup(pin_safety, GPIO.OUT, initial=GPIO.HIGH)
                log.info("Failsafe SSR on GPIO%d (normally HIGH)", pin_safety)

            self._GPIO = GPIO
            self._real = True
            log.info("Heater GPIO%d ready — cycle=%.2fs max_duty=%.0f%%",
                     pin_bcm, cycle_time, max_duty * 100)
        except Exception as e:
            log.warning("GPIO unavailable (%s) — heater in mock mode", e)

    def set_duty(self, duty: float):
        """Apply duty cycle for one full cycle. Blocks for cycle_time seconds."""
        duty = max(0.0, min(self.max_duty, duty))
        self._duty = duty

        on_time  = duty * self.cycle_time
        off_time = self.cycle_time - on_time

        if on_time > 0.001:
            self._pin(self.pin, True)
            time.sleep(on_time)
        if off_time > 0.001:
            self._pin(self.pin, False)
            time.sleep(off_time)

    def safety_cutoff(self):
        """
        Emergency stop — cuts the failsafe SSR immediately.
        Primary SSR is also turned off.
        Call this on safety cutoff or watchdog timeout.
        """
        self._pin(self.pin, False)           # primary off
        if self.pin_safety is not None:
            self._pin(self.pin_safety, False)  # failsafe trips — cuts circuit
            log.critical("FAILSAFE SSR GPIO%d tripped (LOW)", self.pin_safety)
        self._duty = 0.0

    def off(self):
        """Normal shutdown — turn primary off, leave failsafe armed (HIGH)."""
        self._duty = 0.0
        self._pin(self.pin, False)
        log.info("Heater GPIO%d OFF", self.pin)
        # Note: failsafe stays HIGH on normal off — only trips on safety_cutoff()

    def cleanup(self):
        self.off()
        if self._real and self._GPIO:
            try:
                pins = [self.pin]
                if self.pin_safety is not None:
                    pins.append(self.pin_safety)
                self._GPIO.cleanup(pins)
            except Exception:
                pass

    def _pin(self, pin, state: bool):
        if self._real and self._GPIO:
            self._GPIO.output(pin,
                              self._GPIO.HIGH if state else self._GPIO.LOW)

    @property
    def duty(self) -> float:
        return self._duty
