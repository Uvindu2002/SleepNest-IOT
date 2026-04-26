"""
SleepNest — Synthetic Dataset Generator v3
10,000 rows (2,500 per class) with realistic noise based on real sensor data.

Key changes from v2:
- Profiles calibrated from real MongoDB export (ssleepnest.readings.csv)
- Real room temp ~32C, humidity ~55-60%, light ~200-450
- Motion mostly 0 (PIR not triggering in real data)
- Overlapping class boundaries (8% borderline samples per class)
- Gaussian noise on all features
- soundHist mismatches (not perfectly aligned with sound.avg)
- Occasional outlier spikes within each class
- Target accuracy: ~90-95% (not 100% overfit)
"""

import csv
import random
import math
from datetime import datetime, timedelta

random.seed(99)

# ── Config ──────────────────────────────────────────────────────────────────
ROWS_PER_CLASS  = 2500          # 2500 x 4 = 10,000 rows total
BORDERLINE_RATE = 0.25          # 25% of each class = samples near boundaries
OUTLIER_RATE    = 0.10          # 10% random outlier spikes
LABEL_NOISE     = 0.06          # 6% samples get adjacent class label (real-world mislabels)
START_TIME      = datetime(2026, 4, 1, 0, 0, 0)
INTERVAL_SECONDS = 30
DEVICE_ID       = "ESP32_GREENHOUSE_01"
OUTPUT_FILE     = "sleepnest_dataset.csv"

CLASSES = ["QUIET", "LIGHT_ACTIVITY", "RESTLESS", "CRYING"]

# ── Thresholds — must match MLPredictor.js THRESHOLDS ───────────────────────
THR_QUIET  = 70
THR_LA     = 110
THR_REST   = 250   # shCry bucket uses RESTLESS threshold in MLPredictor
THR_CRYING = 400

# ── Helpers ──────────────────────────────────────────────────────────────────
def clamp(val, lo, hi):
    return max(lo, min(hi, val))

def rand_around(center, spread, lo=0, hi=1023):
    return round(clamp(random.gauss(center, spread), lo, hi), 1)

def make_temp(hour):
    """Real room: ~32C base, slight day/night variation."""
    base = 32.3 + 1.2 * math.sin((hour - 6) * math.pi / 12)
    return round(clamp(random.gauss(base, 0.5), 30.0, 36.0), 2)

def make_humidity(hour, temp):
    """Real humidity: ~55-60%, slight inverse correlation with temp."""
    base = 57 - (temp - 32) * 1.2 + 2 * math.sin(hour * math.pi / 12)
    return round(clamp(random.gauss(base, 2.5), 41.0, 71.0), 2)

def make_light(hour):
    """Real light: 0-500 range, high during day, near-zero at night."""
    if hour < 6 or hour >= 22:
        return round(random.uniform(0, 80), 1)
    else:
        peak = 420 * math.sin((hour - 6) * math.pi / 16)
        return round(clamp(random.gauss(peak, 40), 0, 560), 1)

def compute_comfort(temp, humidity, sound_avg, motion_ms):
    temp_score  = max(0, 100 - abs(temp - 20) * 8)
    hum_score   = max(0, 100 - abs(humidity - 50) * 2.5)
    sound_score = max(0, 100 - (sound_avg / 1023) * 100)
    penalty = 10 if motion_ms > 15000 else (5 if motion_ms > 5000 else 0)
    return round(clamp(temp_score * 0.35 + hum_score * 0.25 + sound_score * 0.40 - penalty, 0, 100), 1)

def noisy_hist(primary_bucket, total=15):
    """Generate soundHist counts with heavy noise — not perfectly aligned."""
    buckets = ["QUIET", "LIGHT_ACTIVITY", "RESTLESS", "CRYING"]
    result = {b: 0 for b in buckets}
    # Primary bucket gets fewer guaranteed samples (more spread)
    primary_count = random.randint(total - 8, total - 1)
    result[primary_bucket] = primary_count
    remaining = total - primary_count
    others = [b for b in buckets if b != primary_bucket]
    for _ in range(remaining):
        result[random.choice(others)] += 1
    return result

ADJACENT = {
    "QUIET":          ["LIGHT_ACTIVITY"],
    "LIGHT_ACTIVITY": ["QUIET", "RESTLESS"],
    "RESTLESS":       ["LIGHT_ACTIVITY", "CRYING"],
    "CRYING":         ["RESTLESS"],
}

# ── Per-class sensor profiles — calibrated from real data ────────────────────
PROFILES = {
    "QUIET": {
        # Wider spread — overlaps into LIGHT_ACTIVITY territory
        "sound_avg_c": 42,   "sound_avg_s": 22,
        "sound_max_c": 95,   "sound_max_s": 40,
        "motion_active_range": (0, 1),
        "motion_ms_range":     (0, 500),
        "hist_primary": "QUIET",
    },
    "LIGHT_ACTIVITY": {
        # Wider — overlaps both QUIET and RESTLESS
        "sound_avg_c": 118,  "sound_avg_s": 45,
        "sound_max_c": 270,  "sound_max_s": 90,
        "motion_active_range": (0, 3),
        "motion_ms_range":     (0, 3000),
        "hist_primary": "LIGHT_ACTIVITY",
    },
    "RESTLESS": {
        # Wider — overlaps both LIGHT_ACTIVITY and CRYING
        "sound_avg_c": 195,  "sound_avg_s": 80,
        "sound_max_c": 450,  "sound_max_s": 140,
        "motion_active_range": (0, 4),
        "motion_ms_range":     (0, 8000),
        "hist_primary": "RESTLESS",
    },
    "CRYING": {
        # Wider — some samples look like RESTLESS
        "sound_avg_c": 420,  "sound_avg_s": 180,
        "sound_max_c": 700,  "sound_max_s": 200,
        "motion_active_range": (0, 3),
        "motion_ms_range":     (0, 2000),
        "hist_primary": "CRYING",
    },
}

# ── Borderline sample generators (create confusion at class edges) ────────────
def borderline_sound(label):
    """Return a sound.avg near the boundary between this class and a neighbour."""
    if label == "QUIET":
        # Drift up toward LIGHT_ACTIVITY boundary
        return rand_around(THR_QUIET + 10, 8, 55, 95)
    elif label == "LIGHT_ACTIVITY":
        # Could drift toward QUIET or RESTLESS
        if random.random() < 0.5:
            return rand_around(THR_QUIET - 8, 8, 40, THR_QUIET)
        else:
            return rand_around(THR_LA + 15, 12, THR_LA, 160)
    elif label == "RESTLESS":
        if random.random() < 0.5:
            return rand_around(THR_LA + 10, 10, 100, THR_LA + 40)
        else:
            return rand_around(THR_REST + 20, 20, THR_REST, 300)
    else:  # CRYING
        return rand_around(THR_REST + 30, 30, 260, 380)

# ── Generate rows ─────────────────────────────────────────────────────────────
all_rows = []
ts = START_TIME
_id_counter = 0

for label in CLASSES:
    p = PROFILES[label]
    for i in range(ROWS_PER_CLASS):
        _id_counter += 1
        hour = ts.hour

        # Decide if this is a borderline or outlier sample
        is_borderline = random.random() < BORDERLINE_RATE
        is_outlier    = random.random() < OUTLIER_RATE

        # Sound
        if is_borderline:
            s_avg = borderline_sound(label)
        elif is_outlier:
            # Random spike anywhere in a wider range
            s_avg = rand_around(p["sound_avg_c"], p["sound_avg_s"] * 2.5, 5, 900)
        else:
            s_avg = rand_around(p["sound_avg_c"], p["sound_avg_s"], 5, 1023)

        s_max  = rand_around(max(s_avg, p["sound_max_c"]), p["sound_max_s"], s_avg, 1023)
        s_last = rand_around(s_avg, p["sound_avg_s"] * 0.7, 5, 1023)

        # Add occasional "last sample" outlier (sensor spike on last reading)
        if random.random() < 0.05:
            s_last = rand_around(s_avg * random.uniform(1.5, 3.0), 30, 5, 1023)

        # Environment — from real sensor ranges
        temp  = make_temp(hour)
        hum   = make_humidity(hour, temp)
        light = make_light(hour)

        # Motion — real data shows mostly 0
        m_active = random.randint(*p["motion_active_range"])
        m_ms     = random.randint(*p["motion_ms_range"])
        # Occasionally add a random motion event (even in quiet)
        if random.random() < 0.04:
            m_active = random.randint(1, 5)
            m_ms     = random.randint(500, 5000)
        m_state  = 1 if m_active > 2 else 0

        # soundHist — noisy, not perfectly matching s_avg
        sh = noisy_hist(p["hist_primary"])
        # Extra noise: occasionally swap primary bucket
        if is_borderline and random.random() < 0.4:
            neighbours = {
                "QUIET":          "LIGHT_ACTIVITY",
                "LIGHT_ACTIVITY": random.choice(["QUIET", "RESTLESS"]),
                "RESTLESS":       random.choice(["LIGHT_ACTIVITY", "CRYING"]),
                "CRYING":         "RESTLESS",
            }
            sh = noisy_hist(neighbours[p["hist_primary"]])

        # Comfort
        comfort_avg  = compute_comfort(temp, hum, s_avg, m_ms)
        comfort_last = compute_comfort(temp, hum, s_last, m_ms)
        # Small random comfort perturbation
        comfort_avg  = round(clamp(comfort_avg  + random.gauss(0, 1.5), 0, 100), 1)
        comfort_last = round(clamp(comfort_last + random.gauss(0, 1.5), 0, 100), 1)

        # sampleCount 13–15 (real data varies)
        sample_count = random.choices([13, 14, 15], weights=[1, 4, 5])[0]

        # Label noise — flip 6% of samples to an adjacent class
        final_label = label
        if random.random() < LABEL_NOISE:
            final_label = random.choice(ADJACENT[label])

        row = {
            "_id":                      f"synthetic_{_id_counter:06d}",
            "deviceId":                 DEVICE_ID,
            "ts":                       ts.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "sampleCount":              sample_count,

            "temp.avg":                 temp,
            "temp.min":                 round(temp - random.uniform(0.1, 0.6), 1),
            "temp.max":                 round(temp + random.uniform(0.1, 0.6), 1),
            "temp.last":                round(temp + random.gauss(0, 0.25), 1),

            "humidity.avg":             hum,
            "humidity.min":             round(hum - random.uniform(0, 2), 1),
            "humidity.max":             round(hum + random.uniform(0, 2), 1),
            "humidity.last":            round(hum + random.gauss(0, 1), 1),

            "sound.avg":                s_avg,
            "sound.max":                s_max,
            "sound.last":               s_last,
            "sound.event":              final_label,

            "comfort.avg":              comfort_avg,
            "comfort.last":             comfort_last,

            "motion.samplesActive":     m_active,
            "motion.durationMs":        m_ms,

            "light.avg":                light,
            "light.last":               round(clamp(light + random.gauss(0, 12), 0, 560), 1),

            "soundHist.QUIET":          sh["QUIET"],
            "soundHist.LIGHT_ACTIVITY": sh["LIGHT_ACTIVITY"],
            "soundHist.RESTLESS":       sh["RESTLESS"],
            "soundHist.CRYING":         sh["CRYING"],

            "lastRaw.temperature":      round(temp + random.gauss(0, 0.2), 1),
            "lastRaw.humidity":         round(hum  + random.gauss(0, 1),   1),
            "lastRaw.sound_level":      s_last,
            "lastRaw.sound_event":      label,
            "lastRaw.motion":           m_state,
            "lastRaw.motion_duration":  m_ms,
            "lastRaw.light":            round(clamp(light + random.gauss(0, 8), 0, 560), 1),
            "lastRaw.comfort":          comfort_last,
        }

        all_rows.append(row)
        ts += timedelta(seconds=INTERVAL_SECONDS)

# Shuffle so classes are not grouped
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

print("\nFeature averages per class:")
for lbl in CLASSES:
    subset = [r for r in all_rows if r["sound.event"] == lbl]
    avg_sound   = sum(float(r["sound.avg"])         for r in subset) / len(subset)
    avg_motion  = sum(float(r["motion.durationMs"]) for r in subset) / len(subset)
    avg_sh_cry  = sum(float(r["soundHist.CRYING"])  for r in subset) / len(subset)
    avg_temp    = sum(float(r["temp.avg"])           for r in subset) / len(subset)
    avg_hum     = sum(float(r["humidity.avg"])       for r in subset) / len(subset)
    print(f"  {lbl:15s}: sound.avg={avg_sound:6.1f}  temp={avg_temp:.1f}C"
          f"  hum={avg_hum:.1f}%  motion.ms={avg_motion:6.0f}  shCry={avg_sh_cry:.1f}")
