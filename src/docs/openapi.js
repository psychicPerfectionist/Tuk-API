// src/docs/openapi.js
// Minimal OpenAPI spec for Swagger UI

const VERSION = '1.0.0';

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Sri Lanka Police – Tuk-Tuk Tracking API',
    version: VERSION,
    description: 'REST API for tracking registered three-wheelers (tuk-tuks) across Sri Lanka.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Vehicles' },
    { name: 'Locations' },
    { name: 'Geography' },
    { name: 'Drivers' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
        },
        required: ['success', 'message'],
      },
      LoginRequest: {
        type: 'object',
        properties: {
          username: { type: 'string', example: 'admin' },
          password: { type: 'string', example: 'Admin@1234' },
        },
        required: ['username', 'password'],
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          token: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              username: { type: 'string', example: 'admin' },
              full_name: { type: 'string', example: 'System Administrator' },
              role: { type: 'string', example: 'ADMIN' },
            },
            required: ['id', 'username', 'role'],
          },
        },
        required: ['success', 'token', 'user'],
      },
      PushLocationRequest: {
        type: 'object',
        properties: {
          vehicle_id: { type: 'integer', example: 1 },
          latitude: { type: 'number', example: 6.9271 },
          longitude: { type: 'number', example: 79.8612 },
          speed: { type: 'number', nullable: true, example: 12.3 },
          heading: { type: 'number', nullable: true, example: 90 },
          accuracy: { type: 'number', nullable: true, example: 5.2 },
        },
        required: ['vehicle_id', 'latitude', 'longitude'],
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          200: {
            description: 'Service healthy',
          },
        },
      },
    },

    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and get a JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Logged in', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profile' },
          401: { description: 'No/invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/provinces': {
      get: {
        tags: ['Geography'],
        summary: 'List provinces',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Province list' },
          401: { description: 'No/invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        tags: ['Geography'],
        summary: 'Create province (ADMIN)',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Created' },
          401: { description: 'No/invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/districts': {
      get: {
        tags: ['Geography'],
        summary: 'List districts',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'province_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'sort', in: 'query', required: false, schema: { type: 'string', example: 'name:asc' } },
        ],
        responses: { 200: { description: 'District list' } },
      },
      post: {
        tags: ['Geography'],
        summary: 'Create district (ADMIN)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created' } },
      },
    },

    '/api/stations': {
      get: {
        tags: ['Geography'],
        summary: 'List stations',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'district_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'province_id', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Stations list' } },
      },
      post: {
        tags: ['Geography'],
        summary: 'Create station (ADMIN/PROVINCIAL)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created' } },
      },
    },

    '/api/vehicles': {
      get: {
        tags: ['Vehicles'],
        summary: 'List vehicles',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'province_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'district_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'station_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'ACTIVE' } },
          { name: 'sort', in: 'query', required: false, schema: { type: 'string', example: 'registration_number:asc' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', example: 20 } },
        ],
        responses: { 200: { description: 'Vehicles list' } },
      },
      post: {
        tags: ['Vehicles'],
        summary: 'Register vehicle (ADMIN/PROVINCIAL)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created' } },
      },
    },

    '/api/vehicles/{id}': {
      get: {
        tags: ['Vehicles'],
        summary: 'Get vehicle by id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Vehicle' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Vehicles'],
        summary: 'Update vehicle (ADMIN/PROVINCIAL)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Vehicles'],
        summary: 'Deregister vehicle (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'No content' } },
      },
    },

    '/api/vehicles/{id}/location': {
      get: {
        tags: ['Vehicles'],
        summary: 'Get last known location',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Last location' }, 404: { description: 'No data' } },
      },
    },

    '/api/vehicles/{id}/history': {
      get: {
        tags: ['Vehicles'],
        summary: 'Get location history (time window)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', example: 1000 } },
        ],
        responses: { 200: { description: 'History' } },
      },
    },

    '/api/locations': {
      get: {
        tags: ['Locations'],
        summary: 'Query location pings',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'vehicle_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'province_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'district_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'from', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'to', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Pings' } },
      },
      post: {
        tags: ['Locations'],
        summary: 'Device push location ping',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PushLocationRequest' },
            },
          },
        },
        responses: {
          201: { description: 'Recorded' },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'No/invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Vehicle not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          422: { description: 'Outside Sri Lanka', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/locations/live': {
      get: {
        tags: ['Locations'],
        summary: 'Latest ping for every active vehicle',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'province_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'district_id', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Live view' } },
      },
    },

    '/api/drivers': {
      get: {
        tags: ['Drivers'],
        summary: 'List drivers',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'ACTIVE' } },
          { name: 'sort', in: 'query', required: false, schema: { type: 'string', example: 'full_name:asc' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Drivers list' } },
      },
      post: {
        tags: ['Drivers'],
        summary: 'Create driver (ADMIN/PROVINCIAL)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created' } },
      },
    },

    '/api/drivers/{id}': {
      get: {
        tags: ['Drivers'],
        summary: 'Get driver by id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Driver' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Drivers'],
        summary: 'Update driver (ADMIN/PROVINCIAL)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
    },
  },
};
