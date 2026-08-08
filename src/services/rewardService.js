const db = require('../db');
const { newId, ApiError } = require('../utils/helpers');

function createPartner({ name, description, pointsCost }) {
  const id = newId();
  db.prepare(
    `INSERT INTO reward_partners (id, name, description, points_cost) VALUES (?, ?, ?, ?)`
  ).run(id, name, description || null, pointsCost);
  return db.prepare('SELECT * FROM reward_partners WHERE id = ?').get(id);
}

function listPartners() {
  return db.prepare('SELECT * FROM reward_partners WHERE active = 1 ORDER BY points_cost ASC').all();
}

function redeem(userId, partnerId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const partner = db.prepare('SELECT * FROM reward_partners WHERE id = ? AND active = 1').get(partnerId);
  if (!partner) throw new ApiError(404, 'Reward partner not found or inactive.');
  if (user.points_balance < partner.points_cost) {
    throw new ApiError(400, 'Insufficient points balance for this reward.');
  }

  const id = newId();
  const redeemTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO reward_redemptions (id, user_id, partner_id, points_spent) VALUES (?, ?, ?, ?)`
    ).run(id, userId, partnerId, partner.points_cost);
    db.prepare('UPDATE users SET points_balance = points_balance - ? WHERE id = ?').run(
      partner.points_cost,
      userId
    );
  });
  redeemTx();

  const redemption = db.prepare('SELECT * FROM reward_redemptions WHERE id = ?').get(id);
  const updatedUser = db.prepare('SELECT points_balance FROM users WHERE id = ?').get(userId);
  return { redemption, pointsBalance: updatedUser.points_balance };
}

function listRedemptions(userId) {
  return db
    .prepare(
      `SELECT rr.*, rp.name AS partner_name
       FROM reward_redemptions rr
       JOIN reward_partners rp ON rp.id = rr.partner_id
       WHERE rr.user_id = ?
       ORDER BY rr.redeemed_at DESC`
    )
    .all(userId);
}

module.exports = { createPartner, listPartners, redeem, listRedemptions };
