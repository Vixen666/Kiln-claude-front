"""
Thermocouple sensor abstraction.
Sensor type is read from the Kiln model (sensor_type + tc_type fields).
"""
import logging
import time
import random

log = logging.getLogger(__name__)


class ThermocoupleError(Exception):
    pass


class MAX31856Sensor:
    """Adafruit MAX31856 via SPI (blinka/CircuitPython)."""

    def __init__(self, cs_pin_bcm: int, tc_type: str = "K", offset: float = 0.0):
        import board
        import busio
        import digitalio
        import adafruit_max31856

        TC = {
            "B": adafruit_max31856.ThermocoupleType.B,
            "E": adafruit_max31856.ThermocoupleType.E,
            "J": adafruit_max31856.ThermocoupleType.J,
            "K": adafruit_max31856.ThermocoupleType.K,
            "N": adafruit_max31856.ThermocoupleType.N,
            "R": adafruit_max31856.ThermocoupleType.R,
            "S": adafruit_max31856.ThermocoupleType.S,
            "T": adafruit_max31856.ThermocoupleType.T,
        }
        spi     = busio.SPI(board.SCK, board.MOSI, board.MISO)
        cs      = digitalio.DigitalInOut(getattr(board, f"D{cs_pin_bcm}"))
        tc      = TC.get(tc_type.upper(), adafruit_max31856.ThermocoupleType.K)
        self._s = adafruit_max31856.MAX31856(spi, cs, thermocouple_type=tc)
        self._offset = offset
        log.info("MAX31856 ready — CS=GPIO%d type=%s offset=%.1f°C",
                 cs_pin_bcm, tc_type, offset)

    def read(self) -> float:
        try:
            fault = self._s.fault
            if any(fault.values()):
                raise ThermocoupleError(
                    f"Faults: {[k for k,v in fault.items() if v]}")
            return round(self._s.temperature + self._offset, 2)
        except ThermocoupleError:
            raise
        except Exception as e:
            raise ThermocoupleError(str(e)) from e


class MAX31855Sensor:
    """Adafruit MAX31855 (K-type only) via SPI."""

    def __init__(self, cs_pin_bcm: int, offset: float = 0.0):
        import board, busio, digitalio, adafruit_max31855
        spi     = busio.SPI(board.SCK, board.MOSI, board.MISO)
        cs      = digitalio.DigitalInOut(getattr(board, f"D{cs_pin_bcm}"))
        self._s = adafruit_max31855.MAX31855(spi, cs)
        self._offset = offset
        log.info("MAX31855 ready — CS=GPIO%d offset=%.1f°C", cs_pin_bcm, offset)

    def read(self) -> float:
        try:
            return round(self._s.temperature + self._offset, 2)
        except Exception as e:
            raise ThermocoupleError(str(e)) from e


class MockSensor:
    """Simulates kiln heating — responds to set_duty() for realistic behaviour."""

    def __init__(self, offset: float = 0.0):
        self._temp   = 20.0
        self._duty   = 0.0
        self._last_t = time.monotonic()
        self._offset = offset
        log.warning("MockSensor active — no hardware")

    def set_duty(self, duty: float):
        self._duty = duty

    def read(self) -> float:
        now  = time.monotonic()
        dt   = now - self._last_t
        self._last_t = now
        heating = self._duty * 15.0 * (dt / 60.0)
        cooling = (self._temp - 20.0) * 0.003 * dt
        self._temp += heating - cooling + random.gauss(0, 0.3)
        self._temp  = max(18.0, self._temp)
        return round(self._temp + self._offset, 2)


def make_sensor(sensor_type: str, cs_pin_bcm: int,
                tc_type: str = "K", offset: float = 0.0):
    st = sensor_type.upper()
    try:
        if st == "MAX31856":
            return MAX31856Sensor(cs_pin_bcm, tc_type, offset)
        elif st == "MAX31855":
            return MAX31855Sensor(cs_pin_bcm, offset)
        else:
            log.warning("Unknown sensor '%s' — using mock", sensor_type)
            return MockSensor(offset)
    except Exception as e:
        log.error("Sensor init failed (%s) — falling back to mock: %s",
                  sensor_type, e)
        return MockSensor(offset)
