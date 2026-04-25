"""
SleepNest — Synthetic Dataset Generator
Generates a balanced, realistic CSV dataset for ML training.
Fixes issues in the original export: missing motion data, broken soundHist, class imbalance.
"""

import csv
import random
import math
from datetime import datetime, timedelta

random.seed(42)

# ── Config ──────────────────────────────────────────────────────────────────
ROWS_PER_CLASS = 600          # 600 × 4 classes = 2400 rows total
START_TIME = datetime(2026, 4, 24, 0, 0, 0)
INTERVAL_SECONDS = 30
DEVICE_ID = "ESP32_GREENHOUSE_01"
OUTPUT_FILE = "sleepnest_dataset.csv"

CLASSES = ["QUIET", "LIGHT_ACTIVITY", "RESTLESS", "CRYING"]

# ── Helpers ──────────────────────────────────────────────────────────────────
def clamp(val, lo, hi):
    return max(lo, min(hi, val))

def rand_around(center, spread, lo=0, hi=1023):
    return round(clamp(random.gauss(center, spread), lo, hi), 1)

def make_temp(hour):
    """Room temp varies slightly with time of day: cooler at night, warmer midday."""
    base = 30.5 + 2.0 * math.sin((hour - 6) * math.pi / 12)
    return round(clamp(random.gauss(base, 0.4), 28.0, 36.0), 2)

def make_humidity(hour, temp):
    """Humidity inversely correlated with temp."""
    base = 70 - (temp - 30) * 1.5 + 3 * math.sin(hour * math.pi / 12)
    return round(clamp(random.gauss(base, 2), 35.0, 80.0), 2)

def make_light(hour):
    """Light: dark at night (0–2h), daylight peaks at noon."""
    if hour < 6 or hour >= 22:
        return round(random.uniform(10, 80), 1)
    else:
        peak = 500 * math.sin((hour - 6) * math.pi / 16)
        return round(clamp(random.gauss(peak, 30), 50, 500), 1)

def compute_comfort(temp, humidity, sound_avg, motion_ms):
    temp_score  = max(0, 100 - abs(temp - 20) * 8)
    hum_score   = max(0, 100 - abs(humidity - 50) * 2.5)
    sound_score = max(0, 100 - (sound_avg / 1023) * 100)
    penalty = 10 if motion_ms > 15000 else (5 if motion_ms > 5000 else 0)
    return round(clamp(temp_score * 0.35 + hum_score * 0.25 + sound_score * 0.40 - penalty, 0, 100), 1)

# ── Per-class sensor profiles ─────────────────────────────────────────────────
PROFILES = {
    "QUIET": {
        "sound_avg_c": 18,   "sound_avg_s": 6,
        "sound_max_c": 40,   "sound_max_s": 15,
        "motion_active_range": (0, 2),
        "motion_ms_range":     (0, 1500),
        "soundHist": lambda: {
            "QUIET": random.randint(10, 15),
            "LIGHT_ACTIVITY": random.randint(0, 3),
            "RESTLESS": 0,
            "CRYING": 0,
        },
        "lastRaw_event": "Quiet",
    },
    "LIGHT_ACTIVITY": {
        "sound_avg_c": 42,   "sound_avg_s": 12,
        "sound_max_c": 110,  "sound_max_s": 30,
        "motion_active_range": (2, 7),
        "motion_ms_range":     (1500, 8000),
        "soundHist": lambda: {
            "QUIET": random.randint(0, 5),
            "LIGHT_ACTIVITY": random.randint(8, 14),
            "RESTLESS": random.randint(0, 2),
            "CRYING": 0,
        },
        "lastRaw_event": "Light Activity",
    },
    "RESTLESS": {
        "sound_avg_c": 72,   "sound_avg_s": 18,
        "sound_max_c": 190,  "sound_max_s": 50,
        "motion_active_range": (5, 12),
        "motion_ms_range":     (8000, 22000),
        "soundHist": lambda: {
            "QUIET": random.randint(0, 2),
            "LIGHT_ACTIVITY": random.randint(2, 5),
            "RESTLESS": random.randint(7, 12),
            "CRYING": random.randint(0, 3),
        },
        "lastRaw_event": "Restless",
    },
    "CRYING": {
        "sound_avg_c": 220,  "sound_avg_s": 80,
        "sound_max_c": 600,  "sound_max_s": 200,
        "motion_active_range": (8, 15),
        "motion_ms_range":     (15000, 30000),
        "soundHist": lambda: {
            "QUIET": 0,
            "LIGHT_ACTIVITY": random.randint(0, 2),
            "RESTLESS": random.randint(0, 3),
            "CRYING": random.randint(11, 15),
        },
        "lastRaw_event": "CRYING",
    },
}

# ── Generate rows ─────────────────────────────────────────────────────────────
all_rows = []
ts = START_TIME
_id_counter = 0

for label in CLASSES:
    p = PROFILES[label]
    for _ in range(ROWS_PER_CLASS):
        _id_counter += 1
        hour = ts.hour

        # Sound
        s_avg = rand_around(p["sound_avg_c"], p["sound_avg_s"], 5, 1023)
        s_max = rand_around(p["sound_max_c"], p["sound_max_s"], s_avg, 1023)
        s_last = rand_around(s_avg, p["sound_avg_s"] * 0.6, 5, 1023)

        # Temp / humidity / light
        temp = make_temp(hour)
        hum  = make_humidity(hour, temp)
        light = make_light(hour)

        # Motion
        m_active = random.randint(*p["motion_active_range"])
        m_ms     = random.randint(*p["motion_ms_range"])
        m_state  = 1 if m_active > 3 else 0

        # soundHist
        sh = p["soundHist"]()

        # Comfort
        comfort_avg  = compute_comfort(temp, hum, s_avg, m_ms)
        comfort_last = compute_comfort(temp, hum, s_last, m_ms)

        # sampleCount varies 14–15
        sample_count = random.choice([14, 15])

        row = {
            "_id":                    f"synthetic_{_id_counter:06d}",
            "deviceId":               DEVICE_ID,
            "ts":                     ts.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "sampleCount":            sample_count,

            "temp.avg":               temp,
            "temp.min":               round(temp - random.uniform(0.1, 0.8), 1),
            "temp.max":               round(temp + random.uniform(0.1, 0.8), 1),
            "temp.last":              round(temp + random.uniform(-0.3, 0.3), 1),

            "humidity.avg":           hum,
            "humidity.min":           round(hum - random.uniform(0, 1.5), 1),
            "humidity.max":           round(hum + random.uniform(0, 1.5), 1),
            "humidity.last":          round(hum + random.uniform(-1, 1), 1),

            "sound.avg":              s_avg,
            "sound.max":              s_max,
            "sound.last":             s_last,
            "sound.event":            label,

            "comfort.avg":            comfort_avg,
            "comfort.last":           comfort_last,

            "motion.samplesActive":   m_active,
            "motion.durationMs":      m_ms,

            "light.avg":              light,
            "light.last":             round(light + random.uniform(-10, 10), 1),

            "soundHist.QUIET":        sh["QUIET"],
            "soundHist.LIGHT_ACTIVITY": sh["LIGHT_ACTIVITY"],
            "soundHist.RESTLESS":     sh["RESTLESS"],
            "soundHist.CRYING":       sh["CRYING"],

            "lastRaw.temperature":    round(temp + random.uniform(-0.2, 0.2), 1),
            "lastRaw.humidity":       round(hum + random.uniform(-1, 1), 1),
            "lastRaw.sound_level":    s_last,
            "lastRaw.sound_event":    p["lastRaw_event"],
            "lastRaw.motion":         m_state,
            "lastRaw.motion_duration": m_ms,
            "lastRaw.light":          round(light + random.uniform(-5, 5), 1),
            "lastRaw.comfort":        comfort_last,
        }

        all_rows.append(row)
        ts += timedelta(seconds=INTERVAL_SECONDS)

# Shuffle so classes aren't grouped
random.shuffle(all_rows)

# ── Write CSV ─────────────────────────────────────────────────────────────────
fieldnames = list(all_rows[0].keys())
with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(all_rows)

print(f"Generated {len(all_rows)} rows -> {OUTPUT_FILE}")

from collections import Counter
dist = Counter(r["sound.event"] for r in all_rows)
print("Class distribution:", dict(dist))

# Spot check averages per class
print("\nFeature averages per class:")
for lbl in CLASSES:
    subset = [r for r in all_rows if r["sound.event"] == lbl]
    avg_sound = sum(float(r["sound.avg"]) for r in subset) / len(subset)
    avg_motion = sum(float(r["motion.durationMs"]) for r in subset) / len(subset)
    avg_sh_cry = sum(float(r["soundHist.CRYING"]) for r in subset) / len(subset)
    print(f"  {lbl:15s}: sound.avg={avg_sound:6.1f}  motion.ms={avg_motion:7.0f}  soundHist.CRYING={avg_sh_cry:.1f}")
