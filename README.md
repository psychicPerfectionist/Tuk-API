# Sri Lanka Police – Tuk-Tuk Tracking API

> **NB6007CEM Web API Development — Individual Coursework**
> Student ID: [YOUR_STUDENT_ID_HERE]

Real-Time Three-Wheeler (Tuk-Tuk) Tracking & Movement Logging System.

## 🌐 Live Deployment

| Resource | URL |
|---|---|
| **API Base URL** | https://tuk-tuk-api.onrender.com/api/v1 |
| **Swagger UI** | https://tuk-tuk-api.onrender.com/api-docs |
| **Health Check** | https://tuk-tuk-api.onrender.com/api/v1/health |

## 🚀 Quick Start

```bash
npm install && npm run seed && npm start
```

## 🧪 Testing & Linting

```bash
npm test        # 44 tests
npm run lint    # zero errors
```

## 🔐 Default Credentials

| Role | Username | Password |
|---|---|---|
| ADMIN | admin | Admin@1234 |
| PROVINCIAL | wp_officer | Admin@1234 |
| DISTRICT | cmb_officer | Admin@1234 |
| DEVICE | device_dev-0001 | Device@5678 |

## 📡 Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/auth/login | Login — get JWT |
| GET | /api/v1/vehicles | List with sort/filter/pagination |
| GET | /api/v1/vehicles/:id/location | Last known location |
| GET | /api/v1/vehicles/:id/history | Movement log (?from=&to=) |
| GET | /api/v1/locations/live | Live dashboard |
| POST | /api/v1/locations | Push GPS ping (DEVICE) |

## 🔃 Sorting

```
GET /api/v1/vehicles?sort=registrationNumber:asc
GET /api/v1/drivers?sort=fullName:desc
GET /api/v1/provinces?sort=name:asc
GET /api/v1/districts?sort=code:desc
```

## 🔑 Roles

| Role | Scope | Push Pings | View |
|---|---|---|---|
| ADMIN | All | Yes | Everything |
| PROVINCIAL | Own province | No | Province |
| DISTRICT | Own district | No | District |
| DEVICE | Own vehicle | Yes | None |

## 📁 Structure

```
src/
├── app.js              Express + security middleware
├── config/             Database + Swagger
├── middleware/         Auth (JWT/RBAC) + Response helpers
├── models/             Data model layer (internal entities)
├── resources/          Resource model layer (client representations)
├── controllers/        Business logic
├── validators/         Input validation (express-validator)
├── routes/             API routes
└── data/seed.js        Seed script
tests/api.test.js       44 Jest tests
nginx/nginx.conf        Production nginx with TLS
```

## 📚 NB6007CEM – Web API Development | NIBM / Coventry University
