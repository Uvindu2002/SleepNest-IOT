"""
SleepNest — Correlation Analysis
Analyses relationships between sensor values:
  - Correlation heatmap of all features
  - Scatter plots: temp vs comfort, sound vs comfort, humidity vs comfort
  - Per-class box plots
  - Pair plot of key features

Output: model/report/corr_*.png
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
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

CLASS_COLORS = {
    "CRYING": RED, "RESTLESS": AMBER,
    "LIGHT_ACTIVITY": BLUE, "QUIET": GREEN,
}

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": CARD,
    "axes.edgecolor": "#2A2E4A", "axes.labelcolor": TEXT,
    "xtick.color": SUB, "ytick.color": SUB,
    "text.color": TEXT, "grid.color": "#2A2E4A",
    "grid.alpha": 0.4, "font.family": "DejaVu Sans",
})

print("=" * 60)
print("  SleepNest - Correlation Analysis")
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

print(f"\nLoaded {len(df):,} rows")

# Key numeric columns
COLS = {
    "sound.avg":     "Sound Avg",
    "sound.max":     "Sound Max",
    "temp.avg":      "Temperature",
    "humidity.avg":  "Humidity",
    "light.avg":     "Light Level",
    "comfort.avg":   "Comfort Score",
    "motion.samplesActive": "Motion Samples",
}

num_df = df[list(COLS.keys())].apply(pd.to_numeric, errors="coerce").dropna()
num_df.columns = list(COLS.values())

# ── 1. Correlation Heatmap ────────────────────────────────────────
print("\nGenerating correlation heatmap...")
corr = num_df.corr()

fig, ax = plt.subplots(figsize=(9, 7))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

mask = np.zeros_like(corr, dtype=bool)
mask[np.triu_indices_from(mask, k=1)] = False   # show full matrix

sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdYlGn",
            center=0, vmin=-1, vmax=1,
            xticklabels=corr.columns, yticklabels=corr.columns,
            linewidths=0.5, linecolor=BG, ax=ax,
            annot_kws={"size": 9, "weight": "bold"},
            cbar_kws={"shrink": 0.8})

ax.set_title("Sensor Correlation Matrix", fontsize=14, fontweight="bold", color=TEXT, pad=15)
ax.tick_params(axis="x", rotation=35, labelsize=9, colors=TEXT)
ax.tick_params(axis="y", rotation=0,  labelsize=9, colors=TEXT)

# Print top correlations to console
print("\n  Top correlations with Comfort Score:")
comfort_corr = corr["Comfort Score"].drop("Comfort Score").sort_values(key=abs, ascending=False)
for feat, val in comfort_corr.items():
    direction = "+" if val > 0 else "-"
    print(f"    {feat:20s}: {val:+.3f}  {'strong' if abs(val)>0.5 else 'moderate' if abs(val)>0.3 else 'weak'}")

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/corr_heatmap.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/corr_heatmap.png")

# ── 2. Scatter Plots: Key Relationships ───────────────────────────
print("Generating scatter plots...")
fig, axes = plt.subplots(1, 3, figsize=(15, 5))
fig.patch.set_facecolor(BG)

pairs = [
    ("Temperature", "Comfort Score", RED,   "Temperature (C)"),
    ("Sound Avg",   "Comfort Score", BLUE,  "Sound Level (0-1023)"),
    ("Humidity",    "Comfort Score", GREEN, "Humidity (%)"),
]

for ax, (x_col, y_col, color, xlabel) in zip(axes, pairs):
    ax.set_facecolor(CARD)
    x = num_df[x_col]
    y = num_df[y_col]

    ax.scatter(x, y, alpha=0.25, color=color, s=15, edgecolors="none")

    # Regression line
    slope, intercept, r, p, _ = stats.linregress(x.dropna(), y.dropna())
    xline = np.linspace(x.min(), x.max(), 100)
    ax.plot(xline, slope * xline + intercept, color=AMBER, lw=2.5,
            label=f"r = {r:.3f}  (p {'< 0.001' if p < 0.001 else f'= {p:.3f}'})")

    ax.set_title(f"{x_col} vs {y_col}", fontsize=11, fontweight="bold", color=TEXT)
    ax.set_xlabel(xlabel, fontsize=9, color=SUB)
    ax.set_ylabel("Comfort Score (0-100)", fontsize=9, color=SUB)
    ax.legend(fontsize=9, framealpha=0.3, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
    ax.tick_params(colors=SUB)
    ax.grid(True, alpha=0.3)

plt.suptitle("Sensor Correlation — Key Relationships", fontsize=14, fontweight="bold", color=TEXT, y=1.02)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/corr_scatter.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/corr_scatter.png")

# ── 3. Box Plots per Class ────────────────────────────────────────
print("Generating per-class box plots...")
CLASS_ORDER = ["QUIET", "LIGHT_ACTIVITY", "RESTLESS", "CRYING"]
df_clean = df.copy()
df_clean["sound.avg"]   = pd.to_numeric(df_clean["sound.avg"],   errors="coerce")
df_clean["temp.avg"]    = pd.to_numeric(df_clean["temp.avg"],    errors="coerce")
df_clean["comfort.avg"] = pd.to_numeric(df_clean["comfort.avg"], errors="coerce")
df_clean = df_clean.dropna(subset=["sound.avg","temp.avg","comfort.avg"])
df_clean = df_clean[df_clean["sound.event"].isin(CLASS_ORDER)]

fig, axes = plt.subplots(1, 3, figsize=(15, 5))
fig.patch.set_facecolor(BG)

box_features = [
    ("sound.avg",   "Sound Level (0-1023)"),
    ("temp.avg",    "Temperature (C)"),
    ("comfort.avg", "Comfort Score (0-100)"),
]

for ax, (feat, ylabel) in zip(axes, box_features):
    ax.set_facecolor(CARD)
    data_by_class = [df_clean[df_clean["sound.event"] == cls][feat].dropna().values
                     for cls in CLASS_ORDER]
    colors_box = [GREEN, BLUE, AMBER, RED]

    bp = ax.boxplot(data_by_class, patch_artist=True, notch=False,
                    medianprops=dict(color="white", lw=2),
                    whiskerprops=dict(color=SUB),
                    capprops=dict(color=SUB),
                    flierprops=dict(marker=".", color=SUB, alpha=0.3, markersize=4))

    for patch, color in zip(bp["boxes"], colors_box):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)

    ax.set_xticks(range(1, len(CLASS_ORDER) + 1))
    ax.set_xticklabels([c.replace("_", "\n") for c in CLASS_ORDER], fontsize=8, color=TEXT)
    ax.set_ylabel(ylabel, fontsize=9, color=SUB)
    ax.set_title(f"{ylabel} by Class", fontsize=11, fontweight="bold", color=TEXT)
    ax.tick_params(colors=SUB)
    ax.grid(True, alpha=0.3, axis="y")

plt.suptitle("Feature Distribution by Sound Class", fontsize=14, fontweight="bold", color=TEXT, y=1.02)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/corr_boxplot.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/corr_boxplot.png")

# ── 4. Class distribution pie + bar ──────────────────────────────
print("Generating class distribution chart...")
dist = df_clean["sound.event"].value_counts()
dist = dist.reindex(CLASS_ORDER, fill_value=0)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 5))
fig.patch.set_facecolor(BG)

pie_colors = [CLASS_COLORS[c] for c in dist.index]
wedges, texts, autotexts = ax1.pie(
    dist.values, labels=dist.index, colors=pie_colors,
    autopct="%1.1f%%", startangle=140,
    wedgeprops={"edgecolor": BG, "linewidth": 2},
    textprops={"color": TEXT, "fontsize": 9},
)
for at in autotexts:
    at.set_fontsize(9); at.set_color(BG); at.set_fontweight("bold")
ax1.set_title("Class Distribution (Real Data)", fontsize=12, fontweight="bold", color=TEXT)
ax1.set_facecolor(BG)

ax2.set_facecolor(CARD)
bars = ax2.bar(dist.index, dist.values, color=pie_colors, edgecolor="none", width=0.5)
for bar, val in zip(bars, dist.values):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 5,
             f"{val:,}", ha="center", fontsize=10, fontweight="bold", color=TEXT)
ax2.set_title("Sample Count by Class", fontsize=12, fontweight="bold", color=TEXT)
ax2.set_ylabel("Samples", color=SUB)
ax2.tick_params(colors=TEXT)
ax2.set_facecolor(CARD)
ax2.set_xticklabels([c.replace("_", "\n") for c in dist.index], fontsize=8)
ax2.grid(True, alpha=0.3, axis="y")

plt.suptitle("Real Dataset — Class Analysis", fontsize=14, fontweight="bold", color=TEXT, y=1.02)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/corr_classes.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/corr_classes.png")

print("\n" + "=" * 60)
print("  Correlation Analysis Complete — 4 charts saved")
print("=" * 60)
