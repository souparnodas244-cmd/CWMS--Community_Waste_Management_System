require('dotenv').config();

function num(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : Number(v);
}

module.exports = {
  port: num('PORT', 4000),
  nodeEnv: process.env.NODE_ENV || 'development',

  dbPath: process.env.DB_PATH || './data/waste_platform.sqlite',

  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptSaltRounds: num('BCRYPT_SALT_ROUNDS', 10),

  pointsPerCorrectSegregation: num('POINTS_PER_CORRECT_SEGREGATION', 10),
  pointsPenaltyPerIncorrect: num('POINTS_PENALTY_PER_INCORRECT', 0),
  segregationConfidenceThreshold: num('SEGREGATION_CONFIDENCE_THRESHOLD', 0.6),
  binFillAlertThreshold: num('BIN_FILL_ALERT_THRESHOLD', 70),
  vehicleCapacityStops: num('VEHICLE_CAPACITY_STOPS', 25),

  fuelCostPerKmLiters: num('FUEL_COST_PER_KM_LITERS', 0.35),
  co2KgPerLiterDiesel: num('CO2_KG_PER_LITER_DIESEL', 2.68),
  co2KgSavedPerKgRecycled: num('CO2_KG_SAVED_PER_KG_RECYCLED', 1.5),

  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxUploadSizeMb: num('MAX_UPLOAD_SIZE_MB', 5),
};
