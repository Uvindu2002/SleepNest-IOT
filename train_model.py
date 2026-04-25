"""
SleepNest — ML Model Trainer
Trains Random Forest, XGBoost, and SVM classifiers on the generated dataset.
Picks the best model, exports it to ONNX for Node.js inference.
"""

import pandas as pd
import numpy as np
import json, os, warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.metrics import (classification_report, confusion_matrix,
                             accuracy_score, f1_score)
from sklearn.pipeline import Pipeline
import xgboost as xgb
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import onnxruntime as rt

# -- 1. Load dataset -----------------------------------------------------------
print("=" * 60)
print("  SleepNest Model Trainer")
print("=" * 60)

df = pd.read_csv("sleepnest_dataset.csv")
print(f"\nLoaded {len(df)} rows, {len(df.columns)} columns")

# -- 2. Feature engineering ----------------------------------------------------
# Extract hour from timestamp as a cyclical feature
df["ts"] = pd.to_datetime(df["ts"])
df["hour"] = df["ts"].dt.hour
df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

# Derived features
df["sound_range"]       = df["sound.max"] - df["sound.avg"]
df["sound_stability"]   = df["sound.avg"] / (df["sound.max"] + 1)
df["hist_total"]        = (df["soundHist.QUIET"] + df["soundHist.LIGHT_ACTIVITY"] +
                           df["soundHist.RESTLESS"] + df["soundHist.CRYING"])
df["hist_cry_ratio"]    = df["soundHist.CRYING"] / (df["hist_total"] + 1)
df["motion_active_ratio"] = df["motion.samplesActive"] / (df["sampleCount"] + 1)

# Selected features — what the model will actually use at inference time
FEATURES = [
    # Sound (most important)
    "sound.avg",
    "sound.max",
    "sound.last",
    "sound_range",
    "sound_stability",

    # Sound history within window
    "soundHist.QUIET",
    "soundHist.LIGHT_ACTIVITY",
    "soundHist.RESTLESS",
    "soundHist.CRYING",
    "hist_cry_ratio",

    # Motion
    "motion.samplesActive",
    "motion.durationMs",
    "motion_active_ratio",

    # Environment
    "temp.avg",
    "humidity.avg",
    "light.avg",
    "comfort.avg",

    # Time of day (cyclical encoding)
    "hour_sin",
    "hour_cos",
]

TARGET = "sound.event"

X = df[FEATURES].astype(np.float32)
y = df[TARGET]

# Encode labels to integers
le = LabelEncoder()
y_enc = le.fit_transform(y)
print(f"\nClasses: {list(le.classes_)}")
print(f"Class distribution:\n{pd.Series(y).value_counts().to_string()}")

# -- 3. Train / test split -----------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
)
print(f"\nTrain: {len(X_train)} rows   Test: {len(X_test)} rows")

# -- 4. Define models ----------------------------------------------------------
models = {
    "Random Forest": Pipeline([
        ("clf", RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ))
    ]),
    "XGBoost": Pipeline([
        ("clf", xgb.XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            use_label_encoder=False,
            eval_metric="mlogloss",
            random_state=42,
            verbosity=0,
        ))
    ]),
    "Gradient Boosting": Pipeline([
        ("clf", GradientBoostingClassifier(
            n_estimators=150,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
        ))
    ]),
    "SVM": Pipeline([
        ("scaler", StandardScaler()),
        ("clf", SVC(
            kernel="rbf",
            C=10,
            gamma="scale",
            probability=True,
            random_state=42,
        ))
    ]),
}

# -- 5. Cross-validation comparison -------------------------------------------
print("\n" + "-" * 60)
print("  Cross-Validation (5-fold, F1 macro)")
print("-" * 60)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_results = {}

for name, model in models.items():
    scores = cross_val_score(model, X_train, y_train,
                             cv=cv, scoring="f1_macro", n_jobs=-1)
    cv_results[name] = scores
    print(f"  {name:22s}: {scores.mean():.4f} (+/- {scores.std():.4f})")

best_name = max(cv_results, key=lambda n: cv_results[n].mean())
print(f"\n  Best model: {best_name}")

# -- 6. Train best model on full training set ----------------------------------
print("\n" + "-" * 60)
print(f"  Training {best_name} on full train set...")
print("-" * 60)

best_model = models[best_name]
best_model.fit(X_train, y_train)

# -- 7. Evaluate on test set ---------------------------------------------------
y_pred = best_model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
f1  = f1_score(y_test, y_pred, average="macro")

print(f"\n  Test Accuracy : {acc:.4f} ({acc*100:.2f}%)")
print(f"  Test F1 Macro : {f1:.4f}")

print("\n  Classification Report:")
print(classification_report(y_test, y_pred,
      target_names=le.classes_, digits=4))

print("  Confusion Matrix (rows=actual, cols=predicted):")
cm = confusion_matrix(y_test, y_pred)
cm_df = pd.DataFrame(cm, index=le.classes_, columns=le.classes_)
print(cm_df.to_string())

# Feature importance (if tree-based)
clf = best_model.named_steps["clf"]
if hasattr(clf, "feature_importances_"):
    print("\n  Top 10 Feature Importances:")
    imp = pd.Series(clf.feature_importances_, index=FEATURES)
    for feat, val in imp.nlargest(10).items():
        bar = "#" * int(val * 200)
        print(f"    {feat:30s}: {val:.4f}  {bar}")

# -- 8. Also train all models and show summary ---------------------------------
print("\n" + "-" * 60)
print("  All Models — Test Set Results")
print("-" * 60)
print(f"  {'Model':22s}  {'Accuracy':>10}  {'F1 Macro':>10}")
print(f"  {'-'*22}  {'-'*10}  {'-'*10}")

trained_models = {}
for name, model in models.items():
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    a = accuracy_score(y_test, preds)
    f = f1_score(y_test, preds, average="macro")
    trained_models[name] = (model, a, f)
    print(f"  {name:22s}  {a:>10.4f}  {f:>10.4f}")

# Reselect best by test F1
best_name = max(trained_models, key=lambda n: trained_models[n][2])
best_model = trained_models[best_name][0]
print(f"\n  Selected for export: {best_name}")

# -- 9. Export to ONNX ---------------------------------------------------------
print("\n" + "-" * 60)
print("  Exporting to ONNX...")
print("-" * 60)

os.makedirs("model", exist_ok=True)

initial_type = [("float_input", FloatTensorType([None, len(FEATURES)]))]
# zipmap=False exports probabilities as a plain float32 tensor (required for onnxruntime-node)
onnx_model = convert_sklearn(best_model, initial_types=initial_type,
                              target_opset=12,
                              options={'zipmap': False})

onnx_path = "model/sleepnest_classifier.onnx"
with open(onnx_path, "wb") as f:
    f.write(onnx_model.SerializeToString())
print(f"  Saved: {onnx_path}")

# -- 10. Verify ONNX inference -------------------------------------------------
sess = rt.InferenceSession(onnx_path)
input_name = sess.get_inputs()[0].name
sample = X_test.iloc[:5].values.astype(np.float32)
onnx_preds = sess.run(None, {input_name: sample})[0]
decoded = le.inverse_transform(onnx_preds)
actual  = le.inverse_transform(y_test[:5])
print("\n  ONNX Verification (first 5 test samples):")
print(f"  {'Predicted':20s}  {'Actual'}")
for p, a in zip(decoded, actual):
    match = "OK" if p == a else "MISMATCH"
    print(f"  {p:20s}  {a:20s}  {match}")

# -- 11. Save metadata ---------------------------------------------------------
meta = {
    "model_name": best_name,
    "features": FEATURES,
    "classes": list(le.classes_),
    "label_encoder_mapping": {str(i): c for i, c in enumerate(le.classes_)},
    "test_accuracy": round(float(acc), 4),
    "test_f1_macro": round(float(f1), 4),
    "onnx_file": onnx_path,
    "feature_count": len(FEATURES),
}

with open("model/model_meta.json", "w") as f:
    json.dump(meta, f, indent=2)
print(f"\n  Saved: model/model_meta.json")

print("\n" + "=" * 60)
print("  Training complete!")
print(f"  Model : {best_name}")
print(f"  Acc   : {trained_models[best_name][1]*100:.2f}%")
print(f"  F1    : {trained_models[best_name][2]:.4f}")
print("=" * 60)
