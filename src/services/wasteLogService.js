const db = require('../db');
const config = require('../config');
const { newId } = require('../utils/helpers');
const { classifyWasteImage } = require('./classifierService');

async function submitWasteLog(userId, { claimedWasteType, imagePath }) {
  const classification = await classifyWasteImage(imagePath);

  const isSegregatedCorrectly =
    classification.predictedType === claimedWasteType &&
    classification.confidence >= config.segregationConfidenceThreshold;

  const pointsAwarded = isSegregatedCorrectly
    ? config.pointsPerCorrectSegregation
    : config.pointsPenaltyPerIncorrect;

  const id = newId();
  const status = isSegregatedCorrectly ? 'VERIFIED' : 'REJECTED';

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO waste_logs
        (id, user_id, image_path, claimed_waste_type, is_segregated_correctly,
         confidence_score, points_awarded, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      imagePath,
      claimedWasteType,
      isSegregatedCorrectly ? 1 : 0,
      classification.confidence,
      pointsAwarded,
      status
    );

    if (pointsAwarded !== 0) {
      db.prepare('UPDATE users SET points_balance = points_balance + ? WHERE id = ?').run(
        pointsAwarded,
        userId
      );
    }
  });
  insert();

  const log = db.prepare('SELECT * FROM waste_logs WHERE id = ?').get(id);
  const user = db.prepare('SELECT points_balance FROM users WHERE id = ?').get(userId);

  return { log, classification, pointsBalance: user.points_balance };
}

function listWasteLogs(userId) {
  return db
    .prepare('SELECT * FROM waste_logs WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
}

module.exports = { submitWasteLog, listWasteLogs };
