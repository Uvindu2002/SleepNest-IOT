'use strict';
/**
 * db/mongo.js
 * MongoDB connection singleton + index setup for SleepNest
 *
 * Collections:
 *  readings      – 30s-batched sensor docs, TTL 7 days
 *  events        – state-change events (motion start, sound alert), permanent
 *  hourly_stats  – hourly aggregated summary, permanent (upsert)
 *  devices_meta  – one doc per device (upsert on connect)
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME   = process.env.MONGO_DB  || 'sleepnest';

// TTL for raw readings (seconds)
const READINGS_TTL_DAYS = 7;
const READINGS_TTL_SEC  = READINGS_TTL_DAYS * 24 * 3600;

let _client = null;
let _db     = null;

/**
 * Connect once; reuse the same client for the lifetime of the process.
 * Call this at server startup before anything else.
 */
async function connectMongo() {
  if (_db) return _db;

  _client = new MongoClient(MONGO_URI, {
    maxPoolSize:                10,
    serverSelectionTimeoutMS:   5_000,
    socketTimeoutMS:           45_000,
    connectTimeoutMS:           5_000,
  });

  await _client.connect();
  _db = _client.db(DB_NAME);

  await _setupIndexes(_db);
  console.log(`[MongoDB] ✅ Connected → ${MONGO_URI}/${DB_NAME}`);
  return _db;
}

/**
 * Return the already-connected db instance.
 * Throws if connectMongo() was never called.
 */
function getDb() {
  if (!_db) throw new Error('[MongoDB] Not connected — call connectMongo() first');
  return _db;
}

/**
 * Gracefully close the connection (useful in tests / process shutdown).
 */
async function closeMongo() {
  if (_client) {
    await _client.close();
    _client = null;
    _db     = null;
    console.log('[MongoDB] Connection closed');
  }
}

// ─────────────────────────────────────────────────────────────────
// Index setup
// ─────────────────────────────────────────────────────────────────
async function _setupIndexes(db) {
  // ── readings ──────────────────────────────────────────────────
  // TTL: auto-delete after 7 days
  await db.collection('readings').createIndex(
    { ts: 1 },
    { expireAfterSeconds: READINGS_TTL_SEC, background: true }
  );
  // Query: by device, newest first
  await db.collection('readings').createIndex(
    { deviceId: 1, ts: -1 },
    { background: true }
  );

  // ── events ────────────────────────────────────────────────────
  // Query: by device and time; no TTL (keep all events)
  await db.collection('events').createIndex(
    { deviceId: 1, ts: -1 },
    { background: true }
  );
  await db.collection('events').createIndex(
    { category: 1, ts: -1 },
    { background: true }
  );

  // ── hourly_stats ──────────────────────────────────────────────
  // Unique per device+hour so upsert is safe
  await db.collection('hourly_stats').createIndex(
    { deviceId: 1, hour: 1 },
    { unique: true, background: true }
  );

  // ── devices_meta ──────────────────────────────────────────────
  await db.collection('devices_meta').createIndex(
    { deviceId: 1 },
    { unique: true, background: true }
  );

  console.log('[MongoDB] Indexes ready');
}

module.exports = { connectMongo, getDb, closeMongo };
