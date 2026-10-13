import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const PORT = Number(process.env.PORT) || 8100;

async function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function statusFromMoisture(value) {
  if (value < 25) return 'Low';
  if (value < 45) return 'Moderate';
  if (value < 65) return 'Adequate';
  return 'High';
}

function getPlotById(plots, plotId) {
  return plots.find((plot) => plot.plotId === plotId);
}

function getSensorByPlot(sensors, plotId) {
  return sensors.find((sensor) => sensor.plotId === plotId) || null;
}

function buildIrrigationRecommendation(plot, sensor, rainfallForecast = 0) {
  const moisture = Number(sensor?.soilMoisture ?? 0);
  const temperature = Number(sensor?.airTemperature ?? 0);
  const cropStage = plot?.cropStage ?? 'vegetative';
  let irrigationRequired = false;
  let recommendedWater = '0 mm';
  let recommendedDuration = '0 hours';
  let priority = 'Low';

  if (moisture < 30 || (temperature >= 38 && moisture < 45)) {
    irrigationRequired = true;
    recommendedWater = rainfallForecast > 10 ? '18 mm' : '32 mm';
    recommendedDuration = rainfallForecast > 10 ? '1.5 hours' : '2.5 hours';
    priority = 'High';
  } else if (moisture < 50 || temperature >= 35) {
    irrigationRequired = true;
    recommendedWater = rainfallForecast > 10 ? '12 mm' : '22 mm';
    recommendedDuration = rainfallForecast > 10 ? '1.0 hours' : '1.8 hours';
    priority = 'Medium';
  } else {
    irrigationRequired = false;
    recommendedWater = '0 mm';
    recommendedDuration = '0 hours';
    priority = 'Low';
  }

  if (cropStage === 'grand growth' && moisture < 40) {
    priority = 'High';
  }

  return {
    plotId: plot?.plotId,
    irrigationRequired,
    recommendedWater,
    recommendedDuration,
    priority,
    cropStage,
    moisture,
    rainfallForecast,
    aiReason: irrigationRequired
      ? 'Rule-based AI logic: soil moisture below threshold and high temperature increase water stress risk.'
      : 'No irrigation needed: soil moisture is within the recommended range for the current crop stage.',
  };
}

function buildStressStatus(plot, sensor) {
  const moisture = Number(sensor?.soilMoisture ?? 0);
  const airTemperature = Number(sensor?.airTemperature ?? 0);
  let waterStressProbability = 0;
  let status = 'Safe';

  waterStressProbability = Math.max(0, Math.min(100, Math.round(((45 - moisture) * 2) + (airTemperature - 28) * 2.5)));

  if (waterStressProbability >= 80) status = 'Critical Stress';
  else if (waterStressProbability >= 60) status = 'High Stress';
  else if (waterStressProbability >= 40) status = 'Moderate';
  else status = 'Safe';

  return {
    plotId: plot?.plotId,
    waterStressProbability,
    status,
    alert: status === 'Safe' ? 'Soil moisture is within the safe band.' : 'Irrigation is recommended.',
  };
}

function buildPrediction(plot, sensor) {
  const moisture = Number(sensor?.soilMoisture ?? 0);
  const daysToNextIrrigation = moisture < 25 ? 1 : moisture < 40 ? 2 : moisture < 60 ? 3 : 4;
  const date = new Date();
  date.setDate(date.getDate() + daysToNextIrrigation);

  return {
    plotId: plot?.plotId,
    predictedIrrigationDate: date.toISOString().slice(0, 10),
    confidence: moisture < 30 ? 92 : moisture < 50 ? 84 : 76,
    note: 'Predicted from soil moisture trend, crop stage, and rainfall conditions.',
  };
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const requestUrl = new URL(req.url || '/', `http://${host}`);
  const pathname = requestUrl.pathname;
  const method = req.method || 'GET';

  res.setHeader('Content-Type', 'application/json');
  Object.entries(buildCorsHeaders()).forEach(([key, value]) => res.setHeader(key, value));

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/' || pathname === '/home') {
      const overview = {
        project: 'KJS-CES-01 Climate Intelligence + AI Backend',
        experiment: 'Experiment 5 - Node.js',
        description: 'Core Node.js backend for heatwave risk, field monitoring, and future ReactJS dashboard integration.',
        endpoints: [
          '/health',
          '/farmers',
          '/plots',
          '/sensors',
          '/irrigation?plotId=SG-1045',
          '/prediction?plotId=SG-1045',
          '/water-stress?plotId=SG-1045',
          '/alerts',
          '/dashboard',
          '/reports',
        ],
      };
      res.writeHead(200);
      res.end(JSON.stringify(overview, null, 2));
      return;
    }

    if (pathname === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', service: 'kjs-ces-01-node-backend', port: PORT }, null, 2));
      return;
    }

    if (pathname === '/farmers') {
      const farmers = await readJson('farmers.json');
      res.writeHead(200);
      res.end(JSON.stringify(farmers, null, 2));
      return;
    }

    if (pathname === '/plots') {
      const plots = await readJson('plots.json');
      const plotId = requestUrl.searchParams.get('plotId');
      const response = plotId ? getPlotById(plots, plotId) : plots;
      res.writeHead(200);
      res.end(JSON.stringify(response, null, 2));
      return;
    }

    if (pathname === '/sensors') {
      const sensors = await readJson('sensors.json');
      const payload = sensors.map((sensor) => ({
        sensorId: sensor.sensorId,
        plotId: sensor.plotId,
        soilMoisture: sensor.soilMoisture,
        soilTemperature: sensor.soilTemperature,
        airTemperature: sensor.airTemperature,
        humidity: sensor.humidity,
        rainfall: sensor.rainfall,
        timestamp: sensor.timestamp,
        status: statusFromMoisture(sensor.soilMoisture),
      }));
      res.writeHead(200);
      res.end(JSON.stringify(payload, null, 2));
      return;
    }

    if (pathname === '/irrigation') {
      const plots = await readJson('plots.json');
      const sensors = await readJson('sensors.json');
      const plotId = requestUrl.searchParams.get('plotId') || 'SG-1045';
      const plot = getPlotById(plots, plotId);
      const sensor = getSensorByPlot(sensors, plotId);

      if (!plot || !sensor) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `No plot or sensor record found for ${plotId}` }, null, 2));
        return;
      }

      const rainfallForecast = Number(sensor.rainfall || 0);
      const recommendation = buildIrrigationRecommendation(plot, sensor, rainfallForecast);
      res.writeHead(200);
      res.end(JSON.stringify(recommendation, null, 2));
      return;
    }

    if (pathname === '/prediction') {
      const plots = await readJson('plots.json');
      const sensors = await readJson('sensors.json');
      const plotId = requestUrl.searchParams.get('plotId') || 'SG-1045';
      const plot = getPlotById(plots, plotId);
      const sensor = getSensorByPlot(sensors, plotId);

      if (!plot || !sensor) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `No plot found for ${plotId}` }, null, 2));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify(buildPrediction(plot, sensor), null, 2));
      return;
    }

    if (pathname === '/water-stress') {
      const plots = await readJson('plots.json');
      const sensors = await readJson('sensors.json');
      const plotId = requestUrl.searchParams.get('plotId') || 'SG-1045';
      const plot = getPlotById(plots, plotId);
      const sensor = getSensorByPlot(sensors, plotId);

      if (!plot || !sensor) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `No sensor data found for ${plotId}` }, null, 2));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify(buildStressStatus(plot, sensor), null, 2));
      return;
    }

    if (pathname === '/alerts') {
      const alerts = await readJson('alerts.json');
      res.writeHead(200);
      res.end(JSON.stringify(alerts, null, 2));
      return;
    }

    if (pathname === '/dashboard') {
      const [plots, sensors, alerts] = await Promise.all([
        readJson('plots.json'),
        readJson('sensors.json'),
        readJson('alerts.json'),
      ]);

      const dashboard = {
        summary: {
          totalPlots: plots.length,
          activeSensors: sensors.length,
          alertCount: alerts.length,
          generatedAt: new Date().toISOString(),
        },
        alerts,
        sensors: sensors.map((sensor) => ({
          plotId: sensor.plotId,
          soilMoisture: sensor.soilMoisture,
          status: statusFromMoisture(sensor.soilMoisture),
        })),
      };

      res.writeHead(200);
      res.end(JSON.stringify(dashboard, null, 2));
      return;
    }

    if (pathname === '/reports') {
      if (method === 'GET') {
        const reports = await readJson('reports.json');
        res.writeHead(200);
        res.end(JSON.stringify(reports, null, 2));
        return;
      }

      if (method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        let payload;
        try { payload = JSON.parse(body || '{}'); }
        catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON body' })); return; }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
            ['plotId', 'region', 'status'].some((field) => typeof payload[field] !== 'string' || !payload[field].trim()) ||
            (payload.ambientTempC !== undefined && (typeof payload.ambientTempC !== 'number' || !Number.isFinite(payload.ambientTempC) || payload.ambientTempC < -10 || payload.ambientTempC > 60)) ||
            (payload.photo && (typeof payload.photo.dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(payload.photo.dataUrl) || payload.photo.dataUrl.length > 7 * 1024 * 1024))) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Provide plotId, region, status, a valid temperature, and valid image evidence if attached.' }));
          return;
        }
        const reports = await readJson('reports.json');
        const record = {
          ...payload,
          id: `R-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        reports.push(record);
        await writeJson('reports.json', reports);

        res.writeHead(201);
        res.end(JSON.stringify({ message: 'Report saved successfully', record }, null, 2));
        return;
      }
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Route not found', requestedPath: pathname }, null, 2));
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error', detail: error.message }, null, 2));
  }
});

server.listen(PORT, () => {
  console.log(`KJS-CES-01 Node backend running on http://localhost:${PORT}`);
  console.log('Available routes: /, /health, /farmers, /plots, /sensors, /irrigation, /prediction, /water-stress, /alerts, /dashboard, /reports');
});
