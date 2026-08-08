const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { newId, ApiError } = require('../utils/helpers');

const VALID_ROLES = ['CITIZEN', 'MUNICIPAL_ADMIN', 'RECYCLER', 'WASTE_PICKER'];

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    pointsBalance: row.points_balance,
    createdAt: row.created_at,
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function register({ name, email, password, role }) {
  const chosenRole = role && VALID_ROLES.includes(role) ? role : 'CITIZEN';

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const passwordHash = bcrypt.hashSync(password, config.bcryptSaltRounds);
  const id = newId();

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, email, passwordHash, chosenRole);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return { user: toPublicUser(user), token: signToken(user) };
}

function login({ email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) throw new ApiError(401, 'Invalid email or password.');

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Invalid email or password.');

  return { user: toPublicUser(user), token: signToken(user) };
}

function getById(id) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return toPublicUser(user);
}

module.exports = { register, login, getById, toPublicUser, VALID_ROLES };
