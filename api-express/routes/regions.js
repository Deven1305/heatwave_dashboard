// KJS-CES-01 — Exp-6: Express Router — /api/regions
// Demonstrates: modular routing, per-router middleware, full CRUD, and
// data validation with structured error responses.
import express from 'express';
import { readCollection, writeCollection } from '../store.js';

const router = express.Router();
const FILE = 'regions.json';

// Middleware specific to this router only (mirrors the docx's users.js
// example) — every request to /api/regions/* gets logged here.
router.use((req, res, next) => {
  console.log(`[regions router] ${req.method} ${req.originalUrl} at ${new Date().toISOString()}`);
  next();
});

function severityFrom(record) {
  const departure = record.currentMaxTempC - record.normalMaxTempC;
  if (record.currentMaxTempC >= 47) return 'Severe Heatwave';
  if (record.currentMaxTempC >= 44) return 'Heatwave';
  if (record.currentMaxTempC >= 40) return 'Hot Day';
  return 'Normal';
}

function slugify(text) {
  return String(text).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function validateRegionBody(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.region !== undefined) {
    if (!body.region || typeof body.region !== 'string') errors.push('"region" is required and must be a string.');
  }
  if (!partial || body.normalMaxTempC !== undefined) {
    if (body.normalMaxTempC === undefined || Number.isNaN(Number(body.normalMaxTempC))) errors.push('"normalMaxTempC" is required and must be a number.');
  }
  if (!partial || body.currentMaxTempC !== undefined) {
    if (body.currentMaxTempC === undefined || Number.isNaN(Number(body.currentMaxTempC))) errors.push('"currentMaxTempC" is required and must be a number.');
  }
  if (!partial || body.awsStationsReporting !== undefined) {
    if (body.awsStationsReporting === undefined || Number.isNaN(Number(body.awsStationsReporting)) || Number(body.awsStationsReporting) < 0) {
      errors.push('"awsStationsReporting" is required and must be a non-negative number.');
    }
  }
  return errors;
}

// GET /api/regions — list all regions with derived severity
router.get('/', async (req, res, next) => {
  try {
    const regions = await readCollection(FILE);
    res.json(regions.map((r) => ({ ...r, severity: severityFrom(r) })));
  } catch (err) {
    next(err);
  }
});

// GET /api/regions/:id — single region
router.get('/:id', async (req, res, next) => {
  try {
    const regions = await readCollection(FILE);
    const region = regions.find((r) => r.id === req.params.id);
    if (!region) return res.status(404).json({ error: `Region "${req.params.id}" not found.` });
    res.json({ ...region, severity: severityFrom(region) });
  } catch (err) {
    next(err);
  }
});

// POST /api/regions — create
router.post('/', async (req, res, next) => {
  try {
    const errors = validateRegionBody(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const regions = await readCollection(FILE);
    const id = slugify(req.body.region);
    if (regions.some((r) => r.id === id)) {
      return res.status(409).json({ error: `Region "${req.body.region}" already exists.` });
    }

    const newRegion = {
      id,
      region: req.body.region,
      normalMaxTempC: Number(req.body.normalMaxTempC),
      currentMaxTempC: Number(req.body.currentMaxTempC),
      awsStationsReporting: Number(req.body.awsStationsReporting),
    };
    regions.push(newRegion);
    await writeCollection(FILE, regions);
    res.status(201).json({ ...newRegion, severity: severityFrom(newRegion) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/regions/:id — full update
router.put('/:id', async (req, res, next) => {
  try {
    const errors = validateRegionBody(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const regions = await readCollection(FILE);
    const index = regions.findIndex((r) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: `Region "${req.params.id}" not found.` });

    regions[index] = {
      id: req.params.id,
      region: req.body.region,
      normalMaxTempC: Number(req.body.normalMaxTempC),
      currentMaxTempC: Number(req.body.currentMaxTempC),
      awsStationsReporting: Number(req.body.awsStationsReporting),
    };
    await writeCollection(FILE, regions);
    res.json({ ...regions[index], severity: severityFrom(regions[index]) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/regions/:id — partial update
router.patch('/:id', async (req, res, next) => {
  try {
    const errors = validateRegionBody(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });

    const regions = await readCollection(FILE);
    const index = regions.findIndex((r) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: `Region "${req.params.id}" not found.` });

    regions[index] = { ...regions[index], ...req.body, id: req.params.id };
    await writeCollection(FILE, regions);
    res.json({ ...regions[index], severity: severityFrom(regions[index]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/regions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const regions = await readCollection(FILE);
    const index = regions.findIndex((r) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: `Region "${req.params.id}" not found.` });

    const [removed] = regions.splice(index, 1);
    await writeCollection(FILE, regions);
    res.json({ message: 'Region deleted.', removed });
  } catch (err) {
    next(err);
  }
});

export default router;
