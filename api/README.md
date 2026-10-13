# KJS-CES-01 Node.js API backend

This backend extends the climate dashboard use case with a Node.js core-module implementation for:

- HTTP request/response handling using the `http` module
- URL-based route processing using the `url` module
- File-based JSON data storage and retrieval using the `fs` module
- Asynchronous file operations with `fs/promises`
- JSON response generation for future React dashboard consumption
- Error handling for 404 and 500 responses

## API routes

- `GET /` — service overview
- `GET /health` — health check
- `GET /farmers` — farmer records
- `GET /plots` — plot details
- `GET /sensors` — sensor readings and moisture status
- `GET /irrigation?plotId=SG-1045` — irrigation recommendation
- `GET /prediction?plotId=SG-1045` — next irrigation prediction
- `GET /water-stress?plotId=SG-1045` — stress analysis
- `GET /alerts` — alert list
- `GET /dashboard` — summary payload for dashboard cards
- `GET /reports` and `POST /reports` — report persistence

## Run locally

```bash
npm run api
```

Then open:

- http://localhost:8000/
- http://localhost:8000/health
- http://localhost:8000/irrigation?plotId=SG-1045

This matches the Experiment 5 Node.js requirement and also supports the future ReactJS dashboard integration from the AI use case.
