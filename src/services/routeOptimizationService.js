const db = require('../db');
const config = require('../config');
const { newId, haversineKm, ApiError } = require('../utils/helpers');

/**
 * ROUTE OPTIMIZATION
 * -----------------------------------------------------------------------
 * Builds a collection route over bins that need emptying, using:
 *   1. Nearest-neighbor construction (greedy) from a depot point.
 *   2. 2-opt local search to remove crossing/inefficient legs.
 *
 * This runs entirely on stored bin coordinates + fill levels, so it works
 * without a live traffic API. The "live traffic" input the problem
 * statement asks for is a straightforward swap: replace haversineKm()
 * with a Google Maps Distance Matrix lookup (cached per pair) — every
 * other part of the algorithm is agnostic to how edge weights are computed.
 */

function totalDistance(stops) {
  let dist = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    dist += haversineKm(stops[i], stops[i + 1]);
  }
  return dist;
}

function nearestNeighborRoute(depot, bins) {
  const remaining = [...bins];
  const route = [depot];
  let current = depot;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    current = remaining.splice(bestIdx, 1)[0];
    route.push(current);
  }
  return route;
}

// Classic 2-opt: repeatedly reverse a segment if it shortens the route.
function twoOptImprove(route) {
  let improved = true;
  let best = route;

  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length - 1; j++) {
        const before =
          haversineKm(best[i - 1], best[i]) + haversineKm(best[j], best[j + 1]);
        const after =
          haversineKm(best[i - 1], best[j]) + haversineKm(best[i], best[j + 1]);
        if (after + 1e-9 < before) {
          const reversed = [
            ...best.slice(0, i),
            ...best.slice(i, j + 1).reverse(),
            ...best.slice(j + 1),
          ];
          best = reversed;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * @param {{latitude:number, longitude:number}} depot - vehicle start point
 * @param {string[]} [binIds] - explicit bins to include; if omitted, auto-selects
 *   every bin at/above config.binFillAlertThreshold
 */
function buildOptimizedRoute({ vehicleId, depot, binIds }) {
  if (!vehicleId) throw new ApiError(422, 'vehicleId is required.');
  if (!depot || depot.latitude === undefined || depot.longitude === undefined) {
    throw new ApiError(422, 'depot { latitude, longitude } is required.');
  }

  let bins;
  if (binIds && binIds.length) {
    const placeholders = binIds.map(() => '?').join(',');
    bins = db.prepare(`SELECT * FROM bins WHERE id IN (${placeholders})`).all(...binIds);
  } else {
    bins = db
      .prepare('SELECT * FROM bins WHERE fill_level >= ? ORDER BY fill_level DESC LIMIT ?')
      .all(config.binFillAlertThreshold, config.vehicleCapacityStops);
  }

  if (!bins.length) {
    throw new ApiError(400, 'No bins matched the route criteria (none due for collection).');
  }

  const depotPoint = { ...depot, id: 'DEPOT', label: 'Depot' };
  const greedy = nearestNeighborRoute(depotPoint, bins);
  const optimized = twoOptImprove(greedy);

  const distanceKm = Number(totalDistance(optimized).toFixed(2));

  // Rough savings estimate vs. an unoptimized (arrival-order) route, for the dashboard.
  const naiveDistanceKm = totalDistance([depotPoint, ...bins]);
  const distanceSavedKm = Math.max(0, Number((naiveDistanceKm - distanceKm).toFixed(2)));
  const fuelSavedL = Number((distanceSavedKm * config.fuelCostPerKmLiters).toFixed(2));
  const co2SavedKg = Number((fuelSavedL * config.co2KgPerLiterDiesel).toFixed(2));

  const id = newId();
  const stopBinIds = optimized.slice(1).map((b) => b.id);

  db.prepare(
    `INSERT INTO collection_routes
      (id, vehicle_id, bin_ids_json, total_distance_km, estimated_fuel_saved_l, estimated_co2_saved_kg)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, vehicleId, JSON.stringify(stopBinIds), distanceKm, fuelSavedL, co2SavedKg);

  return {
    routeId: id,
    vehicleId,
    stops: optimized.map((s, idx) => ({
      order: idx,
      binId: s.id === 'DEPOT' ? null : s.id,
      label: s.label,
      latitude: s.latitude,
      longitude: s.longitude,
      fillLevel: s.fill_level ?? null,
    })),
    totalDistanceKm: distanceKm,
    estimatedFuelSavedL: fuelSavedL,
    estimatedCo2SavedKg: co2SavedKg,
  };
}

function listRoutes() {
  return db.prepare('SELECT * FROM collection_routes ORDER BY created_at DESC').all();
}

function updateRouteStatus(routeId, status) {
  const valid = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];
  if (!valid.includes(status)) throw new ApiError(422, `status must be one of ${valid.join(', ')}`);
  const route = db.prepare('SELECT * FROM collection_routes WHERE id = ?').get(routeId);
  if (!route) throw new ApiError(404, 'Route not found.');
  db.prepare('UPDATE collection_routes SET status = ? WHERE id = ?').run(status, routeId);
  return db.prepare('SELECT * FROM collection_routes WHERE id = ?').get(routeId);
}

module.exports = { buildOptimizedRoute, listRoutes, updateRouteStatus };
