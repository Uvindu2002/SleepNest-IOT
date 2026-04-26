"""
SleepNest — Usage / Behavior Pattern Analysis
K-Means clustering to discover natural usage patterns from sensor data.
Uses unsupervised learning — no labels used during training.

Output: model/report/cluster_*.png
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import warnings
warnings.filterwarnings("ignore")
import os

OUT_DIR = "model/report"
os.makedirs(OUT_DIR, exist_ok=True)

BG     = "#0F1117"
CARD   = "#1E2236"
TEXT   = "#E2E8F0"
SUB    = "#94A3B8"
GREEN  = "#3B9E72"
BLUE   = "#5A52E0"
AMBER  = "#F59E0B"
RED    = "#EF4444"
PURPLE = "#A855F7"

CLUSTER_COLORS = [GREEN, BLUE, AMBER, RED, PURPLE]

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": CARD,
    "axes.edgecolor": "#2A2E4A", "axes.labelcolor": TEXT,
    "xtick.color": SUB, "ytick.color": SUB,
    "text.color": TEXT, "grid.color": "#2A2E4A",
    "grid.alpha": 0.4, "font.family": "DejaVu Sans",
})

print("=" * 60)
print("  SleepNest - Behavior Pattern Analysis (K-Means)")
print("=" * 60)

# ── Load & clean ──────────────────────────────────────────────────
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

FEATURES = ["sound.avg", "sound.max", "temp.avg", "humidity.avg", "light.avg", "comfort.avg"]
X_raw = df[FEATURES].apply(pd.to_numeric, errors="coerce").fillna(df[FEATURES].apply(pd.to_numeric, errors="coerce").median())

scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X_raw)

# ── 1. Elbow + Silhouette to find optimal k ───────────────────────
print("\nFinding optimal number of clusters...")
K_RANGE = range(2, 9)
inertias   = []
sil_scores = []

for k in K_RANGE:
    km  = KMeans(n_clusters=k, random_state=42, n_init=10)
    lbl = km.fit_predict(X_scaled)
    inertias.append(km.inertia_)
    sil_scores.append(silhouette_score(X_scaled, lbl, sample_size=min(1000, len(X_scaled))))
    print(f"  k={k}  inertia={km.inertia_:.1f}  silhouette={sil_scores[-1]:.3f}")

best_k = list(K_RANGE)[sil_scores.index(max(sil_scores))]
print(f"\nBest k by silhouette: {best_k}")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
fig.patch.set_facecolor(BG)

ax1.set_facecolor(CARD)
ax1.plot(list(K_RANGE), inertias, color=BLUE, lw=2.5, marker="o", markersize=7, markerfacecolor=AMBER)
ax1.set_xlabel("Number of Clusters (k)", fontsize=10, color=SUB)
ax1.set_ylabel("Inertia (Within-cluster SSE)", fontsize=10, color=SUB)
ax1.set_title("Elbow Method", fontsize=12, fontweight="bold", color=TEXT)
ax1.grid(True, alpha=0.3)

ax2.set_facecolor(CARD)
ax2.plot(list(K_RANGE), sil_scores, color=GREEN, lw=2.5, marker="o", markersize=7, markerfacecolor=AMBER)
ax2.axvline(x=best_k, color=RED, lw=2, linestyle="--", label=f"Best k = {best_k}")
ax2.set_xlabel("Number of Clusters (k)", fontsize=10, color=SUB)
ax2.set_ylabel("Silhouette Score", fontsize=10, color=SUB)
ax2.set_title("Silhouette Score", fontsize=12, fontweight="bold", color=TEXT)
ax2.legend(fontsize=9, framealpha=0.3, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax2.grid(True, alpha=0.3)

plt.suptitle("K-Means: Optimal Cluster Selection", fontsize=14, fontweight="bold", color=TEXT, y=1.02)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/cluster_elbow.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/cluster_elbow.png")

# ── Fit final K-Means with best_k ────────────────────────────────
km_final = KMeans(n_clusters=best_k, random_state=42, n_init=10)
df["cluster"] = km_final.fit_predict(X_scaled)

# Order clusters by mean comfort (high comfort = cluster 0)
cluster_comfort = df.groupby("cluster")["comfort.avg"].mean().sort_values(ascending=False)
comfort_rank    = {old: new for new, old in enumerate(cluster_comfort.index)}
df["cluster"]   = df["cluster"].map(comfort_rank)

print(f"\nCluster sizes:")
for c, cnt in df["cluster"].value_counts().sort_index().items():
    mean_comfort = df[df["cluster"] == c]["comfort.avg"].mean()
    mean_sound   = df[df["cluster"] == c]["sound.avg"].mean()
    print(f"  Cluster {c}: {cnt:,} samples  comfort={mean_comfort:.1f}  sound={mean_sound:.1f}")

# ── 2. PCA Scatter ────────────────────────────────────────────────
print("Generating PCA scatter chart...")
pca   = PCA(n_components=2, random_state=42)
X_pca = pca.fit_transform(X_scaled)
var   = pca.explained_variance_ratio_

fig, ax = plt.subplots(figsize=(10, 7))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

for c in range(best_k):
    mask = df["cluster"] == c
    ax.scatter(X_pca[mask, 0], X_pca[mask, 1],
               color=CLUSTER_COLORS[c], alpha=0.35, s=20, edgecolors="none",
               label=f"Cluster {c}  (n={mask.sum():,})")

# Centroids in PCA space
centers_pca = pca.transform(km_final.cluster_centers_)
# Reorder centroids to match new cluster order
inv_rank = {v: k for k, v in comfort_rank.items()}
for c in range(best_k):
    orig = inv_rank[c]
    ax.scatter(centers_pca[orig, 0], centers_pca[orig, 1],
               color=CLUSTER_COLORS[c], s=200, marker="*",
               edgecolors="white", linewidths=1, zorder=10)

ax.set_xlabel(f"PC1 ({var[0]*100:.1f}% variance)", fontsize=11, color=SUB)
ax.set_ylabel(f"PC2 ({var[1]*100:.1f}% variance)", fontsize=11, color=SUB)
ax.set_title(f"K-Means Clusters (k={best_k}) — PCA Projection",
             fontsize=14, fontweight="bold", color=TEXT, pad=12)
ax.legend(fontsize=10, framealpha=0.3, facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/cluster_scatter.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/cluster_scatter.png")

# ── 3. Cluster Profiles (mean feature values per cluster) ─────────
print("Generating cluster profiles chart...")
feature_labels = ["Sound Avg", "Sound Max", "Temp", "Humidity", "Light", "Comfort"]
means = df.groupby("cluster")[FEATURES].mean()

fig, axes = plt.subplots(1, best_k, figsize=(4 * best_k, 5), sharey=False)
fig.patch.set_facecolor(BG)
if best_k == 1:
    axes = [axes]

cluster_names = []
for c, ax in enumerate(axes):
    ax.set_facecolor(CARD)
    vals = means.loc[c].values
    bars = ax.bar(range(len(feature_labels)), vals,
                  color=CLUSTER_COLORS[c], edgecolor="none", alpha=0.85, width=0.6)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(vals) * 0.02,
                f"{val:.0f}", ha="center", fontsize=9, fontweight="bold", color=TEXT)
    ax.set_xticks(range(len(feature_labels)))
    ax.set_xticklabels(feature_labels, rotation=35, ha="right", fontsize=8, color=TEXT)
    ax.set_ylabel("Mean Value", fontsize=9, color=SUB)

    comfort_val = means.loc[c]["comfort.avg"]
    sound_val   = means.loc[c]["sound.avg"]
    name = (
        "Deep Sleep" if comfort_val >= 75 else
        "Light Sleep" if comfort_val >= 55 else
        "Restless"   if comfort_val >= 35 else
        "Distressed"
    )
    cluster_names.append(name)
    ax.set_title(f"Cluster {c}\n{name}", fontsize=11, fontweight="bold",
                 color=CLUSTER_COLORS[c])
    ax.grid(True, alpha=0.3, axis="y")

plt.suptitle("Cluster Profiles — Mean Feature Values", fontsize=14,
             fontweight="bold", color=TEXT, y=1.04)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/cluster_profiles.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/cluster_profiles.png")

# ── 4. Cluster Distribution Over Time ────────────────────────────
print("Generating cluster timeline chart...")
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
fig.patch.set_facecolor(BG)

# Top: scatter over time
ax1.set_facecolor(CARD)
for c in range(best_k):
    mask = df["cluster"] == c
    ax1.scatter(df.loc[mask, "minutes"], df.loc[mask, "comfort.avg"],
                color=CLUSTER_COLORS[c], s=12, alpha=0.5, edgecolors="none",
                label=f"Cluster {c}: {cluster_names[c]}")
ax1.set_ylabel("Comfort Score", fontsize=10, color=SUB)
ax1.set_title("Cluster Assignment Over Time", fontsize=13, fontweight="bold", color=TEXT)
ax1.legend(fontsize=9, framealpha=0.3, facecolor=CARD, edgecolor="#2A2E4A",
           labelcolor=TEXT, ncol=best_k)
ax1.grid(True, alpha=0.3)

# Bottom: stacked area — cluster proportion per time bin
ax2.set_facecolor(CARD)
n_bins = 40
df["time_bin"] = pd.cut(df["minutes"], bins=n_bins, labels=False)
bin_counts = df.groupby(["time_bin", "cluster"]).size().unstack(fill_value=0)
bin_counts  = bin_counts.div(bin_counts.sum(axis=1), axis=0)  # normalise to %
bin_mins    = df.groupby("time_bin")["minutes"].mean()

bottom = np.zeros(len(bin_counts))
for c in range(best_k):
    if c in bin_counts.columns:
        vals = bin_counts[c].values
        ax2.bar(bin_counts.index, vals, bottom=bottom,
                color=CLUSTER_COLORS[c], alpha=0.8, width=0.8, label=f"Cluster {c}")
        bottom += vals

ax2.set_ylabel("Cluster Proportion", fontsize=10, color=SUB)
ax2.set_xlabel("Time (bin index)", fontsize=10, color=SUB)
ax2.set_ylim(0, 1)
ax2.grid(True, alpha=0.3, axis="y")

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/cluster_time.png", dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {OUT_DIR}/cluster_time.png")

# ── Summary ──────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"  Clustering Complete — k={best_k}  silhouette={max(sil_scores):.3f}")
print(f"  4 charts saved to {OUT_DIR}/")
print("  cluster_elbow.png  cluster_scatter.png")
print("  cluster_profiles.png  cluster_time.png")
print("=" * 60)

# Save cluster names for reference
meta = {
    "k": best_k,
    "silhouette": round(max(sil_scores), 4),
    "cluster_names": {str(c): cluster_names[c] for c in range(best_k)},
    "cluster_sizes": df["cluster"].value_counts().sort_index().to_dict(),
}
import json
with open("model/cluster_meta.json", "w") as f:
    json.dump(meta, f, indent=2)
print("\n  Metadata saved: model/cluster_meta.json")
