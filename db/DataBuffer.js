'use strict';
/**
 * db/DataBuffer.js
 * ─────────────────────────────────────────────────────────────────
 * Rate-limit-safe batch writer for SleepNest sensor readings.
 *
 * PROBLEM: ESP32 sends data every ~2 s → 1 800 writes/hour if we
 *          write every packet to MongoDB.
 *
 * SOLUTION:
 *   1. Buffer every incoming reading in memory.
 *   2. Every FLUSH_INTERVAL ms (default 30 s) write ONE aggregated
 *      document per device → 120 writes/hour (15× reduction).
 *   3. Write to the `events` collection only on state-change edges
 *      (motion start, sound-event escalation) — not every packet.
 *
 * Schema of a flushed `readings` document:
 * {
 *   deviceId,  ts (Date),  sampleCount,
 *   temp:    { avg, min, max, last },
 *   humidity:{ avg, min, max, last },
 *   sound:   { avg, max, last, event (most-frequent) },
 *   comfort: { avg, last },
 *   motion:  { samplesActive, durationMs (last known) },
 *   light:   { avg, last },
 *   soundHist: { QUIET, LIGHT_ACTIVITY, RESTLESS, CRYING },
 *   lastRaw  (full last reading snapshot for quick display)
 * }
 */

const { getDb } = require('./mongo');

const FLUSH_INTERVAL_MS = 30_000; // 30 seconds

// ─────────────────────────────────────────────────────────────────
// Comfort score — mirrors the formula in frontend/src/utils/comfort.js
// so the server can compute a real value without depending on the UI.
//
//   temp ideal = 20°C  (penalty: 8 pts per °C away)
//   humidity ideal = 50%  (penalty: 2.5 pts per % away)
//   sound: linear 0-100 mapped from 0-1023
//   weights: temp 35%, humidity 25%, sound 40%
// ─────────────────────────────────────────────────────────────────
function calcComfort(temp, humidity, soundLevel) {
  if (temp == null) return null;
  const tempScore  = Math.max(0, 100 - Math.abs(temp - 20) * 8);
  const humScore   = humidity != null ? Math.max(0, 100 - Math.abs(humidity - 50) * 2.5) : 60;
  const soundScore = Math.max(0, 100 - ((soundLevel ?? 0) / 1023) * 100);
  return Math.round(tempScore * 0.35 + humScore * 0.25 + soundScore * 0.40);
}

class DataBuffer {
  constructor() {
    /** @type {Map<string, object[]>} deviceId → buffered readings */
    this._buffers   = new Map();
    /** @type {Map<string, {soundEvent:string, motion:number}>} last known state per device */
    this._lastState = new Map();
    this._timer     = null;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  start() {
    if (this._timer) return; // already running
    this._timer = setInterval(() => this._flushAll(), FLUSH_INTERVAL_MS);
    console.log(`[DataBuffer] Started — batch flush every ${FLUSH_INTERVAL_MS / 1000}s`);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Call this to flush remaining data before shutting down. */
  async drain() {
    this.stop();
    await this._flushAll();
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Push one incoming sensor reading into the buffer.
   * @param {string} deviceId
   * @param {object} reading  – normalised sensor object from server.js
   */
  push(deviceId, reading) {
    if (!this._buffers.has(deviceId)) this._buffers.set(deviceId, []);
    this._buffers.get(deviceId).push({ ...reading, _bufferedAt: Date.now() });
    this._detectEvents(deviceId, reading);
  }

  // ── Event detection (edge-triggered, not level-triggered) ───────

  _detectEvents(deviceId, reading) {
    const prev  = this._lastState.get(deviceId) || {};
    const db    = getDb();
    const now   = new Date();

    // ── Sound event escalation ──────────────────────────────────
    const soundEvent = reading.sound_event || 'QUIET';
    if (soundEvent !== prev.soundEvent) {
      // Only persist non-QUIET events (or transitions back to QUIET after alert)
      if (soundEvent !== 'QUIET' || prev.soundEvent === 'CRYING' || prev.soundEvent === 'RESTLESS') {
        db.collection('events').insertOne({
          deviceId,
          ts:         now,
          category:   'sound',
          type:       soundEvent,
          prevType:   prev.soundEvent || 'QUIET',
          soundLevel: reading.sound_level  ?? 0,
          soundDiff:  reading.sound_diff   ?? 0,
          db:         reading.sound_db     ?? 0,
        }).catch(err => console.error('[DataBuffer] events insert error:', err.message));
      }
    }

    // ── Motion rising edge ──────────────────────────────────────
    const motion = reading.motion ?? 0;
    if (motion === 1 && prev.motion !== 1) {
      db.collection('events').insertOne({
        deviceId,
        ts:       now,
        category: 'motion',
        type:     'MOTION_START',
        light:    reading.light ?? null,
      }).catch(err => console.error('[DataBuffer] events insert error:', err.message));
    }

    // ── Motion falling edge (end of motion) ─────────────────────
    if (motion === 0 && prev.motion === 1) {
      db.collection('events').insertOne({
        deviceId,
        ts:           now,
        category:     'motion',
        type:         'MOTION_END',
        durationMs:   reading.motion_duration ?? 0,
      }).catch(err => console.error('[DataBuffer] events insert error:', err.message));
    }

    this._lastState.set(deviceId, { soundEvent, motion });
  }

  // ── Batch flush ─────────────────────────────────────────────────

  async _flushAll() {
    const promises = [];
    for (const [deviceId, readings] of this._buffers.entries()) {
      if (readings.length === 0) continue;
      // Swap buffer immediately so incoming data during flush goes to new array
      this._buffers.set(deviceId, []);
      promises.push(this._flushDevice(deviceId, readings));
    }
    await Promise.allSettled(promises);
  }

  async _flushDevice(deviceId, readings) {
    if (!readings.length) return;
    const db = getDb();

    // ── Helper stat functions ──────────────────────────────────
    const vals = (key) => readings.map(r => r[key]).filter(v => v != null && !isNaN(v));
    const avg  = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const min  = (arr) => arr.length ? Math.min(...arr) : null;
    const max  = (arr) => arr.length ? Math.max(...arr) : null;

    const temps  = vals('temperature');
    const hums   = vals('humidity');
    const sounds = vals('sound_level');
    const lights = vals('light');

    // Compute comfort for every reading server-side (frontend value is always null)
    const comforts = readings.map(r =>
      calcComfort(r.temperature, r.humidity, r.sound_level)
    ).filter(v => v != null);

    // Most-frequent sound event in this window
    const eventCounts = readings.reduce((acc, r) => {
      const e = r.sound_event || 'QUIET';
      acc[e] = (acc[e] || 0) + 1;
      return acc;
    }, {});
    const dominantEvent = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'QUIET';

    // Motion stats
    const motionSamples = readings.filter(r => (r.motion ?? 0) === 1).length;
    const lastMotionDur = readings
      .filter(r => r.motion_duration != null)
      .at(-1)?.motion_duration ?? 0;

    const lastRaw = readings.at(-1);

    const doc = {
      deviceId,
      ts:          new Date(),
      sampleCount: readings.length,

      temp: {
        avg: avg(temps)  != null ? +avg(temps).toFixed(2)  : null,
        min: min(temps),
        max: max(temps),
        last: temps.at(-1) ?? null,
      },
      humidity: {
        avg: avg(hums) != null ? +avg(hums).toFixed(2)   : null,
        min: min(hums),
        max: max(hums),
        last: hums.at(-1) ?? null,
      },
      sound: {
        avg:   avg(sounds) != null ? +avg(sounds).toFixed(1) : null,
        max:   max(sounds),
        last:  sounds.at(-1) ?? null,
        event: dominantEvent,
      },
      comfort: {
        avg:  avg(comforts) != null ? +avg(comforts).toFixed(1) : null,
        last: comforts.at(-1) ?? null,
      },
      motion: {
        samplesActive: motionSamples,
        durationMs:    lastMotionDur,
      },
      light: {
        avg:  avg(lights) != null ? +avg(lights).toFixed(1) : null,
        last: lights.at(-1) ?? null,
      },
      soundHist: {
        QUIET:          eventCounts['QUIET']          || 0,
        LIGHT_ACTIVITY: eventCounts['LIGHT_ACTIVITY'] || 0,
        RESTLESS:       eventCounts['RESTLESS']       || 0,
        CRYING:         eventCounts['CRYING']         || 0,
      },
      // Last raw snapshot — used by /api/history for quick "what happened"
      lastRaw: lastRaw ? {
        temperature:     lastRaw.temperature,
        humidity:        lastRaw.humidity,
        sound_level:     lastRaw.sound_level,
        sound_event:     lastRaw.sound_event,
        motion:          lastRaw.motion,
        motion_duration: lastRaw.motion_duration,
        light:           lastRaw.light,
        // Always compute comfort server-side (never rely on null from frontend)
        comfort: calcComfort(lastRaw.temperature, lastRaw.humidity, lastRaw.sound_level),
      } : null,
    };

    await db.collection('readings').insertOne(doc)
      .catch(err => console.error('[DataBuffer] readings insert error:', err.message));
  }
}

// Export singleton
const dataBuffer = new DataBuffer();
module.exports = { dataBuffer };
