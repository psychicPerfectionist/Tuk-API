# Sri Lanka Police – Tuk-Tuk Tracking API

> NB6007CEM Web API Development

A RESTful API for tracking registered three-wheelers (tuk-tuks) across Sri Lanka built with Node.js, Express and SQLite.

## Tech Stack

- **Node.js** + **Express** — web framework
- **sql.js** — SQLite database (pure JavaScript, no native modules needed)
- **jsonwebtoken** — JWT authentication
- **bcryptjs** — password hashing

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Seed the database
npm run seed

# 3. Start the server
npm start
```

API runs at: http://localhost:3000  
Health check: http://localhost:3000/api/health

## API Docs (Swagger)

- Swagger UI: http://localhost:3000/api-docs/
- OpenAPI JSON: http://localhost:3000/api/swagger.json
- Compatibility alias: http://localhost:3000/api/v1/swagger

## Default Credentials

| Role | Username | Password |
|---|---|---|
| ADMIN | admin | Admin@1234 |
| PROVINCIAL | wp_officer | Admin@1234 |
| DISTRICT | cmb_officer | Admin@1234 |
| DEVICE | device_dev_0001 | Device@5678 |

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Login and get JWT token |
| POST | /api/auth/register | Create a new user (ADMIN only) |
| GET | /api/auth/me | Get your own profile |

### Vehicles
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/vehicles | List all tuk-tuks |
| POST | /api/vehicles | Register a new tuk-tuk |
| GET | /api/vehicles/:id | Get one vehicle |
| PATCH | /api/vehicles/:id | Update a vehicle |
| DELETE | /api/vehicles/:id | Deregister a vehicle |
| GET | /api/vehicles/:id/location | Last known location |
| GET | /api/vehicles/:id/history | Movement history (time window) |

### Locations
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/locations | Push a GPS ping (device) |
| GET | /api/locations | Query location data |
| GET | /api/locations/live | Live map (latest per vehicle) |

### Geography
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/provinces | All 9 provinces |
| GET | /api/districts | All 25 districts |
| GET | /api/stations | Police stations |

### Drivers
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/drivers | List drivers |
| POST | /api/drivers | Register a driver |
| GET | /api/drivers/:id | Get driver detail |
| PATCH | /api/drivers/:id | Update driver |

## Filtering & Sorting

```
GET /api/vehicles?province_id=1&status=ACTIVE
GET /api/vehicles?sort=registration_number:asc
GET /api/vehicles?page=2&limit=20
GET /api/vehicles/:id/history?from=2026-04-20T00:00:00Z&to=2026-04-21T00:00:00Z
GET /api/locations/live?district_id=1
```

## Roles

| Role | Access |
|---|---|
| ADMIN | Full access to everything |
| PROVINCIAL | Only their province's data |
| DISTRICT | Only their district's data |
| DEVICE | Can only push GPS pings for their vehicle |

## GPS Simulation

```bash
node scripts/simulate.js http://localhost:3000 device_dev_0001 Device@5678
```

## Project Structure

```
src/
├── app.js              — Express setup and server start
├── db/
│   ├── database.js     — SQLite setup and helper functions
│   └── seed.js         — Seeds all test data
├── middleware/
│   └── auth.js         — JWT verification and role checks
├── controllers/
│   ├── authController.js
│   ├── vehicleController.js
│   ├── locationController.js
│   ├── geoController.js
│   └── driverController.js
└── routes/
    └── index.js        — All API routes
```
