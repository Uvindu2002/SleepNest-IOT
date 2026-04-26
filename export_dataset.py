"""
SleepNest — Preprocessed Dataset Exporter
Loads the raw synthetic dataset, applies all feature engineering
used during model training, and saves a clean final CSV.

Output: sleepnest_final_dataset.csv
"""

import pandas as pd
import numpy as np
from collections import Counter

INPUT_FILE  = "sleepnest_dataset.csv"
OUTPUT_FILE = "sleepnest_final_dataset.csv"

print("=" * 60)
print("  SleepNest — Dataset Preprocessor & Exporter")
print("=" * 60)

# ── 1. Load raw dataset ───────────────────────────────────────────
df = pd.read_csv(INPUT_FILE)
print(f"\nRaw dataset   : {len(df):,} rows  |  {len(df.columns)} columns")

# ── 2. Normalise labels (mixed-case fix) ─────────────────────────
label_map = {
    "Quiet":          "QUIET",
    "Light Activity": "LIGHT_ACTIVITY",
    "Restless":       "RESTLESS",
    "CRYING":         "CRYING",
    "QUIET":          "QUIET",
    "LIGHT_ACTIVITY": "LIGHT_ACTIVITY",
    "RESTLESS":       "RESTLESS",
}
df["sound.event"] = df["sound.event"].map(label_map).fillna(df["sound.event"])

# ── 3. Parse timestamp → time features ───────────────────────────
df["ts"]       = pd.to_datetime(df["ts"])
df["hour"]     = df["ts"].dt.hour
df["minute"]   = df["ts"].dt.minute
df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

# ── 4. Derived sound features ─────────────────────────────────────
df["sound_range"]     = df["sound.max"] - df["sound.avg"]
df["sound_stability"] = df["sound.avg"] / (df["sound.max"] + 1)

# ── 5. Sound history features ─────────────────────────────────────
df["hist_total"]         = (df["soundHist.QUIET"] + df["soundHist.LIGHT_ACTIVITY"] +
                            df["soundHist.RESTLESS"] + df["soundHist.CRYING"])
df["hist_cry_ratio"]     = df["soundHist.CRYING"]  / (df["hist_total"] + 1)
df["hist_quiet_ratio"]   = df["soundHist.QUIET"]   / (df["hist_total"] + 1)
df["hist_la_ratio"]      = df["soundHist.LIGHT_ACTIVITY"] / (df["hist_total"] + 1)
df["hist_rest_ratio"]    = df["soundHist.RESTLESS"] / (df["hist_total"] + 1)

# ── 6. Motion features ────────────────────────────────────────────
df["motion_active_ratio"] = df["motion.samplesActive"] / (df["sampleCount"] + 1)
df["motion_active"]       = (df["motion.samplesActive"] > 0).astype(int)

# ── 7. Comfort score (server-side formula) ────────────────────────
def calc_comfort(row):
    temp  = row["temp.avg"]
    hum   = row["humidity.avg"]
    sound = row["sound.avg"]
    temp_score  = max(0, 100 - abs(temp - 20) * 8)
    hum_score   = max(0, 100 - abs(hum - 50) * 2.5)
    sound_score = max(0, 100 - (sound / 1023) * 100)
    return round(temp_score * 0.35 + hum_score * 0.25 + sound_score * 0.40, 1)

df["comfort_computed"] = df.apply(calc_comfort, axis=1)

# ── 8. Label encode target ────────────────────────────────────────
label_order = ["QUIET", "LIGHT_ACTIVITY", "RESTLESS", "CRYING"]
df["label_encoded"] = df["sound.event"].map({
    "QUIET": 0, "LIGHT_ACTIVITY": 1, "RESTLESS": 2, "CRYING": 3
})

# ── 9. Select & order final columns ──────────────────────────────
FINAL_COLS = [
    # Identifiers
    "_id", "deviceId", "ts", "hour", "minute",

    # Raw sound
    "sound.avg", "sound.max", "sound.last",

    # Engineered sound
    "sound_range", "sound_stability",

    # Sound history (raw counts)
    "soundHist.QUIET", "soundHist.LIGHT_ACTIVITY",
    "soundHist.RESTLESS", "soundHist.CRYING", "hist_total",

    # Sound history (ratios)
    "hist_quiet_ratio", "hist_la_ratio",
    "hist_rest_ratio", "hist_cry_ratio",

    # Environment
    "temp.avg", "temp.min", "temp.max",
    "humidity.avg", "humidity.min", "humidity.max",
    "light.avg", "light.last",

    # Comfort
    "comfort.avg", "comfort.last", "comfort_computed",

    # Motion
    "motion.samplesActive", "motion.durationMs",
    "motion_active_ratio", "motion_active",

    # Time cyclical encoding
    "hour_sin", "hour_cos",

    # Sample metadata
    "sampleCount",

    # Target
    "sound.event", "label_encoded",
]

df_final = df[FINAL_COLS].copy()

# ── 10. Drop rows with missing target ─────────────────────────────
before = len(df_final)
df_final = df_final.dropna(subset=["sound.event", "label_encoded"])
dropped = before - len(df_final)
if dropped:
    print(f"  Dropped {dropped} rows with missing labels")

# ── 11. Save ──────────────────────────────────────────────────────
df_final.to_csv(OUTPUT_FILE, index=False)

# ── 12. Summary report ────────────────────────────────────────────
print(f"\nPreprocessed dataset: {len(df_final):,} rows  |  {len(df_final.columns)} columns")
print(f"Output file         : {OUTPUT_FILE}")

print("\nClass distribution:")
dist = Counter(df_final["sound.event"])
for cls in label_order:
    n = dist.get(cls, 0)
    bar = "#" * int(n / 50)
    print(f"  {cls:16s} [{cls[0]}={label_order.index(cls)}]: {n:5,}  {bar}")

print("\nFeature summary:")
feature_groups = {
    "Sound (raw)":     ["sound.avg", "sound.max", "sound.last"],
    "Sound (derived)": ["sound_range", "sound_stability"],
    "soundHist counts":["soundHist.QUIET","soundHist.LIGHT_ACTIVITY","soundHist.RESTLESS","soundHist.CRYING"],
    "soundHist ratios":["hist_quiet_ratio","hist_la_ratio","hist_rest_ratio","hist_cry_ratio"],
    "Environment":     ["temp.avg","humidity.avg","light.avg"],
    "Comfort":         ["comfort.avg","comfort_computed"],
    "Motion":          ["motion.samplesActive","motion.durationMs","motion_active_ratio"],
    "Time":            ["hour_sin","hour_cos"],
}
for group, cols in feature_groups.items():
    print(f"\n  [{group}]")
    for col in cols:
        if col in df_final.columns:
            s = df_final[col]
            print(f"    {col:35s}: mean={s.mean():8.2f}  min={s.min():8.2f}  max={s.max():8.2f}")

print(f"\nColumn list ({len(df_final.columns)} total):")
for i, col in enumerate(df_final.columns, 1):
    print(f"  {i:2d}. {col}")

print("\n" + "=" * 60)
print(f"  Done! -> {OUTPUT_FILE}")
print("=" * 60)
