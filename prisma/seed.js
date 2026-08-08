/* Run with: node prisma/seed.js */
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const config = require('../src/config');
const { newId } = require('../src/utils/helpers');

function upsertUser({ name, email, password, role, points = 0 }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const id = newId();
  const passwordHash = bcrypt.hashSync(password, config.bcryptSaltRounds);
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, points_balance) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, email, passwordHash, role, points);
  return id;
}

function seed() {
  const adminId = upsertUser({
    name: 'Municipal Admin',
    email: 'admin@municorp.example',
    password: 'admin1234',
    role: 'MUNICIPAL_ADMIN',
  });

  const citizenId = upsertUser({
    name: 'Demo Citizen',
    email: 'citizen@example.com',
    password: 'citizen123',
    role: 'CITIZEN',
    points: 20,
  });

  const recyclerId = upsertUser({
    name: 'GreenCycle Recyclers',
    email: 'recycler@example.com',
    password: 'recycler123',
    role: 'RECYCLER',
  });

  // Demo bins around a sample municipal ward (Kolkata coordinates as a realistic reference area).
  const demoBins = [
    { label: 'Ward 5 - Park Street Junction', lat: 22.5527, lon: 88.3529, fill: 82, type: 'MIXED' },
    { label: 'Ward 5 - Elgin Road Market', lat: 22.5390, lon: 88.3520, fill: 91, type: 'ORGANIC' },
    { label: 'Ward 6 - Gariahat Crossing', lat: 22.5185, lon: 88.3635, fill: 45, type: 'RECYCLABLE' },
    { label: 'Ward 6 - Rashbehari Ave', lat: 22.5108, lon: 88.3572, fill: 76, type: 'MIXED' },
    { label: 'Ward 7 - Ballygunge Station', lat: 22.5286, lon: 88.3654, fill: 30, type: 'RECYCLABLE' },
    { label: 'Ward 7 - Deshapriya Park', lat: 22.5176, lon: 88.3550, fill: 88, type: 'ORGANIC' },
  ];

  for (const b of demoBins) {
    const exists = db.prepare('SELECT id FROM bins WHERE label = ?').get(b.label);
    if (exists) continue;
    db.prepare(
      `INSERT INTO bins (id, label, latitude, longitude, waste_type, fill_level) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(newId(), b.label, b.lat, b.lon, b.type, b.fill);
  }

  const partners = [
    { name: '10% off at GreenMart Grocery', description: 'Local grocery partner', cost: 50 },
    { name: 'Free reusable tote bag', description: 'From municipal sustainability desk', cost: 20 },
    { name: '₹100 voucher - Metro Recycling Co-op', description: 'Recycling co-op voucher', cost: 150 },
  ];
  for (const p of partners) {
    const exists = db.prepare('SELECT id FROM reward_partners WHERE name = ?').get(p.name);
    if (exists) continue;
    db.prepare(
      `INSERT INTO reward_partners (id, name, description, points_cost) VALUES (?, ?, ?, ?)`
    ).run(newId(), p.name, p.description, p.cost);
  }

  const listingExists = db
    .prepare('SELECT id FROM marketplace_listings WHERE seller_id = ?')
    .get(recyclerId);
  if (!listingExists) {
    db.prepare(
      `INSERT INTO marketplace_listings (id, seller_id, waste_type, quantity_kg, price_per_kg)
       VALUES (?, ?, 'RECYCLABLE', 120, 8.5)`
    ).run(newId(), recyclerId);
  }

  console.log('Seed complete.');
  console.log('  Admin login:   admin@municorp.example / admin1234');
  console.log('  Citizen login: citizen@example.com / citizen123');
  console.log('  Recycler login: recycler@example.com / recycler123');
  console.log(`  Admin id: ${adminId}, Citizen id: ${citizenId}, Recycler id: ${recyclerId}`);
}

seed();
