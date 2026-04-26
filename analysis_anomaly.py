"""
SleepNest — Anomaly Detection
Uses Isolation Forest trained on QUIET (normal) readings to detect
unusual sensor conditions without predefined thresholds.

Output: model/report/anomaly_*.png
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import seaborn as sns
import warnings
warnings.filterwarnings("ignore")
import os

OUT_DIR = "model/report"
os.makedirs(OUT_DIR, exist_ok=True)

BG    = "#0F1117"
CARD  = "#1E2236"
TEXT  = "#E2E8F0"
SUB   = "#94A3B8"
GREEN = "#3B9E72"
BLUE  = "#5A52E0"
AMBER = "#F59E0B"
RED   = "#EF4444"

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": CARD,
    "axes.edgecolor": "#2A2E4A", "axes.labelcolor": TEXT,
    "xtick.color": SUB, "ytick.color": SUB,
    "text.color": TEXT, "grid.color": "#2A2E4A",
    "grid.alpha": 0.4, "font.family": "DejaVu Sans",
})

print("=" * 60)
print("  SleepNest - Anomaly Detection (Isolation Forest)")
print("=" * 60)

# ── Load & clean real data ────────────────────────────────────────
df = pd.read_csv("ssleepnest.readings.csv")
df["ts"] = pd.to_datetime(df["ts"])
df = df.sort_values("ts").reset_index(drop=True)

label_map = {
    "Quiet": "QUIET", "Light Activity": "LIGHT_ACTIVITY",
    "Restless": "RESTLESS", "CRYING": "CRYING",
    "QUIET": "QUIET", "LIGHT_ACTIVITY": "LIGHT_ACTIVITY", "RESTLESS": "RESTLESS",
}
df["sound.event"] = df["sound.event"].map(label_map).fillna("QUIET")
df = df[df["sound.avg"] >= 0]
df = df[df["temp.avg"].between(20, 50)]
df["minutes"] = (df["ts"] - df["ts"].min()).dt.total_seconds() / 60

print(f"\nLoaded {len(df):,} rows")

# ── Features for anomaly detection ───────────────────────────────
FEATURES = ["sound.avg", "sound.max", "temp.avg", "humidity.avg",
            "light.avg", "comfort.avg"]

X = df[FEATURES].apply(pd.to_numeric, errors="coerce")
X = X.fillna(X.median())

# ── Train Isolation Forest on QUIET data only ─────────────────────
quiet_mask = df["sound.event"] == "QUIET"
X_quiet    = X[quiet_mask]

print(f"\nTraining Isolation Forest on {len(X_quiet):,} QUIET samples (normal behaviour)...")
scaler = StandardScaler()
X_scaled       = scaler.fit_transform(X)
X_quiet_scaled = scaler.transform(X_quiet)

iso = IsolationForest(
    n_estimators=200,
    contamination=0.08,   # expect ~8% anomalies
    random_state=42,
    n_jobs=-1,
)
iso.fit(X_quiet_scaled)

# Predict on all data (-1 = anomaly, 1 = normal)
preds  = iso.predict(X_scaled)
scores = iso.score_samples(X_scaled)   # lower = more anomalous

df["anomaly"]       = preds          # -1 or 1
df["anomaly_score"] = scores         # lower = more anomalous
df["is_anomaly"]    = preds == -1

n_anomalies = df["is_anomaly"].sum()
print(f"Detected {n_anomalies:,} anomalies ({n_anomalies/len(df)*100:.1f}% of data)")

# ── Validate against actual labels ───────────────────────────────
# Anomaly should correlate with CRYING/RESTLESS
actual_alert = df["sound.event"].isin(["CRYING", "RESTLESS"]).astype(int)
pred_anomaly = df["is_anomaly"].astype(int)

from sklearn.metrics import accuracy_score, precision_score, recall_score
print(f"\nAnomaly vs actual alerts (CRYING/RESTLESS):")
print(f"  Precision : {precision_score(actual_alert, pred_anomaly, zero_division=0):.3f}")
print(f"  Recall    : {recall_score(actual_alert, pred_anomaly, zero_division=0):.3f}")

# ── 1. Anomaly Score Over Time ────────────────────────────────────
print("\nGenerating anomaly timeline chart...")
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
fig.patch.set_facecolor(BG)

# Top: Sound level with anomalies highlighted
ax1.set_facecolor(CARD)
sound = pd.to_numeric(df["sound.avg"], errors="coerce")
ax1.plot(df["minutes"], sound, color=BLUE, lw=1, alpha=0.6, label="Sound Level")
anomaly_pts = df[df["is_anomaly"]]
ax1.scatter(anomaly_pts["minutes"], anomaly_pts["sound.avg"],
            color=RED, s=25, zorder=5, label=f"Anomaly ({len(anomaly_pts):,} pts)", alpha=0.7)
ax1.set_ylabel("Sound Level (0-1023)", fontsize=10, color=SUB)
ax1.set_title("Anomaly Detection — Sound Level Timeline", fontsize=13, fontweight="bold", color=TEXT)
ax1.legend(fontsize=9, framealpha=0.3, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax1.grid(True, alpha=0.3)

# Bottom: Anomaly score over time
ax2.set_facecolor(CARD)
ax2.plot(df["minutes"], df["anomaly_score"], color=AMBER, lw=1, alpha=0.7, label="Anomaly Score")
threshold_val = np.percentile(df["anomaly_score"], 8)
ax2.axhline(y=threshold_val, color=RED, lw=2, linestyle="--",
            label=f"Anomaly threshold ({threshold_val:.3f})")
ax2.fill_between(df["minutes"], df["anomaly_score"], threshold_val,
                 where=df["anomaly_score"] < threshold_val,
                 color=RED, alpha=0.3, label="Anomalous zone")
ax2.set_ylabel("Anomaly Score\n(lower = more anomalous)", fontsize=9, color=SUB)
ax2.set_xlabel("Time (minutes from start)", fontsize=10, color=SUB)
ax2.legend(fontsize=9, framealpha=0.3, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/anomaly_timeline.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/anomaly_timeline.png")

# ── 2. Anomaly Score Distribution by Class ────────────────────────
print("Generating anomaly score distribution chart...")
CLASS_ORDER  = ["QUIET", "LIGHT_ACTIVITY", "RESTLESS", "CRYING"]
class_colors = [GREEN, BLUE, AMBER, RED]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))
fig.patch.set_facecolor(BG)

# Violin plot of anomaly scores per class
ax1.set_facecolor(CARD)
data_v = [df[df["sound.event"] == cls]["anomaly_score"].values
          for cls in CLASS_ORDER if cls in df["sound.event"].values]
labels_v = [cls for cls in CLASS_ORDER if cls in df["sound.event"].values]

vp = ax1.violinplot(data_v, positions=range(len(labels_v)), showmedians=True)
for body, color in zip(vp["bodies"], [class_colors[CLASS_ORDER.index(l)] for l in labels_v]):
    body.set_facecolor(color)
    body.set_alpha(0.6)
vp["cmedians"].set_color("white")
vp["cmedians"].set_linewidth(2)
for part in ["cbars","cmins","cmaxes"]:
    vp[part].set_color(SUB)
    vp[part].set_linewidth(1)

ax1.axhline(y=threshold_val, color=RED, lw=1.5, linestyle="--", alpha=0.7,
            label="Anomaly threshold")
ax1.set_xticks(range(len(labels_v)))
ax1.set_xticklabels([l.replace("_", "\n") for l in labels_v], fontsize=8, color=TEXT)
ax1.set_ylabel("Anomaly Score", fontsize=10, color=SUB)
ax1.set_title("Anomaly Score by Class", fontsize=12, fontweight="bold", color=TEXT)
ax1.legend(fontsize=9, framealpha=0.3, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax1.grid(True, alpha=0.3, axis="y")

# Bar: anomaly rate per class
ax2.set_facecolor(CARD)
anomaly_rates = []
for cls in CLASS_ORDER:
    subset = df[df["sound.event"] == cls]
    rate = (subset["is_anomaly"].sum() / len(subset) * 100) if len(subset) > 0 else 0
    anomaly_rates.append(rate)

bars = ax2.bar(range(len(CLASS_ORDER)), anomaly_rates,
               color=class_colors, edgecolor="none", width=0.55, alpha=0.85)
for bar, val in zip(bars, anomaly_rates):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
             f"{val:.1f}%", ha="center", fontsize=10, fontweight="bold", color=TEXT)
ax2.set_xticks(range(len(CLASS_ORDER)))
ax2.set_xticklabels([c.replace("_", "\n") for c in CLASS_ORDER], fontsize=8, color=TEXT)
ax2.set_ylabel("Anomaly Rate (%)", fontsize=10, color=SUB)
ax2.set_title("Anomaly Rate per Class", fontsize=12, fontweight="bold", color=TEXT)
ax2.set_ylim(0, max(anomaly_rates) * 1.2 + 5)
ax2.grid(True, alpha=0.3, axis="y")

plt.suptitle("Isolation Forest Anomaly Detection Results", fontsize=14, fontweight="bold", color=TEXT, y=1.02)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/anomaly_distribution.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/anomaly_distribution.png")

# ── 3. 2D Anomaly Scatter (Sound vs Comfort) ─────────────────────
print("Generating 2D anomaly scatter chart...")
fig, ax = plt.subplots(figsize=(10, 6))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

normal  = df[~df["is_anomaly"]]
anomaly = df[df["is_anomaly"]]

sound_n = pd.to_numeric(normal["sound.avg"], errors="coerce")
comf_n  = pd.to_numeric(normal["comfort.avg"], errors="coerce")
sound_a = pd.to_numeric(anomaly["sound.avg"], errors="coerce")
comf_a  = pd.to_numeric(anomaly["comfort.avg"], errors="coerce")

ax.scatter(sound_n, comf_n, c=GREEN, alpha=0.25, s=15,
           label=f"Normal ({len(normal):,})", edgecolors="none")
ax.scatter(sound_a, comf_a, c=RED, alpha=0.6, s=30,
           label=f"Anomaly ({len(anomaly):,})", edgecolors="none", zorder=5)

ax.set_xlabel("Sound Level (0-1023)", fontsize=11, color=SUB)
ax.set_ylabel("Comfort Score (0-100)", fontsize=11, color=SUB)
ax.set_title("Anomaly Detection — Sound vs Comfort Space",
             fontsize=14, fontweight="bold", color=TEXT, pad=12)
ax.legend(fontsize=10, framealpha=0.3, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/anomaly_scatter.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/anomaly_scatter.png")

# ── 4. Summary metrics card ───────────────────────────────────────
print("Generating anomaly summary card...")
fig, axes = plt.subplots(1, 4, figsize=(14, 3))
fig.patch.set_facecolor(BG)

from matplotlib.patches import FancyBboxPatch
metrics_cards = [
    ("Total Readings",    f"{len(df):,}",                       BLUE),
    ("Anomalies Found",   f"{n_anomalies:,}",                   RED),
    ("Anomaly Rate",      f"{n_anomalies/len(df)*100:.1f}%",    AMBER),
    ("Normal Readings",   f"{len(df)-n_anomalies:,}",           GREEN),
]
for ax, (title, val, color) in zip(axes, metrics_cards):
    ax.set_xlim(0,1); ax.set_ylim(0,1); ax.axis("off")
    ax.set_facecolor(BG)
    ax.add_patch(FancyBboxPatch((0.05,0.05), 0.9, 0.9,
                                boxstyle="round,pad=0.05",
                                facecolor=CARD, edgecolor=color, linewidth=2))
    ax.text(0.5, 0.72, title, ha="center", va="center",
            fontsize=9, color=SUB, fontweight="bold")
    ax.text(0.5, 0.35, val, ha="center", va="center",
            fontsize=20, color=color, fontweight="bold")

plt.suptitle("Isolation Forest — Detection Summary", fontsize=13,
             fontweight="bold", color=TEXT, y=1.05)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/anomaly_summary.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/anomaly_summary.png")

print("\n" + "=" * 60)
print("  Anomaly Detection Complete — 4 charts saved")
print(f"  Detected {n_anomalies:,} anomalies ({n_anomalies/len(df)*100:.1f}%) from {len(df):,} readings")
print("=" * 60)
