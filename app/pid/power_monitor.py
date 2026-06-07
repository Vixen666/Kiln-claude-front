"""
power_monitor.py — Monitors mains power via a GPIO input pin.

Wiring:
  Mains present  → optocoupler output → GPIO pin HIGH (3.3V)
  Mains absent   → optocoupler output → GPIO pin LOW  (0V)

The pin is set up with a pull-down resistor so an open circuit
(disconnected wire) reads as LOW = power failure, which is the safe default.

Usage:
    mon = PowerMonitor(pin_bcm=27)
    if mon.power_ok():
        ...
"""

import time
import logging

log = logging.getLogger(__name__)


class PowerMonitor:
    def __init__(self, pin_bcm: int):
        self.pin   = pin_bcm
        self._real = False
        self._GPIO = None

        try:
            import RPi.GPIO as GPIO
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            # Pull-down: pin floats LOW if nothing connected = safe default
            GPIO.setup(pin_bcm, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
            self._GPIO = GPIO
            self._real = True
            log.info("PowerMonitor on GPIO%d (HIGH=power OK, pull-down)", pin_bcm)
        except Exception as e:
            log.warning("PowerMonitor GPIO unavailable (%s) — assuming power OK", e)

    def power_ok(self) -> bool:
        """Returns True if mains power is detected."""
        if not self._real or not self._GPIO:
            return True  # no hardware — assume OK
        return self._GPIO.input(self.pin) == self._GPIO.HIGH

    def cleanup(self):
        if self._real and self._GPIO:
            try:
                self._GPIO.cleanup(self.pin)
            except Exception:
                pass


class NoPowerMonitor:
    """Stub used when pin_power is not configured."""
    def power_ok(self) -> bool:
        return True
    def cleanup(self):
        pass
