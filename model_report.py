"""
SleepNest — Model Evaluation Report Generator
Generates a full visual report for supervisor presentation.

Outputs (saved to model/report/):
  1. confusion_matrix.png      - Heatmap of predictions vs actual
  2. feature_importance.png    - Top features ranked by importance
  3. class_distribution.png   - Dataset class balance
  4. roc_curves.png            - ROC curve per class (one-vs-rest)
  5. cv_scores.png             - Cross-validation scores per model
  6. classification_report.png - Precision / Recall / F1 table
  7. summary.png               - One-page summary card
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import FancyBboxPatch
import seaborn as sns
import json, os, warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler, label_binarize
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.metrics import (classification_report, confusion_matrix,
                             accuracy_score, f1_score, roc_curve, auc)
from sklearn.pipeline import Pipeline
import xgboost as xgb

# ── Style ─────────────────────────────────────────────────────────────────────
PALETTE   = ["#3B9E72", "#5A52E0", "#F59E0B", "#EF4444"]
BG        = "#0F1117"
CARD      = "#1E2236"
TEXT      = "#E2E8F0"
SUBTEXT   = "#94A3B8"
ACCENT    = "#3B9E72"
sns.set_theme(style="darkgrid")
plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": CARD,
    "axes.edgecolor": "#2A2E4A", "axes.labelcolor": TEXT,
    "xtick.color": SUBTEXT, "ytick.color": SUBTEXT,
    "text.color": TEXT, "grid.color": "#2A2E4A",
    "font.family": "DejaVu Sans",
})

OUT_DIR = "model/report"
os.makedirs(OUT_DIR, exist_ok=True)

CLASS_COLORS = {
    "CRYING":         "#EF4444",
    "RESTLESS":       "#F59E0B",
    "LIGHT_ACTIVITY": "#5A52E0",
    "QUIET":          "#3B9E72",
}

print("=" * 60)
print("  SleepNest — Model Report Generator")
print("=" * 60)

# ── 1. Load & prepare data ────────────────────────────────────────────────────
df = pd.read_csv("sleepnest_dataset.csv")
df["ts"] = pd.to_datetime(df["ts"])
df["hour"]     = df["ts"].dt.hour
df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
df["sound_range"]        = df["sound.max"] - df["sound.avg"]
df["sound_stability"]    = df["sound.avg"] / (df["sound.max"] + 1)
df["hist_total"]         = (df["soundHist.QUIET"] + df["soundHist.LIGHT_ACTIVITY"] +
                            df["soundHist.RESTLESS"] + df["soundHist.CRYING"])
df["hist_cry_ratio"]     = df["soundHist.CRYING"] / (df["hist_total"] + 1)
df["motion_active_ratio"] = df["motion.samplesActive"] / (df["sampleCount"] + 1)

FEATURES = [
    "sound.avg", "sound.max", "sound.last", "sound_range", "sound_stability",
    "soundHist.QUIET", "soundHist.LIGHT_ACTIVITY", "soundHist.RESTLESS",
    "soundHist.CRYING", "hist_cry_ratio",
    "motion.samplesActive", "motion.durationMs", "motion_active_ratio",
    "temp.avg", "humidity.avg", "light.avg", "comfort.avg",
    "hour_sin", "hour_cos",
]
FEATURE_LABELS = [
    "Sound Avg", "Sound Max", "Sound Last", "Sound Range", "Sound Stability",
    "Hist: Quiet", "Hist: Light Act.", "Hist: Restless", "Hist: Crying", "Cry Ratio",
    "Motion Samples", "Motion Duration", "Motion Ratio",
    "Temperature", "Humidity", "Light", "Comfort",
    "Hour Sin", "Hour Cos",
]

TARGET = "sound.event"
X = df[FEATURES].astype(np.float32)
y = df[TARGET]

le = LabelEncoder()
y_enc = le.fit_transform(y)
CLASSES = list(le.classes_)

X_train, X_test, y_train, y_test = train_test_split(
    X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
)

print(f"\nDataset   : {len(df):,} rows | {len(FEATURES)} features")
print(f"Train/Test: {len(X_train):,} / {len(X_test):,}")
print(f"Classes   : {CLASSES}")

# ── 2. Define & train models ──────────────────────────────────────────────────
models = {
    "Random Forest": Pipeline([("clf", RandomForestClassifier(
        n_estimators=200, max_depth=12, min_samples_leaf=2, random_state=42, n_jobs=-1))]),
    "XGBoost": Pipeline([("clf", xgb.XGBClassifier(
        n_estimators=200, max_depth=6, learning_rate=0.1,
        use_label_encoder=False, eval_metric="mlogloss", random_state=42, verbosity=0))]),
    "Gradient Boosting": Pipeline([("clf", GradientBoostingClassifier(
        n_estimators=150, max_depth=5, learning_rate=0.1, random_state=42))]),
    "SVM": Pipeline([("scaler", StandardScaler()), ("clf", SVC(
        kernel="rbf", C=10, gamma="scale", probability=True, random_state=42))]),
}

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_results  = {}
test_results = {}

print("\nTraining models...")
for name, model in models.items():
    scores = cross_val_score(model, X_train, y_train, cv=cv,
                             scoring="f1_macro", n_jobs=-1)
    cv_results[name] = scores
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    f1  = f1_score(y_test, preds, average="macro")
    test_results[name] = {"model": model, "preds": preds, "acc": acc, "f1": f1}
    print(f"  {name:22s}: CV={scores.mean():.4f}  Test Acc={acc:.4f}  F1={f1:.4f}")

best_name  = max(test_results, key=lambda n: test_results[n]["f1"])
best       = test_results[best_name]
best_model = best["model"]
best_preds = best["preds"]
print(f"\nBest model: {best_name} ({best['acc']*100:.2f}% accuracy)")

# ── 3. Confusion Matrix ───────────────────────────────────────────────────────
print("\nGenerating confusion matrix...")
cm = confusion_matrix(y_test, best_preds)
cm_pct = cm.astype(float) / cm.sum(axis=1, keepdims=True) * 100

fig, ax = plt.subplots(figsize=(8, 6))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

sns.heatmap(cm_pct, annot=False, fmt=".1f", cmap="YlOrRd",
            xticklabels=CLASSES, yticklabels=CLASSES,
            linewidths=1, linecolor="#0F1117", ax=ax,
            cbar_kws={"shrink": 0.8})

# Add text annotations
for i in range(len(CLASSES)):
    for j in range(len(CLASSES)):
        count = cm[i, j]
        pct   = cm_pct[i, j]
        color = "white" if pct > 40 else TEXT
        ax.text(j + 0.5, i + 0.4, f"{count}",
                ha="center", va="center", fontsize=13, fontweight="bold", color=color)
        ax.text(j + 0.5, i + 0.65, f"({pct:.1f}%)",
                ha="center", va="center", fontsize=8, color=color, alpha=0.8)

ax.set_title(f"Confusion Matrix — {best_name}", fontsize=14, fontweight="bold",
             color=TEXT, pad=15)
ax.set_xlabel("Predicted Label", fontsize=11, color=SUBTEXT, labelpad=10)
ax.set_ylabel("True Label", fontsize=11, color=SUBTEXT, labelpad=10)
ax.tick_params(colors=TEXT, labelsize=10)

plt.tight_layout()
path = f"{OUT_DIR}/confusion_matrix.png"
plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {path}")

# ── 4. Feature Importance ─────────────────────────────────────────────────────
print("Generating feature importance chart...")
clf = best_model.named_steps["clf"]

if hasattr(clf, "feature_importances_"):
    importances = clf.feature_importances_
else:
    # SVM fallback — use absolute coef mean
    importances = np.abs(clf.coef_).mean(axis=0)

imp_df = pd.DataFrame({"feature": FEATURE_LABELS, "importance": importances})
imp_df = imp_df.sort_values("importance", ascending=True)

fig, ax = plt.subplots(figsize=(9, 7))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

colors = [ACCENT if v >= imp_df["importance"].quantile(0.7) else "#5A52E0"
          for v in imp_df["importance"]]
bars = ax.barh(imp_df["feature"], imp_df["importance"] * 100,
               color=colors, edgecolor="none", height=0.65)

for bar, val in zip(bars, imp_df["importance"]):
    ax.text(val * 100 + 0.1, bar.get_y() + bar.get_height() / 2,
            f"{val*100:.2f}%", va="center", fontsize=8, color=SUBTEXT)

ax.set_title(f"Feature Importance — {best_name}", fontsize=14,
             fontweight="bold", color=TEXT, pad=15)
ax.set_xlabel("Importance (%)", fontsize=11, color=SUBTEXT)
ax.tick_params(axis="y", labelsize=9, colors=TEXT)
ax.tick_params(axis="x", colors=SUBTEXT)
ax.set_xlim(0, imp_df["importance"].max() * 130)

plt.tight_layout()
path = f"{OUT_DIR}/feature_importance.png"
plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {path}")

# ── 5. Class Distribution ─────────────────────────────────────────────────────
print("Generating class distribution chart...")
dist = y.value_counts()

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 5))
fig.patch.set_facecolor(BG)
for ax in (ax1, ax2):
    ax.set_facecolor(CARD)

# Pie
pie_colors = [CLASS_COLORS.get(c, "#888") for c in dist.index]
wedges, texts, autotexts = ax1.pie(
    dist.values, labels=dist.index, colors=pie_colors,
    autopct="%1.1f%%", startangle=140,
    wedgeprops={"edgecolor": BG, "linewidth": 2},
    textprops={"color": TEXT, "fontsize": 10},
)
for at in autotexts:
    at.set_fontsize(9)
    at.set_color(BG)
    at.set_fontweight("bold")
ax1.set_title("Class Distribution (pie)", fontsize=12, fontweight="bold", color=TEXT)

# Bar
bar_colors = [CLASS_COLORS.get(c, "#888") for c in dist.index]
bars = ax2.bar(dist.index, dist.values, color=bar_colors, edgecolor="none", width=0.5)
for bar, val in zip(bars, dist.values):
    ax2.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 20,
             f"{val:,}", ha="center", va="bottom", fontsize=10,
             fontweight="bold", color=TEXT)
ax2.set_title("Class Distribution (count)", fontsize=12, fontweight="bold", color=TEXT)
ax2.set_ylabel("Samples", color=SUBTEXT)
ax2.tick_params(colors=TEXT)
ax2.set_ylim(0, dist.max() * 1.15)

plt.suptitle("Dataset Class Balance", fontsize=14, fontweight="bold",
             color=TEXT, y=1.02)
plt.tight_layout()
path = f"{OUT_DIR}/class_distribution.png"
plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {path}")

# ── 6. ROC Curves ────────────────────────────────────────────────────────────
print("Generating ROC curves...")
y_test_bin = label_binarize(y_test, classes=range(len(CLASSES)))
y_prob = best_model.predict_proba(X_test)

fig, ax = plt.subplots(figsize=(8, 6))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

for i, cls in enumerate(CLASSES):
    fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_prob[:, i])
    roc_auc = auc(fpr, tpr)
    color = list(CLASS_COLORS.values())[i]
    ax.plot(fpr, tpr, color=color, lw=2,
            label=f"{cls} (AUC = {roc_auc:.3f})")

ax.plot([0, 1], [0, 1], color="#2A2E4A", lw=1.5, linestyle="--", label="Random")
ax.set_xlim([-0.01, 1.01])
ax.set_ylim([-0.01, 1.05])
ax.set_xlabel("False Positive Rate", fontsize=11, color=SUBTEXT)
ax.set_ylabel("True Positive Rate", fontsize=11, color=SUBTEXT)
ax.set_title(f"ROC Curves (One-vs-Rest) — {best_name}", fontsize=14,
             fontweight="bold", color=TEXT, pad=15)
ax.legend(loc="lower right", fontsize=10, framealpha=0.2,
          facecolor=CARD, edgecolor="#2A2E4A", labelcolor=TEXT)
ax.tick_params(colors=SUBTEXT)

plt.tight_layout()
path = f"{OUT_DIR}/roc_curves.png"
plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {path}")

# ── 7. Cross-Validation Scores ───────────────────────────────────────────────
print("Generating CV scores chart...")
fig, ax = plt.subplots(figsize=(9, 5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(CARD)

model_names = list(cv_results.keys())
positions   = np.arange(len(model_names))
colors_cv   = [ACCENT, "#5A52E0", "#F59E0B", "#EF4444"]

for i, (name, scores) in enumerate(cv_results.items()):
    ax.bar(i, scores.mean(), color=colors_cv[i], width=0.5,
           edgecolor="none", alpha=0.9, label=name)
    ax.errorbar(i, scores.mean(), yerr=scores.std(),
                fmt="none", color="white", capsize=6, lw=2)
    ax.text(i, scores.mean() + scores.std() + 0.003,
            f"{scores.mean()*100:.2f}%",
            ha="center", fontsize=11, fontweight="bold", color=TEXT)

ax.set_xticks(positions)
ax.set_xticklabels(model_names, fontsize=10, color=TEXT)
ax.set_ylabel("F1 Macro Score", fontsize=11, color=SUBTEXT)
ax.set_ylim(0.8, 1.02)
ax.set_title("5-Fold Cross-Validation F1 Scores", fontsize=14,
             fontweight="bold", color=TEXT, pad=15)
ax.tick_params(colors=SUBTEXT)
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{v:.0%}"))

plt.tight_layout()
path = f"{OUT_DIR}/cv_scores.png"
plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {path}")

# ── 8. Classification Report Table ───────────────────────────────────────────
print("Generating classification report table...")
report = classification_report(y_test, best_preds,
                               target_names=CLASSES, output_dict=True)

fig, ax = plt.subplots(figsize=(9, 4))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.axis("off")

rows = []
for cls in CLASSES:
    r = report[cls]
    rows.append([cls,
                 f"{r['precision']:.3f}",
                 f"{r['recall']:.3f}",
                 f"{r['f1-score']:.3f}",
                 f"{int(r['support'])}"])
rows.append(["─" * 14, "─" * 9, "─" * 9, "─" * 9, "─" * 8])
rows.append(["Macro Avg",
             f"{report['macro avg']['precision']:.3f}",
             f"{report['macro avg']['recall']:.3f}",
             f"{report['macro avg']['f1-score']:.3f}",
             f"{int(report['macro avg']['support'])}"])

cols = ["Class", "Precision", "Recall", "F1-Score", "Support"]
tbl = ax.table(cellText=rows, colLabels=cols,
               loc="center", cellLoc="center")
tbl.auto_set_font_size(False)
tbl.set_fontsize(11)
tbl.scale(1.2, 2.2)

header_color = "#1A2040"
for j in range(len(cols)):
    tbl[0, j].set_facecolor(ACCENT)
    tbl[0, j].set_text_props(color="white", fontweight="bold")

for i in range(1, len(rows) + 1):
    for j in range(len(cols)):
        tbl[i, j].set_facecolor(CARD if i % 2 == 1 else "#161928")
        tbl[i, j].set_text_props(color=TEXT)
        tbl[i, j].set_edgecolor("#2A2E4A")

ax.set_title(f"Classification Report — {best_name}", fontsize=14,
             fontweight="bold", color=TEXT, pad=20, loc="center")

plt.tight_layout()
path = f"{OUT_DIR}/classification_report.png"
plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {path}")

# ── 9. Summary Card ───────────────────────────────────────────────────────────
print("Generating summary card...")
fig = plt.figure(figsize=(14, 8))
fig.patch.set_facecolor(BG)
gs = gridspec.GridSpec(2, 4, figure=fig, hspace=0.5, wspace=0.4)

# Title
fig.text(0.5, 0.96, "SleepNest — ML Model Report",
         ha="center", va="top", fontsize=18, fontweight="bold", color=TEXT)
fig.text(0.5, 0.91, f"Model: {best_name}  |  Dataset: {len(df):,} samples  |  Features: {len(FEATURES)}",
         ha="center", va="top", fontsize=11, color=SUBTEXT)

# Metric cards (top row)
metrics = [
    ("Test Accuracy",  f"{best['acc']*100:.2f}%",  ACCENT),
    ("F1 Macro",       f"{best['f1']:.4f}",         "#5A52E0"),
    ("CV F1 Mean",     f"{cv_results[best_name].mean()*100:.2f}%", "#F59E0B"),
    ("Training Size",  f"{len(X_train):,}",          "#EF4444"),
]
for col, (title, val, color) in enumerate(metrics):
    ax = fig.add_subplot(gs[0, col])
    ax.set_facecolor(CARD)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    ax.add_patch(FancyBboxPatch((0.05, 0.05), 0.9, 0.9,
                                boxstyle="round,pad=0.05",
                                facecolor=CARD, edgecolor=color, linewidth=2))
    ax.text(0.5, 0.72, title, ha="center", va="center",
            fontsize=9, color=SUBTEXT, fontweight="bold")
    ax.text(0.5, 0.38, val, ha="center", va="center",
            fontsize=20, color=color, fontweight="bold")

# Mini confusion matrix (bottom left)
ax_cm = fig.add_subplot(gs[1, :2])
ax_cm.set_facecolor(CARD)
cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)
sns.heatmap(cm_norm, annot=True, fmt=".2f", cmap="YlOrRd",
            xticklabels=[c[:4] for c in CLASSES],
            yticklabels=[c[:4] for c in CLASSES],
            ax=ax_cm, cbar=False, linewidths=0.5, linecolor=BG,
            annot_kws={"size": 10, "weight": "bold"})
ax_cm.set_title("Confusion Matrix (normalised)", fontsize=10,
                fontweight="bold", color=TEXT)
ax_cm.tick_params(colors=TEXT, labelsize=8)
ax_cm.set_xlabel("Predicted", color=SUBTEXT, fontsize=9)
ax_cm.set_ylabel("Actual", color=SUBTEXT, fontsize=9)

# Mini feature importance (bottom right)
ax_fi = fig.add_subplot(gs[1, 2:])
ax_fi.set_facecolor(CARD)
top5 = imp_df.tail(5)
bar_colors = [ACCENT if v >= imp_df["importance"].quantile(0.7) else "#5A52E0"
              for v in top5["importance"]]
ax_fi.barh(top5["feature"], top5["importance"] * 100,
           color=bar_colors, edgecolor="none", height=0.5)
ax_fi.set_title("Top 5 Features", fontsize=10, fontweight="bold", color=TEXT)
ax_fi.tick_params(axis="y", labelsize=8, colors=TEXT)
ax_fi.tick_params(axis="x", colors=SUBTEXT)
ax_fi.set_xlabel("Importance (%)", color=SUBTEXT, fontsize=8)

plt.subplots_adjust(top=0.88)
path = f"{OUT_DIR}/summary.png"
plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"  Saved: {path}")

# ── Final console summary ─────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  REPORT COMPLETE")
print("=" * 60)
print(f"  Best Model   : {best_name}")
print(f"  Test Accuracy: {best['acc']*100:.2f}%")
print(f"  F1 Macro     : {best['f1']:.4f}")
print(f"  CV F1 Mean   : {cv_results[best_name].mean()*100:.2f}% (+/- {cv_results[best_name].std()*100:.2f}%)")
print(f"\n  Per-class F1:")
for cls in CLASSES:
    print(f"    {cls:16s}: {report[cls]['f1-score']:.4f}")
print(f"\n  Output files in: {OUT_DIR}/")
print(f"    confusion_matrix.png")
print(f"    feature_importance.png")
print(f"    class_distribution.png")
print(f"    roc_curves.png")
print(f"    cv_scores.png")
print(f"    classification_report.png")
print(f"    summary.png")
print("=" * 60)
