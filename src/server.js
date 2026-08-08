const app = require('./app');
const config = require('./config');

// Touch db.js once so the schema is applied on boot even before the first request.
require('./db');

app.listen(config.port, () => {
  console.log(`Waste platform backend listening on port ${config.port} (${config.nodeEnv})`);
});
