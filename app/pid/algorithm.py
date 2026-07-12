"""PID controller — ported from the old kiln-controller's proven implementation.

Computes P/I/D on a wide internal window (±100) and normalizes down to the
actual output range at the end, instead of computing directly in 0-1. With
small gains and a 0-1 window, almost any real-world error pushes the raw
sum straight past the clamp, producing near-binary on/off behaviour — the
wide window avoids that.

Note the Ki convention is inverted from the textbook definition: the
integral term accumulates error * dt / ki (division, not multiplication),
so a SMALLER Ki means STRONGER integral action. Expect Kp/Ki/Kd values in
the tens, not fractions of 1 — tunings from the previous implementation of
this class do not carry over numerically.
"""
import time
import logging

log = logging.getLogger(__name__)

_WINDOW = 100.0


class PID:
    def __init__(self, kp, ki, kd, cycle_time,
                 output_min=0.0, output_max=1.0):
        self.kp         = kp
        self.ki         = ki
        self.kd         = kd
        self.cycle_time = cycle_time
        self.out_min    = output_min
        self.out_max    = output_max

        self._iterm     = 0.0
        self._last_err  = 0.0
        self._last_t    = None

        self.p_term = self.i_term = self.d_term = 0.0

    def reset(self):
        self._iterm    = 0.0
        self._last_err = 0.0
        self._last_t   = None
        self.p_term = self.i_term = self.d_term = 0.0

    def compute(self, setpoint: float, measured: float) -> float:
        now   = time.monotonic()
        dt    = (now - self._last_t) if self._last_t else self.cycle_time
        dt    = max(dt, 1e-6)

        error = setpoint - measured

        if self.ki:
            self._iterm += error * dt * (1.0 / self.ki)

        self.p_term = self.kp * error
        self.i_term = self._iterm
        self.d_term = self.kd * ((error - self._last_err) / dt)

        raw    = max(-_WINDOW, min(_WINDOW, self.p_term + self.i_term + self.d_term))
        output = max(self.out_min, min(self.out_max, raw / _WINDOW))

        self._last_err = error
        self._last_t   = now
        return output
