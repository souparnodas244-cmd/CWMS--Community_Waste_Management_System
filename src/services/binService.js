const db = require('../db');
const config = require('../config');
const { newId, ApiError } = require('../utils/helpers');

function createBin({ label, latitude, longitude, wasteType, capacityLiters }) {
  const id = newId();
  db.prepare(
    `INSERT INTO bins (id, label, latitude, longitude, waste_type, capacity_liters)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, label, latitude, longitude, wasteType || 'MIXED', capacityLiters || 240);
  return getBin(id);
}

function listBins({ minFillLevel, wasteType } = {}) {
  let query = 'SELECT * FROM bins WHERE 1=1';
  const params = [];
  if (minFillLevel !== undefined) {
    query += ' AND fill_level >= ?';
    params.push(minFillLevel);
  }
  if (wasteType) {
    query += ' AND waste_type = ?';
    params.push(wasteType);
  }
  query += ' ORDER BY fill_level DESC';
  return db.prepare(query).all(...params);
}

function getBin(id) {
  const bin = db.prepare('SELECT * FROM bins WHERE id = ?').get(id);
  if (!bin) throw new ApiError(404, 'Bin not found.');
  return bin;
}

/**
 * Records a reading from a physical (or simulated) ESP32 + ultrasonic sensor
 * and updates the bin's current fill level. This is the ingestion point the
 * hardware track would POST to.
 */
function recordSensorReading(binId, { fillLevel, batteryPct }) {
  if (fillLevel < 0 || fillLevel > 100) {
    throw new ApiError(422, 'fillLevel must be between 0 and 100.');
  }
  getBin(binId); // 404s if missing

  const id = newId();
  db.prepare(
    `INSERT INTO sensor_readings (id, bin_id, fill_level, battery_pct) VALUES (?, ?, ?, ?)`
  ).run(id, binId, fillLevel, batteryPct ?? null);

  db.prepare('UPDATE bins SET fill_level = ? WHERE id = ?').run(fillLevel, binId);

  return {
    reading: db.prepare('SELECT * FROM sensor_readings WHERE id = ?').get(id),
    bin: getBin(binId),
    alert: fillLevel >= config.binFillAlertThreshold,
  };
}

function markEmptied(binId) {
  getBin(binId);
  db.prepare(
    `UPDATE bins SET fill_level = 0, last_emptied_at = datetime('now') WHERE id = ?`
  ).run(binId);
  return getBin(binId);
}

module.exports = { createBin, listBins, getBin, recordSensorReading, markEmptied };
