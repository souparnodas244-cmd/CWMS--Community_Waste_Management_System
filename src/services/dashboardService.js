const db = require('../db');
const config = require('../config');

function getSummary() {
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const totalBins = db.prepare('SELECT COUNT(*) AS c FROM bins').get().c;
  const binsNeedingCollection = db
    .prepare('SELECT COUNT(*) AS c FROM bins WHERE fill_level >= ?')
    .get(config.binFillAlertThreshold).c;
  const avgFillLevel = db.prepare('SELECT AVG(fill_level) AS a FROM bins').get().a || 0;

  const wasteLogTotals = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified,
         SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
       FROM waste_logs`
    )
    .get();

  const segregationRate =
    wasteLogTotals.total > 0
      ? Number(((wasteLogTotals.verified / wasteLogTotals.total) * 100).toFixed(1))
      : 0;

  const routeTotals = db
    .prepare(
      `SELECT
         COUNT(*) AS totalRoutes,
         COALESCE(SUM(total_distance_km), 0) AS totalDistanceKm,
         COALESCE(SUM(estimated_fuel_saved_l), 0) AS totalFuelSavedL,
         COALESCE(SUM(estimated_co2_saved_kg), 0) AS totalCo2SavedKg
       FROM collection_routes`
    )
    .get();

  const marketplaceTotals = db
    .prepare(
      `SELECT
         COUNT(*) AS totalTransactions,
         COALESCE(SUM(quantity_kg), 0) AS totalKgTraded,
         COALESCE(SUM(total_price), 0) AS totalValueTraded
       FROM marketplace_transactions`
    )
    .get();

  const recyclingCo2SavedKg = Number(
    (marketplaceTotals.totalKgTraded * config.co2KgSavedPerKgRecycled).toFixed(2)
  );

  const pointsIssued =
    db.prepare('SELECT COALESCE(SUM(points_balance), 0) AS s FROM users').get().s;

  return {
    citizens: { totalUsers, pointsCurrentlyHeld: pointsIssued },
    bins: {
      totalBins,
      binsNeedingCollection,
      avgFillLevelPct: Number(avgFillLevel.toFixed(1)),
    },
    segregation: {
      totalLogsSubmitted: wasteLogTotals.total,
      verifiedCorrect: wasteLogTotals.verified || 0,
      rejectedIncorrect: wasteLogTotals.rejected || 0,
      segregationAccuracyPct: segregationRate,
    },
    collectionEfficiency: {
      totalRoutesPlanned: routeTotals.totalRoutes,
      totalDistanceKm: Number(routeTotals.totalDistanceKm.toFixed(2)),
      estimatedFuelSavedL: Number(routeTotals.totalFuelSavedL.toFixed(2)),
      estimatedCo2SavedKgFromRouting: Number(routeTotals.totalCo2SavedKg.toFixed(2)),
    },
    circularEconomy: {
      totalMarketplaceTransactions: marketplaceTotals.totalTransactions,
      totalKgTraded: Number(marketplaceTotals.totalKgTraded.toFixed(2)),
      totalValueTraded: Number(marketplaceTotals.totalValueTraded.toFixed(2)),
      estimatedCo2SavedKgFromRecycling: recyclingCo2SavedKg,
    },
    totalEstimatedCo2SavedKg: Number(
      (routeTotals.totalCo2SavedKg + recyclingCo2SavedKg).toFixed(2)
    ),
  };
}

module.exports = { getSummary };
