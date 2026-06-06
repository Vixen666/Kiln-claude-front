"""Computes target temperature at any elapsed minute from a list of segments."""
import logging

log = logging.getLogger(__name__)


class FiringCurve:
    def __init__(self, segments: list):
        # Sort by position
        self.segments = sorted(segments, key=lambda s: s.position)

        # Precompute cumulative start time for each segment
        self._starts = []
        t = 0.0
        for s in self.segments:
            self._starts.append(t)
            t += s.duration_minutes + (s.hold_minutes or 0.0)
        self.total_minutes = t

        log.info("FiringCurve: %d segments, %.1f min total (%.1fh)",
                 len(self.segments), self.total_minutes, self.total_minutes / 60)

    def target_at(self, elapsed: float) -> tuple:
        """
        Returns (target_temp °C, segment_index, segment_changed: bool).
        segment_changed is True only on the first call after crossing a boundary.
        """
        if not self.segments:
            return 20.0, 0, False

        if elapsed >= self.total_minutes:
            return self.segments[-1].end_temp, len(self.segments) - 1, False

        for idx, (seg, start) in enumerate(zip(self.segments, self._starts)):
            end = start + seg.duration_minutes + (seg.hold_minutes or 0.0)
            if elapsed < end:
                local = elapsed - start
                if local <= seg.duration_minutes and seg.duration_minutes > 0:
                    frac   = local / seg.duration_minutes
                    target = seg.start_temp + (seg.end_temp - seg.start_temp) * frac
                else:
                    target = seg.end_temp
                return target, idx, False

        return self.segments[-1].end_temp, len(self.segments) - 1, False

    def is_complete(self, elapsed: float) -> bool:
        return elapsed >= self.total_minutes
