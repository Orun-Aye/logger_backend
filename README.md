# Apperio Backend API

Apperio is a comprehensive observability and logging platform that helps developers monitor, debug, and optimize their applications in real-time. This repository contains the **Express.js/TypeScript REST API backend** for log ingestion, real-time monitoring, alerting, analytics, and AI-powered insights.

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- MongoDB 5.0+
- Redis (optional, for caching and real-time features)
- npm or yarn

### Installation

```bash
git clone <repository-url>
cd logger_backend
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/apperio

# Authentication
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRY=10h

# Redis (Optional)
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379

# OAuth (Optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# AI Services (Optional)
OPENAI_API_KEY=your-openai-api-key
```

### Running Locally

```bash
# Development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Production server
npm start

# Run tests
npm test

# Run specific test file
npm test -- log.service.test.ts
```

The API will be available at `http://localhost:5000/api/v1`.

## Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 18+ | Runtime |
| **Express** | 5.1.0 | HTTP server framework |
| **TypeScript** | 5.x | Type safety and development experience |
| **MongoDB** | 5.0+ | Document database |
| **Mongoose** | 8.16.4 | MongoDB ODM with schema validation |
| **WebSocket (ws)** | 8.x | Real-time log streaming |
| **JWT** | - | Authentication (10-hour expiry) |
| **Zod** | - | Request validation schemas |
| **Winston** | - | Structured logging with file rotation |
| **Redis** | optional | Caching and real-time features |

## Directory Structure

```
logger_backend/
├── src/
│   ├── models/              # Mongoose schemas (7 models)
│   │   ├── log.model.ts
│   │   ├── project.model.ts
│   │   ├── user.model.ts
│   │   ├── alert-rule.model.ts
│   │   ├── alert-event.model.ts
│   │   ├── custom-dashboard.model.ts
│   │   └── user-preference.model.ts
│   │
│   ├── services/            # Business logic (12+ services)
│   │   ├── log.service.ts
│   │   ├── project.service.ts
│   │   ├── dashboard.service.ts
│   │   ├── alert.service.ts
│   │   ├── analytics.service.ts
│   │   ├── insights.service.ts
│   │   ├── ai-insights.service.ts
│   │   ├── ai-suggestion.service.ts
│   │   ├── regression.service.ts
│   │   ├── funnel.service.ts
│   │   ├── custom-dashboard.service.ts
│   │   ├── websocket.service.ts
│   │   ├── oauth.service.ts
│   │   └── monitoring.service.ts
│   │
│   ├── controllers/         # HTTP request handlers (8 controllers)
│   │   ├── log.controller.ts
│   │   ├── project.controller.ts
│   │   ├── dashboard.controller.ts
│   │   ├── alert.controller.ts
│   │   ├── analytics.controller.ts
│   │   ├── insights.controller.ts
│   │   ├── custom-dashboard.controller.ts
│   │   └── user.controller.ts
│   │
│   ├── routes/              # API route definitions (8 route files)
│   │   ├── log.routes.ts
│   │   ├── project.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── alert.routes.ts
│   │   ├── analytics.routes.ts
│   │   ├── insights.routes.ts
│   │   ├── custom-dashboard.routes.ts
│   │   └── user.routes.ts
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.middleware.ts         # JWT & API key validation
│   │   ├── rate-limiter.middleware.ts # Rate limiting per project
│   │   ├── authorization.middleware.ts # Project scope authorization
│   │   ├── caching.middleware.ts      # Response caching
│   │   ├── sampling.middleware.ts     # Log sampling for high throughput
│   │   ├── validation.middleware.ts   # Zod request validation
│   │   ├── request-id.middleware.ts   # Distributed tracing
│   │   └── request-logger.middleware.ts # Winston HTTP logging
│   │
│   ├── dtos/                # Zod validation schemas (20+ schemas)
│   │   ├── log.dto.ts
│   │   ├── project.dto.ts
│   │   ├── user.dto.ts
│   │   └── alert.dto.ts
│   │
│   ├── utils/               # Utility functions
│   │   ├── db.util.ts       # MongoDB connection
│   │   ├── rule-evaluator.ts # Alert rule evaluation
│   │   └── time.util.ts     # Time formatting & calculation
│   │
│   ├── jobs/                # Scheduled background jobs
│   │   └── retention.job.ts # Automatic log retention cleanup (24h)
│   │
│   ├── config/              # Centralized configuration
│   │   └── index.ts         # Environment validation & type-safe access
│   │
│   ├── infrastructure/      # System infrastructure
│   │   ├── error-handler.ts # Global error handling
│   │   ├── health-check.ts  # Service health status
│   │   └── logger.ts        # Winston logging configuration
│   │
│   ├── types/               # TypeScript type definitions
│   │   ├── express/
│   │   │   └── index.d.ts   # Express augmentation (userId, projectId, project)
│   │   └── domain.ts        # Domain-specific types
│   │
│   ├── app.ts               # Express application setup
│   └── server.ts            # Server entry point
│
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── setup.ts
│
├── .env.example             # Example environment variables
├── .gitignore
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md                # This file
```

## API Endpoints

The API is organized into 8 major route groups. All non-public endpoints require JWT authentication via the `Authorization: Bearer <token>` header. Log ingestion endpoints use API key authentication via the `X-API-Key: <key>` header.

### Authentication & User Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/users/signup` | Register new user | None |
| POST | `/api/v1/users/login` | User login (returns JWT) | None |
| GET | `/api/v1/users/profile` | Get current user profile | JWT |
| PUT | `/api/v1/users/profile` | Update user profile | JWT |
| PUT | `/api/v1/users/change-password` | Change password | JWT |
| POST | `/api/v1/users/oauth/login` | OAuth login (GitHub/Google) | None |

### Log Ingestion & Querying

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/:projectId/logs` | Ingest new log entry | API Key |
| GET | `/api/v1/:projectId/logs` | Query logs with filters & pagination | JWT |
| GET | `/api/v1/:projectId/logs/:logId` | Get specific log entry | JWT |
| GET | `/api/v1/:projectId/logs/summary` | Get log statistics & counts | JWT |
| GET | `/api/v1/:projectId/logs/trends` | Get log trends over time | JWT |
| GET | `/api/v1/:projectId/logs/distinct-values/:field` | Get distinct field values | JWT |
| GET | `/api/v1/:projectId/logs/unique-errors` | Get unique error messages | JWT |
| DELETE | `/api/v1/:projectId/logs` | Delete logs (with filters) | JWT |

### Project Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/projects` | Get user's projects |
| GET | `/api/v1/projects/all` | Get all projects (paginated) |
| GET | `/api/v1/projects/summary` | Get projects summary stats |
| GET | `/api/v1/projects/analytics` | Get analytics across all projects |
| GET | `/api/v1/projects/by-api-key` | Get project by API key |
| GET | `/api/v1/projects/health` | Health check endpoint |
| GET | `/api/v1/projects/:id` | Get project by ID |
| GET | `/api/v1/projects/:id/stats` | Get project statistics |
| GET | `/api/v1/projects/:id/team-members` | Get team members |
| POST | `/api/v1/projects` | Create project |
| PUT | `/api/v1/projects/:id` | Update project |
| PUT | `/api/v1/projects/bulk-update` | Bulk update projects |
| DELETE | `/api/v1/projects/:id` | Delete project |
| DELETE | `/api/v1/projects` | Bulk delete projects |
| POST | `/api/v1/projects/:id/regenerate-api-key` | Regenerate API key |
| PUT | `/api/v1/projects/:id/archive` | Archive project |
| PUT | `/api/v1/projects/:id/restore` | Restore archived project |
| POST | `/api/v1/projects/:sourceProjectId/duplicate` | Duplicate project |
| PUT | `/api/v1/projects/:projectId/transfer-ownership` | Transfer ownership |
| POST | `/api/v1/projects/:projectId/team-members` | Add team member |
| DELETE | `/api/v1/projects/:projectId/team-members` | Remove team member |
| PUT | `/api/v1/projects/:projectId/team-members/role` | Update member role |
| POST | `/api/v1/projects/:projectId/tags` | Add tags |
| DELETE | `/api/v1/projects/:projectId/tags` | Remove tags |
| PUT | `/api/v1/projects/:projectId/rate-limit` | Update rate limit config |
| POST | `/api/v1/projects/:projectId/sync-log-count` | Sync log count |
| POST | `/api/v1/projects/sync-all-log-counts` | Sync all log counts |
| PUT | `/api/v1/projects/:projectId/integration-settings` | Update integrations |

### Dashboard & Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/health` | Health check |
| GET | `/api/v1/dashboard/overview` | Dashboard overview with period comparison |
| GET | `/api/v1/dashboard/metrics` | Comprehensive metrics |
| GET | `/api/v1/dashboard/realtime` | Real-time metrics |
| GET | `/api/v1/dashboard/analytics/users` | User analytics |
| GET | `/api/v1/dashboard/timeseries` | Time series data |
| GET | `/api/v1/dashboard/errors` | Error analysis |
| GET | `/api/v1/dashboard/performance` | Performance metrics |
| GET | `/api/v1/dashboard/alerts` | Alerts data |
| GET | `/api/v1/dashboard/projects` | User projects overview |
| GET | `/api/v1/dashboard/projects/health` | Project health status |
| POST | `/api/v1/dashboard/export` | Export dashboard data |
| POST | `/api/v1/dashboard/admin/multi-user-metrics` | Multi-user metrics (admin) |

### Analytics & Event Analysis

Analytics provides 30+ endpoints organized by event type and metric category. All analytics endpoints include filtering by time period (1h, 24h, 7d, 30d, custom ranges).

#### Activity Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/:projectId/activity/overview` | Activity overview |
| GET | `/api/v1/analytics/:projectId/activity/timeline` | Activity timeline |
| GET | `/api/v1/analytics/:projectId/activity/heatmap` | Activity heatmap |

#### Session Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/:projectId/sessions/overview` | Session overview |
| GET | `/api/v1/analytics/:projectId/sessions/timeline` | Session timeline |
| GET | `/api/v1/analytics/:projectId/sessions/geography` | Session geography |

#### Performance Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/:projectId/performance/overview` | Performance overview |
| GET | `/api/v1/analytics/:projectId/performance/metrics` | Core web vitals |
| GET | `/api/v1/analytics/:projectId/performance/timeline` | Performance timeline |

#### Network Event Analytics (17 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/:projectId/network/overview` | Network overview |
| GET | `/api/v1/analytics/:projectId/network/requests` | Network requests list |
| GET | `/api/v1/analytics/:projectId/network/timeline` | Network timeline |
| GET | `/api/v1/analytics/:projectId/network/top-endpoints` | Top API endpoints |
| GET | `/api/v1/analytics/:projectId/network/slowest` | Slowest requests |

#### Interaction Event Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/:projectId/interactions/overview` | Interaction overview |
| GET | `/api/v1/analytics/:projectId/interactions/timeline` | Interaction timeline |
| GET | `/api/v1/analytics/:projectId/interactions/top-elements` | Top clicked elements |
| GET | `/api/v1/analytics/:projectId/interactions/most-clicked` | Most clicked elements |

#### Console Event Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/:projectId/console/overview` | Console overview |
| GET | `/api/v1/analytics/:projectId/console/messages` | Console messages |
| GET | `/api/v1/analytics/:projectId/console/timeline` | Console timeline |

#### Pageview Event Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/:projectId/pageviews/overview` | Pageview overview |
| GET | `/api/v1/analytics/:projectId/pageviews/timeline` | Pageview timeline |
| GET | `/api/v1/analytics/:projectId/pageviews/top-pages` | Top pages |
| GET | `/api/v1/analytics/:projectId/pageviews/referrers` | Referrer analysis |
| GET | `/api/v1/analytics/:projectId/pageviews/navigation-flow` | Navigation flow |

#### Environment Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/:projectId/environments/stats` | Environment statistics |

### Alert Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/alert-rules` | Create alert rule |
| GET | `/api/v1/alert-rules/:projectId` | Get rules by project |
| GET | `/api/v1/alert-rules/:id` | Get rule by ID |
| PUT | `/api/v1/alert-rules/:id` | Update rule |
| DELETE | `/api/v1/alert-rules/:id` | Delete rule |
| GET | `/api/v1/alerts` | Get user's alerts |
| GET | `/api/v1/alerts/stats` | Get alert statistics |
| GET | `/api/v1/alerts/:projectId` | Get project alerts |
| GET | `/api/v1/alerts/:projectId/stats` | Get project alert stats |
| GET | `/api/v1/alerts/:projectId/distinct/:field` | Get distinct field values |
| PATCH | `/api/v1/alerts/:alertId/status` | Update alert status |
| PATCH | `/api/v1/alerts/bulk-update` | Bulk update alerts |
| DELETE | `/api/v1/alerts` | Delete alerts |
| POST | `/api/v1/alerts/auto-resolve` | Auto-resolve old alerts |
| POST | `/api/v1/alerts/:alertId/acknowledge` | Acknowledge alert |

### Insights & AI Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/insights/:projectId` | Get project insights (Redis cached) |
| GET | `/api/v1/insights/:projectId/invalidate` | Invalidate insights cache |
| GET | `/api/v1/ai-suggestions/:projectId` | Get AI-powered suggestions |

### Custom Dashboards

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/custom-dashboards` | Get user's custom dashboards |
| GET | `/api/v1/custom-dashboards/:id` | Get dashboard by ID |
| POST | `/api/v1/custom-dashboards` | Create custom dashboard |
| PUT | `/api/v1/custom-dashboards/:id` | Update dashboard |
| DELETE | `/api/v1/custom-dashboards/:id` | Delete dashboard |
| POST | `/api/v1/custom-dashboards/:dashboardId/widgets` | Add widget |
| PUT | `/api/v1/custom-dashboards/:dashboardId/widgets/:widgetId` | Update widget |
| DELETE | `/api/v1/custom-dashboards/:dashboardId/widgets/:widgetId` | Remove widget |

### Advanced Analytics

#### Funnel Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/funnels/:projectId` | Get project funnels |
| GET | `/api/v1/funnels/:id` | Get funnel by ID |
| POST | `/api/v1/funnels` | Create funnel |
| PUT | `/api/v1/funnels/:id` | Update funnel |
| DELETE | `/api/v1/funnels/:id` | Delete funnel |

#### Regression Detection

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/regressions/:projectId` | Detect performance regressions |
| POST | `/api/v1/regressions/:projectId/baseline` | Set baseline for comparison |

### User Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/preferences` | Get user preferences |
| GET | `/api/v1/preferences/favorites` | Get favorite projects |
| PUT | `/api/v1/preferences/favorites` | Update favorite projects |

## Authentication

### JWT Authentication

Used for all dashboard and management endpoints. Tokens expire after 10 hours.

```bash
curl -X GET http://localhost:5000/api/v1/projects \
  -H "Authorization: Bearer <jwt-token>"
```

### API Key Authentication

Used by the SDK for log ingestion. Get your API key from the project settings in the dashboard.

```bash
curl -X POST http://localhost:5000/api/v1/my-project-id/logs \
  -H "X-API-Key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Log Schema

All logs ingested via the API must conform to this schema:

```typescript
{
  // Required
  projectId: string;
  timestamp: string;                    // ISO 8601 format
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  message: string;

  // Optional
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  service?: string;
  environment?: string;
  context?: Record<string, any>;
  metadata?: any;

  // Event-specific
  eventType?: "error" | "performance" | "interaction" | "network" | "console" | "pageview";
  userAgent?: string;
  url?: string;
  referrer?: string;
  responseTime?: number;
}
```

## Example API Usage

### Ingest a Log Entry

```bash
curl -X POST http://localhost:5000/api/v1/my-project-id/logs \
  -H "X-API-Key: sk_live_abc123xyz..." \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-03-06T10:30:00Z",
    "level": "error",
    "message": "Failed to process payment",
    "service": "payment-service",
    "environment": "production",
    "error": {
      "name": "PaymentError",
      "message": "Insufficient funds",
      "stack": "Error: Insufficient funds\n    at processPayment..."
    },
    "context": {
      "userId": "user_12345",
      "transactionId": "txn_67890"
    },
    "eventType": "error"
  }'
```

### Query Logs with Filters

```bash
curl -X GET "http://localhost:5000/api/v1/my-project-id/logs?level=error&limit=50&page=1" \
  -H "Authorization: Bearer <jwt-token>"
```

### Get Dashboard Overview

```bash
curl -X GET "http://localhost:5000/api/v1/dashboard/overview?projectId=my-project-id&period=24h" \
  -H "Authorization: Bearer <jwt-token>"
```

### Create Alert Rule

```bash
curl -X POST http://localhost:5000/api/v1/alert-rules \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project-id",
    "name": "High Error Rate",
    "description": "Alert when error rate exceeds 10%",
    "conditions": {
      "field": "level",
      "operator": "equals",
      "value": "error"
    },
    "threshold": 100,
    "enabled": true,
    "notifications": {
      "email": ["ops@company.com"]
    }
  }'
```

## Infrastructure & DevOps

### Database

The backend uses MongoDB with 15+ indexes optimized for common queries:

- Compound indexes on (projectId, timestamp) for fast log retrieval
- Single indexes on frequently filtered fields (level, service, environment)
- TTL indexes for automatic data retention (configurable per project)
- Aggregation pipeline support for analytics

**Connection string format**: `mongodb://[user:password@]host[:port]/database`

### Caching

Redis is optional and improves performance for analytics and real-time features. When enabled, the backend caches:

- Dashboard insights (5-minute TTL)
- Analytics queries (1-hour TTL)
- Project metadata (2-minute TTL)

Set `REDIS_ENABLED=true` in `.env` to enable.

### Logging

All requests and errors are logged via Winston with file rotation:

- **Request logs**: Rotated daily, 7-day retention
- **Error logs**: Rotated daily, 14-day retention
- **Access logs**: Console in development, file in production

Logs include request ID for distributed tracing through the system.

### Health Checks

Three health check endpoints for monitoring:

```bash
# Basic health check
curl http://localhost:5000/api/v1/projects/health

# Readiness (for load balancers)
curl http://localhost:5000/health/ready

# Liveness (for orchestration)
curl http://localhost:5000/health/live
```

### Rate Limiting

Rate limiting is applied per project (default: 100 requests/minute for log ingestion). Configure via project settings endpoint.

### Data Sanitization

All logs are automatically sanitized to remove PII (Personally Identifiable Information) before storage:

- Email addresses
- Social Security Numbers
- Credit card numbers
- API keys and tokens
- Phone numbers
- Custom patterns (configurable)

### Data Retention

Automatic retention cleanup runs every 24 hours. Configure retention policy per project:

```bash
curl -X PUT http://localhost:5000/api/v1/projects/:projectId \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "retentionDays": 30
  }'
```

## Development Workflow

### Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Start MongoDB (if not running)
# On macOS with Homebrew: brew services start mongodb-community

# 3. Start Redis (optional, for caching)
# On macOS with Homebrew: brew services start redis

# 4. Create .env file (see Environment Setup section)

# 5. Start development server
npm run dev
```

### Project Scripts

```bash
# Start development server with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run production server
npm start

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- log.service.test.ts

# Format code with Prettier
npm run format

# Check for linting errors
npm run lint

# Fix linting errors
npm run lint -- --fix
```

### Code Organization

- **Services**: Contain all business logic. Call database models and external APIs.
- **Controllers**: Handle HTTP requests/responses. Call services for business logic.
- **Models**: Define MongoDB schema and database operations.
- **Routes**: Define API routes and connect to controllers.
- **Middleware**: Handle cross-cutting concerns (auth, validation, caching).
- **DTOs**: Validate incoming request data with Zod schemas.

### Express Request Augmentation

The Express Request type is augmented with authenticated user context:

```typescript
// Use these in route handlers
req.userId      // Current user ID (from JWT)
req.projectId   // Current project ID (from route)
req.project     // Full project document (from middleware)
```

This is defined in `src/types/express/index.d.ts`.

### Error Handling

All errors are caught by the global error handler and return standardized responses:

```typescript
// Error response format
{
  "status": "error",
  "message": "Descriptive error message",
  "errors": [...]        // Validation errors if applicable
}
```

11 custom error classes handle different scenarios:

- `ValidationError` - Request validation failed
- `AuthenticationError` - Invalid credentials
- `AuthorizationError` - Insufficient permissions
- `NotFoundError` - Resource not found
- `ConflictError` - Resource already exists
- `RateLimitError` - Rate limit exceeded
- `DatabaseError` - Database operation failed
- `ExternalServiceError` - External API call failed
- `BadRequestError` - Invalid request
- `InternalServerError` - Unexpected server error
- `ServiceUnavailableError` - Service temporarily unavailable

## Testing

The project uses Jest for testing. Write tests for:

- **Services**: Unit tests for business logic
- **Controllers**: Integration tests for API endpoints
- **Middleware**: Tests for authentication and validation

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

## Deployment

### Vercel (Recommended)

The backend is deployed on Vercel at `https://apperioserver.onrender.com/api/v1`.

**Configuration**:
- Root directory: `logger_backend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: Set in Vercel dashboard (same as .env)

**Note**: WebSocket real-time features are limited on Vercel due to serverless constraints. Use polling fallback for real-time updates.

### Self-Hosted

For self-hosted deployments:

1. Build the project: `npm run build`
2. Set environment variables on your server
3. Run: `npm start`
4. Use a reverse proxy (nginx) to handle HTTPS
5. Set up monitoring and logging aggregation

## Related Repositories

- **Frontend Dashboard**: [remote-logger](https://github.com/Stanwukong/remote-logger) — Next.js/React UI
- **JavaScript SDK**: [loghive-sdk](https://github.com/Stanwukong/loghive-sdk) — Client library (`apperio` on npm)

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit with clear messages: `git commit -am 'Add new feature'`
3. Push to your fork: `git push origin feature/your-feature`
4. Open a Pull Request

Code style and tests are enforced via GitHub Actions.

## License

MIT - See LICENSE file for details

## Support

For issues, feature requests, or questions:

- Open an issue on GitHub
- Check existing documentation in CLAUDE.md
- Review the PHASE-1.3-SUMMARY.md for infrastructure details
