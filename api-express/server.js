// KJS-CES-01 — Exp-6: Routing using Express.js
// Main application file: mounts each resource's router with a URL prefix,
// exactly like the app.js pattern in the experiment's theory section.
import express from 'express';
import cors from 'cors';
import regionsRouter from './routes/regions.js';
import alertsRouter from './routes/alerts.js';

const app = express();
const PORT = Number(process.env.PORT) || 4100;

app.use(cors());
app.use(express.json());

// Global logging middleware (applies to every route, unlike the
// router-scoped ones inside regions.js / alerts.js)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Mount the routers with prefixes
app.use('/api/regions', regionsRouter);
app.use('/api/alerts', alertsRouter);

// Basic root route
app.get('/', (req, res) => {
  res.json({
    service: 'kjs-ces-01-express-router-demo',
    experiment: 'Exp-6: Routing using Express.js',
    routes: [
      'GET    /api/regions',
      'GET    /api/regions/:id',
      'POST   /api/regions',
      'PUT    /api/regions/:id',
      'PATCH  /api/regions/:id',
      'DELETE /api/regions/:id',
      'GET    /api/alerts',
      'GET    /api/alerts/:id',
      'POST   /api/alerts',
      'DELETE /api/alerts/:id',
    ],
  });
});

// 404 handler — reached when no route above matched
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', requestedPath: req.originalUrl });
});

// Centralized error-handling middleware (4 args -> Express treats it
// specially) — catches anything passed to next(err) by the routers above
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`Exp-6 Express router demo running on http://localhost:${PORT}`);
});
