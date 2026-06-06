"""PID controller with anti-windup and derivative-on-measurement."""
import time
import logging

log = logging.getLogger(__name__)


class PID:
    def __init__(self, kp, ki, kd, cycle_time,
                 output_min=0.0, output_max=1.0):
        self.kp         = kp
        self.ki         = ki
        self.kd         = kd
        self.cycle_time = cycle_time
        self.out_min    = output_min
        self.out_max    = output_max

        # Anti-windup limit — integral alone can't saturate the output
        self._windup    = (output_max - output_min) / max(ki, 1e-9)
        self._integral  = 0.0
        self._last_err  = None
        self._last_t    = None

        self.p_term = self.i_term = self.d_term = 0.0

    def reset(self):
        self._integral = 0.0
        self._last_err = None
        self._last_t   = None
        self.p_term = self.i_term = self.d_term = 0.0

    def compute(self, setpoint: float, measured: float) -> float:
        now   = time.monotonic()
        error = setpoint - measured
        dt    = (now - self._last_t) if self._last_t else self.cycle_time
        dt    = max(dt, 1e-6)

        self.p_term     = self.kp * error
        self._integral  = max(-self._windup,
                              min(self._windup, self._integral + error * dt))
        self.i_term     = self.ki * self._integral
        self.d_term     = self.kd * ((error - self._last_err) / dt) \
                          if self._last_err is not None else 0.0

        output = max(self.out_min,
                     min(self.out_max, self.p_term + self.i_term + self.d_term))

        self._last_err = error
        self._last_t   = now
        return output
