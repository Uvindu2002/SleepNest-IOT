'use strict';

/**
 * SleepNest — ML Predictor
 *
 * Loads the trained ONNX Random Forest model and classifies baby state
 * from a rolling 15-sample sensor window per device.
 *
 * Replaces the fixed threshold logic in SoundProcessor.
 * Falls back to threshold classification if model is unavailable.
 */

const ort  = require('onnxruntime-node');
const path = require('path');
const fs   = require('fs');

// ── Constants ────────────────────────────────────────────────────────────────
const MODEL_PATH = path.join(__dirname, '..', 'model', 'sleepnest_classifier.onnx');
const META_PATH  = path.join(__dirname, '..', 'model', 'model_meta.json');
const WINDOW_SIZE = 15;   // matches sampleCount used during training

// Threshold fallback — calibrated for INMP441 ambient noise floor ~50-80
const THRESHOLDS = { QUIET: 150, LIGHT_ACTIVITY: 350, RESTLESS: 600, CRYING: 700 };

// ── Module state ─────────────────────────────────────────────────────────────
let session  = null;   // ort.InferenceSession
let meta     = null;   // model_meta.json
let ready    = false;
let loadError = null;

// Rolling windows: Map<deviceId, SensorWindow>
const windows = new Map();

// ── Load model on module import ───────────────────────────────────────────────
async function loadModel() {
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      throw new Error(`ONNX model not found at ${MODEL_PATH}`);
    }
    session = await ort.InferenceSession.create(MODEL_PATH);
    meta    = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    ready   = true;
    console.log(`[ML] Model loaded: ${meta.model_name} | Features: ${meta.feature_count} | Classes: ${meta.classes.join(', ')}`);
  } catch (err) {
    loadError = err.message;
    console.warn(`[ML] Model unavailable — using threshold fallback. Reason: ${err.message}`);
  }
}

loadModel();

// ── Rolling sensor window ─────────────────────────────────────────────────────
class SensorWindow {
  constructor() {
    this.samples = [];   // array of { sound, temp, humidity, light, comfort, motion, motionDurationMs }
  }

  push(sample) {
    this.samples.push(sample);
    if (this.samples.length > WINDOW_SIZE) {
      this.samples.shift();
    }
  }

  get length() { return this.samples.length; }

  // ── Feature extraction (must match train_model.py exactly) ─────────────────
  buildFeatures(nowMs) {
    const s = this.samples;
    if (s.length === 0) return null;

    const sounds   = s.map(x => x.sound);
    const temps    = s.map(x => x.temp);
    const hums     = s.map(x => x.humidity);
    const lights   = s.map(x => x.light);
    const comforts = s.map(x => x.comfort);

    const soundAvg = avg(sounds);
    const soundMax = Math.max(...sounds);
    const soundLast = s[s.length - 1].sound;
    const soundRange = soundMax - soundAvg;
    const soundStability = soundAvg / (soundMax + 1);

    // soundHist — count samples per category using original thresholds
    const shQuiet = sounds.filter(v => v < THRESHOLDS.QUIET).length;
    const shLA    = sounds.filter(v => v >= THRESHOLDS.QUIET && v < THRESHOLDS.LIGHT_ACTIVITY).length;
    const shRest  = sounds.filter(v => v >= THRESHOLDS.LIGHT_ACTIVITY && v < THRESHOLDS.RESTLESS).length;
    const shCry   = sounds.filter(v => v >= THRESHOLDS.RESTLESS).length;
    const histTotal = shQuiet + shLA + shRest + shCry;
    const histCryRatio = shCry / (histTotal + 1);

    // Motion
    const motionActive = s.filter(x => x.motion === 1).length;
    const motionMs     = s[s.length - 1].motionDurationMs || 0;
    const motionRatio  = motionActive / (s.length + 1);

    // Time of day (cyclical)
    const hour = new Date(nowMs).getHours();
    const hourSin = Math.sin(2 * Math.PI * hour / 24);
    const hourCos = Math.cos(2 * Math.PI * hour / 24);

    // Feature vector — ORDER must match FEATURES list in train_model.py
    return [
      soundAvg, soundMax, soundLast,
      soundRange, soundStability,
      shQuiet, shLA, shRest, shCry,
      histCryRatio,
      motionActive, motionMs, motionRatio,
      avg(temps), avg(hums), avg(lights), avg(comforts),
      hourSin, hourCos,
    ].map(v => (isFinite(v) ? v : 0));
  }
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// ── Threshold fallback ────────────────────────────────────────────────────────
function thresholdClassify(soundLevel) {
  if (soundLevel >= THRESHOLDS.CRYING)        return { event: 'CRYING',         confidence: null, source: 'threshold' };
  if (soundLevel >= THRESHOLDS.RESTLESS)      return { event: 'RESTLESS',       confidence: null, source: 'threshold' };
  if (soundLevel >= THRESHOLDS.LIGHT_ACTIVITY)return { event: 'LIGHT_ACTIVITY', confidence: null, source: 'threshold' };
  return                                             { event: 'QUIET',           confidence: null, source: 'threshold' };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Push a new sensor reading into the device window and return a classification.
 *
 * @param {string} deviceId
 * @param {object} reading  { sound, temp, humidity, light, comfort, motion, motionDurationMs }
 * @returns {{ event, confidence, confidences, source, windowSize }}
 */
async function predict(deviceId, reading) {
  // Ensure window exists
  if (!windows.has(deviceId)) {
    windows.set(deviceId, new SensorWindow());
  }
  const win = windows.get(deviceId);
  win.push(reading);

  // Fallback if model not ready or window too small
  if (!ready || win.length < 3) {
    return { ...thresholdClassify(reading.sound), windowSize: win.length };
  }

  try {
    const features = win.buildFeatures(Date.now());
    if (!features) return { ...thresholdClassify(reading.sound), windowSize: win.length };

    // Run ONNX inference
    const tensor = new ort.Tensor('float32', Float32Array.from(features), [1, features.length]);
    const results = await session.run({ float_input: tensor });

    // Label (integer class index) — key is 'label' or 'output_label'
    const labelKey = results.label ? 'label' : 'output_label';
    const labelIdx = Number(results[labelKey].data[0]);
    const event = meta.classes[labelIdx];

    // Probabilities — exported as flat Float32 tensor with shape [1, numClasses]
    let confidence = null;
    let confidences = null;
    const probKey = Object.keys(results).find(k => k.toLowerCase().includes('prob'));
    if (probKey) {
      const raw   = results[probKey].data;          // Float32Array, length = numClasses
      const probs = Array.from(raw);
      confidence  = Math.round(probs[labelIdx] * 100);
      confidences = Object.fromEntries(
        meta.classes.map((c, i) => [c, Math.round(probs[i] * 100)])
      );
    }

    return { event, confidence, confidences, source: 'model', windowSize: win.length };

  } catch (err) {
    console.warn(`[ML] Inference error for ${deviceId}: ${err.message}`);
    return { ...thresholdClassify(reading.sound), windowSize: win.length };
  }
}

/** Reset the rolling window for a device (call on disconnect/recalibrate) */
function resetWindow(deviceId) {
  windows.delete(deviceId);
}

/** Model status — exposed via /api/ml/status */
function status() {
  return {
    ready,
    model: meta ? meta.model_name : null,
    features: meta ? meta.feature_count : null,
    classes: meta ? meta.classes : null,
    accuracy: meta ? meta.test_accuracy : null,
    error: loadError,
  };
}

module.exports = { predict, resetWindow, status };
