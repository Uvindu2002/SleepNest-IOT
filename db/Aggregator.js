'use strict';
/**
 * db/Aggregator.js
 * ─────────────────────────────────────────────────────────────────
 * Hourly aggregation job — reads the last hour of `readings` docs
 * and upserts one compact summary into `hourly_stats`.
 *
 * Why?  After 7 days the raw `readings` TTL index deletes them, but
 * hourly_stats lives forever and powers the "History" charts.
 *
 * hourly_stats document schema:
 * {
 *   deviceId, hour (Date — truncated to hour boundary),
 *   temp:    { avg, min, max },
 *   humidity:{ avg, min, max },
 *   sound:   { avg, max, dominantEvent },
 *   comfort: { avg, min },
 *   motion:  { totalSamplesActive, totalEvents },
 *   light:   { avg },
 *   soundHist: { QUIET, LIGHT_ACTIVITY, RESTLESS, CRYING },
 *   sampleDocs (count of 30s docs in this hour),
 *   updatedAt
 * }
 */

const { getDb } = require('./mongo');

const HOUR_MS = 60 * 60 * 1_000;

/** Start the hourly aggregation timer. */
function startAggregator() {
  // Run once immediately (catch any gap after restart)
  _runAggregation().catch(console.error);

  // Then every hour aligned to the next hour boundary
  const msUntilNextHour = HOUR_MS - (Date.now() % HOUR_MS);
  setTimeout(() => {
    _runAggregation().catch(console.error);
    setInterval(() => _runAggregation().catch(console.error), HOUR_MS);
  }, msUntilNextHour);

  console.log(
    `[Aggregator] Started — next run in ${Math.round(msUntilNextHour / 60_000)} min`
  );
}

async function _runAggregation() {
  const db  = getDb();
  const now  = new Date();
  // Hour bucket = start of the PREVIOUS completed hour
  const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);
  const from = hour;
  const to   = new Date(hour.getTime() + HOUR_MS);

  const pipeline = [
    { $match: { ts: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: '$deviceId',

        // Temperature
        tempAvg:  { $avg: '$temp.avg' },
        tempMin:  { $min: '$temp.min' },
        tempMax:  { $max: '$temp.max' },

        // Humidity
        humAvg:   { $avg: '$humidity.avg' },
        humMin:   { $min: '$humidity.min' },
        humMax:   { $max: '$humidity.max' },

        // Sound
        sndAvg:   { $avg: '$sound.avg' },
        sndMax:   { $max: '$sound.max' },

        // Comfort
        cftAvg:   { $avg: '$comfort.avg' },
        cftMin:   { $min: '$comfort.last' },

        // Motion
        mtnActive:{ $sum: '$motion.samplesActive' },

        // Light
        lgtAvg:   { $avg: '$light.avg' },

        // Sound histogram (sum across all 30s docs in this hour)
        hQUIET:          { $sum: '$soundHist.QUIET' },
        hLIGHT_ACTIVITY: { $sum: '$soundHist.LIGHT_ACTIVITY' },
        hRESTLESS:       { $sum: '$soundHist.RESTLESS' },
        hCRYING:         { $sum: '$soundHist.CRYING' },

        // Count of 30s documents
        sampleDocs: { $sum: 1 },
      },
    },
  ];

  let results;
  try {
    results = await db.collection('readings').aggregate(pipeline).toArray();
  } catch (err) {
    console.error('[Aggregator] Aggregation failed:', err.message);
    return;
  }

  // Count motion events in this hour from the events collection
  const motionEventCounts = await _countMotionEvents(db, from, to, results.map(r => r._id));

  const ops = results.map(stat => {
    const deviceId = stat._id;
    // Pick dominant sound event (highest count)
    const hist = {
      QUIET:          stat.hQUIET          || 0,
      LIGHT_ACTIVITY: stat.hLIGHT_ACTIVITY || 0,
      RESTLESS:       stat.hRESTLESS       || 0,
      CRYING:         stat.hCRYING         || 0,
    };
    const dominantEvent = Object.entries(hist)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'QUIET';

    return {
      updateOne: {
        filter: { deviceId, hour },
        update: {
          $set: {
            deviceId,
            hour,
            temp:    { avg: _round(stat.tempAvg, 2), min: stat.tempMin, max: stat.tempMax },
            humidity:{ avg: _round(stat.humAvg,  2), min: stat.humMin,  max: stat.humMax  },
            sound:   { avg: _round(stat.sndAvg,  1), max: stat.sndMax,  dominantEvent     },
            comfort: { avg: _round(stat.cftAvg,  1), min: stat.cftMin                     },
            motion:  {
              totalSamplesActive: stat.mtnActive || 0,
              totalEvents:        motionEventCounts[deviceId] || 0,
            },
            light:      { avg: _round(stat.lgtAvg, 1) },
            soundHist:  hist,
            sampleDocs: stat.sampleDocs,
            updatedAt:  new Date(),
          },
        },
        upsert: true,
      },
    };
  });

  if (ops.length > 0) {
    await db.collection('hourly_stats').bulkWrite(ops)
      .catch(err => console.error('[Aggregator] bulkWrite error:', err.message));
    console.log(`[Aggregator] ✅ Hourly stats upserted for ${ops.length} device(s) — hour: ${hour.toISOString()}`);
  }
}

async function _countMotionEvents(db, from, to, deviceIds) {
  if (!deviceIds.length) return {};
  const pipeline = [
    { $match: { category: 'motion', type: 'MOTION_START', ts: { $gte: from, $lt: to }, deviceId: { $in: deviceIds } } },
    { $group: { _id: '$deviceId', count: { $sum: 1 } } },
  ];
  const rows = await db.collection('events').aggregate(pipeline).toArray()
    .catch(() => []);
  return Object.fromEntries(rows.map(r => [r._id, r.count]));
}

function _round(val, decimals) {
  if (val == null || isNaN(val)) return null;
  return +val.toFixed(decimals);
}

module.exports = { startAggregator };
