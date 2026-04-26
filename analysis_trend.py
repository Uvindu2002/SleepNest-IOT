"""
SleepNest — Trend Analysis
Analyses comfort, temperature and sound trends over time using
linear regression and rolling averages.

Uses real dataset: ssleepnest.readings.csv
Output: model/report/trend_*.png
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
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
    "grid.alpha": 0.5, "font.family": "DejaVu Sans",
})

print("=" * 60)
print("  SleepNest - Trend Analysis")
print("=" * 60)

# ── Load & clean data ─────────────────────────────────────────────
df = pd.read_csv("ssleepnest.readings.csv")
df["ts"] = pd.to_datetime(df["ts"])
df = df.sort_values("ts").reset_index(drop=True)

# Normalise labels
label_map = {
    "Quiet": "QUIET", "Light Activity": "LIGHT_ACTIVITY",
    "Restless": "RESTLESS", "CRYING": "CRYING",
    "QUIET": "QUIET", "LIGHT_ACTIVITY": "LIGHT_ACTIVITY", "RESTLESS": "RESTLESS",
}
df["sound.event"] = df["sound.event"].map(label_map).fillna("QUIET")

# Clean negatives / outliers
df = df[df["sound.avg"] >= 0]
df = df[df["sound.avg"] <= 1023]
df = df[df["temp.avg"].between(20, 50)]

# Time index (minutes from start)
df["minutes"] = (df["ts"] - df["ts"].min()).dt.total_seconds() / 60
df["hour"]    = df["ts"].dt.hour
df["day"]     = df["ts"].dt.date

print(f"\nLoaded {len(df):,} rows")
print(f"Period : {df['ts'].min().strftime('%Y-%m-%d %H:%M')} -> {df['ts'].max().strftime('%Y-%m-%d %H:%M')}")
print(f"Days   : {df['day'].nunique()}")

# ── Helper: regression line ───────────────────────────────────────
def regression_line(x, y):
    mask = ~np.isnan(y)
    xv = x[mask].values.reshape(-1, 1)
    yv = y[mask].values
    if len(xv) < 5:
        return x, np.full(len(x), np.nanmean(y))
    reg = LinearRegression().fit(xv, yv)
    return x, reg.predict(x.values.reshape(-1, 1))

# ── 1. Comfort Trend ──────────────────────────────────────────────
print("\nGenerating comfort trend chart...")
fig, ax = plt.subplots(figsize=(13, 5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

comfort = pd.to_numeric(df["comfort.avg"], errors="coerce")
roll    = comfort.rolling(window=20, min_periods=1).mean()
_, reg  = regression_line(df["minutes"], comfort)

ax.fill_between(df["minutes"], comfort, alpha=0.08, color=GREEN)
ax.plot(df["minutes"], comfort, color=GREEN, alpha=0.3, lw=1, label="Comfort Score")
ax.plot(df["minutes"], roll,   color=GREEN, lw=2,   label="Rolling Avg (20 readings)")
ax.plot(df["minutes"], reg,    color=AMBER, lw=2.5, linestyle="--", label="Trend (Linear Regression)")

direction = "Improving" if reg[-1] > reg[0] else "Declining"
change    = abs(reg[-1] - reg[0])
ax.text(0.99, 0.95, f"Trend: {direction}  ({change:.1f} pts change)",
        transform=ax.transAxes, ha="right", va="top",
        fontsize=11, color=AMBER, fontweight="bold",
        bbox=dict(boxstyle="round,pad=0.4", facecolor=CARD, edgecolor=AMBER, alpha=0.8))

ax.set_title("Baby Comfort Score — Trend Over Time", fontsize=14, fontweight="bold", color=TEXT, pad=12)
ax.set_xlabel("Time (minutes from start)", fontsize=10, color=SUB)
ax.set_ylabel("Comfort Score (0-100)", fontsize=10, color=SUB)
ax.set_ylim(0, 105)
ax.legend(fontsize=9, framealpha=0.2, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/trend_comfort.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/trend_comfort.png  ({direction}, {change:.1f} pts)")

# ── 2. Temperature Trend ──────────────────────────────────────────
print("Generating temperature trend chart...")
fig, ax = plt.subplots(figsize=(13, 5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

temp = pd.to_numeric(df["temp.avg"], errors="coerce")
roll_t = temp.rolling(window=20, min_periods=1).mean()
_, reg_t = regression_line(df["minutes"], temp)

ax.fill_between(df["minutes"], temp, alpha=0.08, color=RED)
ax.plot(df["minutes"], temp,   color=RED,   alpha=0.3, lw=1, label="Temperature")
ax.plot(df["minutes"], roll_t, color=RED,   lw=2,      label="Rolling Avg (20 readings)")
ax.plot(df["minutes"], reg_t,  color=AMBER, lw=2.5, linestyle="--", label="Trend (Linear Regression)")
ax.axhline(y=26, color=GREEN, lw=1.5, linestyle=":", alpha=0.7, label="Ideal max (26°C)")
ax.axhline(y=18, color=BLUE,  lw=1.5, linestyle=":", alpha=0.7, label="Ideal min (18°C)")

direction_t = "Warming" if reg_t[-1] > reg_t[0] else "Cooling"
ax.text(0.99, 0.95, f"Trend: {direction_t}  ({abs(reg_t[-1]-reg_t[0]):.2f}°C change)",
        transform=ax.transAxes, ha="right", va="top",
        fontsize=11, color=AMBER, fontweight="bold",
        bbox=dict(boxstyle="round,pad=0.4", facecolor=CARD, edgecolor=AMBER, alpha=0.8))

ax.set_title("Room Temperature — Trend Over Time", fontsize=14, fontweight="bold", color=TEXT, pad=12)
ax.set_xlabel("Time (minutes from start)", fontsize=10, color=SUB)
ax.set_ylabel("Temperature (°C)", fontsize=10, color=SUB)
ax.legend(fontsize=9, framealpha=0.2, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/trend_temperature.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/trend_temperature.png  ({direction_t})")

# ── 3. Sound Level Trend ──────────────────────────────────────────
print("Generating sound trend chart...")
fig, ax = plt.subplots(figsize=(13, 5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

sound = pd.to_numeric(df["sound.avg"], errors="coerce")
roll_s = sound.rolling(window=20, min_periods=1).mean()
_, reg_s = regression_line(df["minutes"], sound)

ax.fill_between(df["minutes"], sound, alpha=0.08, color=BLUE)
ax.plot(df["minutes"], sound,  color=BLUE,  alpha=0.3, lw=1, label="Sound Level")
ax.plot(df["minutes"], roll_s, color=BLUE,  lw=2,      label="Rolling Avg (20 readings)")
ax.plot(df["minutes"], reg_s,  color=AMBER, lw=2.5, linestyle="--", label="Trend (Linear Regression)")

# Threshold lines
ax.axhline(y=70,  color=GREEN, lw=1.5, linestyle=":", alpha=0.7, label="Quiet threshold (70)")
ax.axhline(y=110, color=AMBER, lw=1.5, linestyle=":", alpha=0.7, label="Light Activity (110)")
ax.axhline(y=400, color=RED,   lw=1.5, linestyle=":", alpha=0.7, label="Crying threshold (400)")

ax.set_title("Sound Level — Trend Over Time", fontsize=14, fontweight="bold", color=TEXT, pad=12)
ax.set_xlabel("Time (minutes from start)", fontsize=10, color=SUB)
ax.set_ylabel("Sound Level (0-1023)", fontsize=10, color=SUB)
ax.legend(fontsize=9, framealpha=0.2, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/trend_sound.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/trend_sound.png")

# ── 4. Hourly pattern bar chart ───────────────────────────────────
print("Generating hourly pattern chart...")
fig, axes = plt.subplots(1, 3, figsize=(15, 5))
fig.patch.set_facecolor(BG)

hourly = df.groupby("hour").agg({
    "comfort.avg":  "mean",
    "temp.avg":     "mean",
    "sound.avg":    "mean",
}).reset_index()

for ax, (col, label, color) in zip(axes, [
    ("comfort.avg", "Avg Comfort Score", GREEN),
    ("temp.avg",    "Avg Temperature (C)", RED),
    ("sound.avg",   "Avg Sound Level",   BLUE),
]):
    ax.set_facecolor(CARD)
    bars = ax.bar(hourly["hour"], hourly[col], color=color,
                  edgecolor="none", width=0.7, alpha=0.85)
    ax.set_title(f"Hourly — {label}", fontsize=11, fontweight="bold", color=TEXT)
    ax.set_xlabel("Hour of Day", fontsize=9, color=SUB)
    ax.set_ylabel(label, fontsize=9, color=SUB)
    ax.tick_params(colors=SUB)
    ax.set_facecolor(CARD)
    ax.grid(True, alpha=0.3, axis="y")
    # Highlight peak hour
    peak_h = hourly.loc[hourly[col].idxmax(), "hour"]
    ax.text(peak_h, hourly[col].max() * 1.02, f"Peak\n{int(peak_h)}:00",
            ha="center", fontsize=8, color=AMBER, fontweight="bold")

plt.suptitle("Hourly Sensor Patterns", fontsize=14, fontweight="bold", color=TEXT, y=1.02)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/trend_hourly.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/trend_hourly.png")

# ── 5. Sound event distribution over time (stacked bar) ──────────
print("Generating sound event distribution chart...")
df["time_bin"] = pd.cut(df["minutes"], bins=20, labels=False)
event_bins = df.groupby(["time_bin", "sound.event"]).size().unstack(fill_value=0)
for cls in ["QUIET", "LIGHT_ACTIVITY", "RESTLESS", "CRYING"]:
    if cls not in event_bins.columns:
        event_bins[cls] = 0
event_bins = event_bins[["QUIET", "LIGHT_ACTIVITY", "RESTLESS", "CRYING"]]

fig, ax = plt.subplots(figsize=(13, 5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

colors_stack = [GREEN, BLUE, AMBER, RED]
bottom = np.zeros(len(event_bins))
for col, color in zip(event_bins.columns, colors_stack):
    ax.bar(event_bins.index, event_bins[col], bottom=bottom,
           color=color, edgecolor="none", label=col, alpha=0.85)
    bottom += event_bins[col].values

ax.set_title("Sound Event Distribution Over Time", fontsize=14, fontweight="bold", color=TEXT, pad=12)
ax.set_xlabel("Time period (bins)", fontsize=10, color=SUB)
ax.set_ylabel("Sample count", fontsize=10, color=SUB)
ax.legend(fontsize=9, framealpha=0.2, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax.tick_params(colors=SUB)
ax.grid(True, alpha=0.3, axis="y")

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/trend_events.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/trend_events.png")

print("\n" + "=" * 60)
print("  Trend Analysis Complete — 5 charts saved")
print("=" * 60)
