const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const binRoutes = require('./routes/binRoutes');
const wasteLogRoutes = require('./routes/wasteLogRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const routeRoutes = require('./routes/routeRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'waste-circular-economy-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/waste-logs', wasteLogRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
