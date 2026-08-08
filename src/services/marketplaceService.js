const db = require('../db');
const { newId, ApiError } = require('../utils/helpers');

function createListing(sellerId, { wasteType, quantityKg, pricePerKg }) {
  const id = newId();
  db.prepare(
    `INSERT INTO marketplace_listings (id, seller_id, waste_type, quantity_kg, price_per_kg)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, sellerId, wasteType, quantityKg, pricePerKg);
  return db.prepare('SELECT * FROM marketplace_listings WHERE id = ?').get(id);
}

function listListings({ wasteType, status } = {}) {
  let query = 'SELECT * FROM marketplace_listings WHERE 1=1';
  const params = [];
  if (wasteType) {
    query += ' AND waste_type = ?';
    params.push(wasteType);
  }
  query += ' AND status = ?';
  params.push(status || 'AVAILABLE');
  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params);
}

function buyListing(buyerId, listingId, { quantityKg }) {
  const listing = db.prepare('SELECT * FROM marketplace_listings WHERE id = ?').get(listingId);
  if (!listing) throw new ApiError(404, 'Listing not found.');
  if (listing.status !== 'AVAILABLE') throw new ApiError(400, 'Listing is no longer available.');
  if (listing.seller_id === buyerId) throw new ApiError(400, 'You cannot buy your own listing.');
  if (quantityKg <= 0 || quantityKg > listing.quantity_kg) {
    throw new ApiError(422, `quantityKg must be between 0 and ${listing.quantity_kg}.`);
  }

  const totalPrice = Number((quantityKg * listing.price_per_kg).toFixed(2));
  const id = newId();
  const remaining = Number((listing.quantity_kg - quantityKg).toFixed(3));

  const buyTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO marketplace_transactions (id, listing_id, buyer_id, quantity_kg, total_price)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, listingId, buyerId, quantityKg, totalPrice);

    if (remaining <= 0) {
      db.prepare(`UPDATE marketplace_listings SET status = 'SOLD', quantity_kg = 0 WHERE id = ?`).run(
        listingId
      );
    } else {
      db.prepare('UPDATE marketplace_listings SET quantity_kg = ? WHERE id = ?').run(
        remaining,
        listingId
      );
    }
  });
  buyTx();

  return db.prepare('SELECT * FROM marketplace_transactions WHERE id = ?').get(id);
}

function listMyListings(sellerId) {
  return db
    .prepare('SELECT * FROM marketplace_listings WHERE seller_id = ? ORDER BY created_at DESC')
    .all(sellerId);
}

module.exports = { createListing, listListings, buyListing, listMyListings };
