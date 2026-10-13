// KJS-CES-01 — Exp-6: Express Router — /api/alerts
// Demonstrates: modular routing, CRUD, and validation against an allowed
// value set (tier), not just "is it present".
import express from 'express';
import { readCollection, writeCollection } from '../store.js';

const router = express.Router();
const FILE = 'alerts.json';
const TIERS = ['Safe', 'Watch', 'Warning', 'Emergency'];

router.use((req, res, next) => {
  console.log(`[alerts router] ${req.method} ${req.originalUrl} at ${new Date().toISOString()}`);
  next();
});

function validateAlertBody(body) {
  const errors = [];
  if (!body.region || typeof body.region !== 'string') errors.push('"region" is required and must be a string.');
  if (!body.tier || !TIERS.includes(body.tier)) errors.push(`"tier" is required and must be one of: ${TIERS.join(', ')}.`);
  if (!body.message || typeof body.message !== 'string') errors.push('"message" is required and must be a string.');
  return errors;
}

// GET /api/alerts?tier=Emergency — list, with an optional tier filter
router.get('/', async (req, res, next) => {
  try {
    const alerts = await readCollection(FILE);
    const { tier } = req.query;
    const filtered = tier ? alerts.filter((a) => a.tier.toLowerCase() === String(tier).toLowerCase()) : alerts;
    res.json({ count: filtered.length, alerts: filtered });
  } catch (err) {
    next(err);
  }
});

// GET /api/alerts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const alerts = await readCollection(FILE);
    const alert = alerts.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ error: `Alert "${req.params.id}" not found.` });
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts — create (dispatch a new alert)
router.post('/', async (req, res, next) => {
  try {
    const errors = validateAlertBody(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const alerts = await readCollection(FILE);
    const newAlert = {
      id: `HW-${Date.now()}`,
      region: req.body.region,
      tier: req.body.tier,
      message: req.body.message,
      channel: req.body.channel || 'App Push',
      issued: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    };
    alerts.push(newAlert);
    await writeCollection(FILE, alerts);
    res.status(201).json(newAlert);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const alerts = await readCollection(FILE);
    const index = alerts.findIndex((a) => a.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: `Alert "${req.params.id}" not found.` });

    const [removed] = alerts.splice(index, 1);
    await writeCollection(FILE, alerts);
    res.json({ message: 'Alert deleted.', removed });
  } catch (err) {
    next(err);
  }
});

export default router;
