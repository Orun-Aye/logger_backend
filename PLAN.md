# PLAN.md — Monita Backend API Development Roadmap

> **Component**: `logger_backend/` — Express.js/TypeScript REST API with MongoDB
> **Parent Plan**: [../PLAN.md](../PLAN.md)
> **Product Spec**: [../PRODUCT.md](../PRODUCT.md)

---

## Phase 0: Stabilization

**Goal**: Fix all known bugs and inconsistencies in existing code.

### 0.1 Data Model & DTO Fixes
- [x] Fix `desccription` typo in `src/dtos/project.dto.ts` → `description`
- [x] Fix `keyword` type in `src/dtos/alertRule.dto.ts` — change from `number` to `string`
- [x] Audit all model enum values match DTO enum values (LogLevel, eventType, severity, status)
- [x] Verify all Mongoose ref model names match actual model registrations
- [x] Add missing required field validations in DTOs
- [x] Ensure `UpdateProjectDTO` fields match what `ProjectService.updateProject()` accepts

### 0.2 Service Logic Fixes
- [x] `LogService.createLog()`: Fix timestamp normalization for edge cases (Unix timestamps, malformed ISO strings)
- [x] `LogService.getAllLogs()`: Verify `levels` array filter works correctly (using `$in` operator)
- [x] `LogService.deleteLogs()`: Verify the "at least one filter" check works (prevent mass deletion)
- [x] `ProjectService.createProject()`: Ensure name uniqueness check is case-insensitive
- [x] `ProjectService.getProjectsByUser()`: Verify `searchBy` filter works for "both" (owner OR team member)
- [x] `AlertService.evaluateLogAndTrigger()`: Fix potential race condition in frequency-based threshold check
- [x] `AlertService.isDuplicateAlert()`: Verify time window calculation is correct
- [x] `NotificationService.sendSlack()`: Verify payload format matches Slack webhook API
- [x] `DashboardService.getDashboardMetrics()`: Fix potential crash when no logs exist for a project
- [x] `DashboardInsightsService`: Verify Redis connection error handling doesn't crash the server

### 0.3 Controller & Route Fixes
- [x] Verify all controller methods have try-catch with proper error type mapping
- [x] Ensure consistent response format: `{ status: "success"|"error", data?, message?, meta? }`
- [x] Fix any controllers that return raw data without wrapping in response format
- [x] Verify all routes have correct middleware applied (verifyToken vs authenticateApiKey)
- [x] Check for route parameter conflicts (e.g., `/:id` vs `/:projectId` on same base path)
- [x] Ensure `AlertEventController.getAlerts()` works for both project-scoped and user-scoped queries
- [x] Verify `AlertEventController.bulkUpdateAlerts()` is fully implemented

### 0.4 Middleware Fixes
- [x] `auth.middleware.ts`: Verify JWT verification handles expired tokens with clear error message
- [x] `authorizeProjectAccess.ts`: Ensure middleware populates `req.project` consistently
- [x] `rateLimit.middleware.ts`: Verify rate limit headers are sent in response (X-RateLimit-*)
- [x] `cache.middleware.ts`: Verify cache key generation doesn't collide for different users

### 0.5 Cross-Cutting
- [x] Verify CORS allows both production frontend and localhost:3000
- [x] Ensure WebSocket CORS matches HTTP CORS configuration
- [x] Verify all environment variables have fallback defaults or fail-fast validation
- [x] Add missing TypeScript strict checks (noImplicitAny, strictNullChecks)

---

## Phase 1: Infrastructure Hardening

**Goal**: Make the backend production-ready with proper validation, error handling, and monitoring.

### 1.1 Request Validation Layer
- [ ] Add Zod or express-validator middleware for all endpoints
- [ ] Create validation schemas for every DTO
- [ ] Return detailed validation errors with field-level messages
- [ ] Add request body size limits (log payloads max 1MB)
- [ ] Validate query parameters (pagination limits, valid sort fields, date formats)

**Files to create/modify**:
- `src/middleware/validation.middleware.ts` — Generic validation middleware
- `src/validators/log.validator.ts` — Log endpoint validation schemas
- `src/validators/project.validator.ts` — Project endpoint validation schemas
- `src/validators/alert.validator.ts` — Alert endpoint validation schemas
- `src/validators/user.validator.ts` — User endpoint validation schemas

### 1.2 Error Handling Standardization
- [ ] Create unified `AppError` base class with code, statusCode, details
- [ ] Create specific error subclasses: `ValidationError`, `NotFoundError`, `AuthError`, `ConflictError`
- [ ] Implement global error handler middleware that maps errors to responses
- [ ] Add request ID generation (UUID per request) for error correlation
- [ ] Structured error logging (JSON format for production, pretty for development)

**Files to create/modify**:
- `src/errors/index.ts` — Error class hierarchy
- `src/middleware/errorHandler.middleware.ts` — Global error handler
- `src/middleware/requestId.middleware.ts` — Request ID generator

### 1.3 Structured Logging
- [ ] Add Winston or Pino logger for the backend itself
- [ ] Log all requests with: method, path, status, duration, requestId
- [ ] Log all errors with: stack trace, requestId, userId, context
- [ ] Log all external calls (MongoDB queries, Redis, email, Slack, webhook)
- [ ] Environment-aware log levels (debug in dev, info in production)

**Files to create/modify**:
- `src/utils/logger.ts` — Logger configuration
- `src/middleware/requestLogger.middleware.ts` — HTTP request logging

### 1.4 Health & Monitoring
- [ ] Enhance health check endpoint with component status:
  - MongoDB connection: connected/disconnected + latency
  - Redis connection: connected/disconnected + latency
  - WebSocket server: running/stopped + connected clients
  - System: memory usage, uptime, node version
- [ ] Add readiness probe endpoint (`/ready`)
- [ ] Add liveness probe endpoint (`/live`)

**Files to modify**:
- `src/controllers/health.controller.ts` — Enhanced health check

### 1.5 Configuration Management
- [ ] Implement config module with environment validation
- [ ] Fail fast on missing required environment variables
- [ ] Add config for: database, redis, jwt, smtp, cors, rate limits
- [ ] Type-safe config access throughout the application

**Files to create**:
- `src/config/index.ts` — Centralized configuration
- `src/config/database.config.ts`
- `src/config/auth.config.ts`
- `src/config/notification.config.ts`

### 1.6 Database Improvements
- [ ] Add MongoDB connection pool configuration
- [ ] Implement database migration strategy (schema versioning)
- [ ] Add compound indexes for common query patterns not yet indexed
- [ ] Implement query timeout limits
- [ ] Add database health monitoring

---

## Phase 2: Core Feature Enhancement

**Goal**: Extend backend APIs to support the polished frontend experience.

### 2.1 Log System Extensions

**New Endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| POST | `/:projectId/logs/batch` | Batch log ingestion (array of logs) |
| POST | `/:projectId/logs/search` | Structured query language search |
| GET | `/:projectId/logs/export` | Stream logs as CSV/JSON download |
| POST | `/:projectId/logs/saved-searches` | Save a filter configuration |
| GET | `/:projectId/logs/saved-searches` | List saved searches |
| DELETE | `/:projectId/logs/saved-searches/:id` | Delete saved search |

**Service Enhancements**:
- [ ] `LogService.batchCreate()` — Accept array of logs, validate each, return results with per-log status
- [ ] `LogService.structuredSearch()` — Parse query strings like `level:error AND service:auth AND responseTime>3000`
- [ ] `LogService.exportLogs()` — Streaming export with cursor-based pagination for large datasets
- [ ] Implement log retention enforcement (background job that deletes expired logs)
- [ ] Add log sampling configuration (accept every Nth log for high-volume projects)

**Model Changes**:
- [ ] Add `SavedSearch` model: `{ projectId, userId, name, filters, isDefault, createdAt }`
- [ ] Add `correlationId` field to Log model for distributed tracing
- [ ] Add `sessionId` field to Log model for session grouping

### 2.2 Alert System Extensions

**New Endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:projectId/alert-rules/suggestions` | AI-suggested alert rules |
| POST | `/alert-rules/:id/test` | Test an alert rule against recent logs |
| POST | `/alert-rules/:id/snooze` | Snooze a rule for X hours |
| GET | `/alerts/timeline` | Alert timeline (for incident view) |
| GET | `/alerts/analytics` | Alert frequency, noisiest rules, MTTR |
| POST | `/maintenance-windows` | Create maintenance suppression window |
| GET | `/maintenance-windows` | List maintenance windows |

**Service Enhancements**:
- [ ] `AlertService.evaluateCompositeCondition()` — Support AND/OR logic in conditions
- [ ] `AlertRuleService.testRule()` — Dry-run a rule against last 100 logs
- [ ] `AlertService.getAlertAnalytics()` — Frequency trends, noisiest rules, avg time to resolve
- [ ] Add escalation policy evaluation (if not acknowledged in X min, escalate)
- [ ] Add maintenance window checking (suppress alerts during window)

**Model Changes**:
- [ ] `AlertRule.condition` — Extend to support `conditions[]` with `operator: "AND"|"OR"`
- [ ] Add `EscalationPolicy` model: `{ levels: [{delay, notifyChannels, recipients}] }`
- [ ] Add `MaintenanceWindow` model: `{ projectId, startTime, endTime, reason, createdBy }`
- [ ] Add `resolvedAt` and `resolutionNotes` to AlertEvent model

### 2.3 Project Enhancements

**New Endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:projectId/activity` | Project activity feed |
| GET | `/:projectId/environments` | List distinct environments with stats |
| POST | `/:projectId/favorites` | Favorite a project |
| DELETE | `/:projectId/favorites` | Unfavorite a project |

**Service Enhancements**:
- [ ] `ProjectService.getActivityFeed()` — Recent events: log spikes, config changes, alerts, team changes
- [ ] `ProjectService.getEnvironmentStats()` — Per-environment: log count, error rate, last activity
- [ ] Add project favorites (user-scoped, stored in User model or separate collection)

### 2.4 Authentication Extensions

**New Endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| POST | `/users/forgot-password` | Send password reset email |
| POST | `/users/reset-password` | Reset password with token |
| GET | `/users/profile` | Get current user profile |
| PUT | `/users/profile` | Update user profile |
| POST | `/users/oauth/github` | GitHub OAuth callback |
| POST | `/users/oauth/google` | Google OAuth callback |

**Service Enhancements**:
- [ ] `UserService.requestPasswordReset()` — Generate reset token, send email
- [ ] `UserService.resetPassword()` — Validate token, update password
- [ ] `UserService.updateProfile()` — Update name, avatar
- [ ] `UserService.oauthLogin()` — Handle OAuth code exchange and user creation/login
- [ ] Add password reset token model or embed in User model

### 2.5 Dashboard & Analytics Extensions

**New Endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/custom/:dashboardId` | Get custom dashboard |
| POST | `/dashboard/custom` | Create custom dashboard |
| PUT | `/dashboard/custom/:dashboardId` | Update dashboard layout |
| GET | `/analytics/funnels/:projectId` | Funnel analysis |
| GET | `/analytics/sessions/:projectId` | Session analytics |
| GET | `/analytics/regression/:projectId` | Performance regression detection |

---

## Phase 3: Intelligence

**Goal**: Add AI-powered analysis and recommendation capabilities.

### 3.1 AI Insights Service
- [ ] Complete OpenAI integration for log analysis
- [ ] Implement insight caching strategy (per-project, per-time-range)
- [ ] Create insight types: error root cause, performance suggestion, anomaly explanation
- [ ] Add rate limiting for AI calls (cost management)
- [ ] Implement fallback when OpenAI is unavailable

**New Endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| POST | `/insights/:projectId/ask` | Natural language query |
| GET | `/insights/:projectId/root-cause/:errorId` | Error root cause analysis |
| GET | `/insights/:projectId/anomalies` | Detected anomalies |
| GET | `/insights/:projectId/suggestions` | Optimization suggestions |

### 3.2 Anomaly Detection Service
- [ ] Statistical anomaly detection (Z-score, moving average deviation)
- [ ] Baseline calculation (rolling 7-day average per metric)
- [ ] Anomaly types: log volume spike, error rate increase, response time degradation
- [ ] Background job for periodic anomaly scanning
- [ ] Anomaly alert integration (trigger alerts when anomalies detected)

**Files to create**:
- `src/services/anomaly.service.ts`
- `src/models/anomaly.model.ts` — Detected anomalies with timestamp, type, severity, metrics

### 3.3 Smart Suggestions
- [ ] Alert rule suggestions based on historical log patterns
- [ ] Performance optimization suggestions based on slow endpoints
- [ ] SDK configuration recommendations based on project characteristics

---

## Phase 4: Enterprise

**Goal**: Add organization, billing, compliance, and enterprise security features.

### 4.1 Data Models

**New Models**:
```
Organization {
  name, slug, billingEmail, plan,
  settings: { sso, mfa, ipAllowlist, dataRetention },
  members: [{ userId, role: owner|admin|member|billing }],
  createdAt, updatedAt
}

Team {
  organizationId, name, description,
  members: [{ userId, role: lead|member }],
  projectAccess: [{ projectId, permission: view|edit|admin }],
  createdAt
}

AuditLog {
  organizationId, userId, action, resource, resourceId,
  details, ipAddress, userAgent, timestamp
}

Subscription {
  organizationId, stripeCustomerId, stripeSubscriptionId,
  plan, status, currentPeriodEnd, usage: { logs, apiCalls, storage },
  createdAt
}

ApiToken {
  userId, organizationId, name, token (hashed),
  scopes: string[], expiresAt, lastUsedAt, createdAt
}
```

### 4.2 Billing Integration
- [ ] Stripe SDK integration
- [ ] Subscription lifecycle (create, update, cancel, resume)
- [ ] Usage metering (log count per billing period)
- [ ] Webhook handler for Stripe events
- [ ] Plan limit enforcement in log ingestion middleware
- [ ] Invoice generation and retrieval

### 4.3 Enterprise Security
- [ ] TOTP-based MFA (speakeasy or otplib)
- [ ] SAML/SSO integration (passport-saml)
- [ ] IP allowlist middleware
- [ ] API token authentication (alongside JWT and API key)
- [ ] Session management (list active, force logout)
- [ ] Audit logging middleware (auto-log all mutations)
- [ ] Field-level encryption for sensitive data

### 4.4 Compliance
- [ ] GDPR data export (all user data as JSON/CSV)
- [ ] GDPR right to deletion (purge user + all associated data)
- [ ] Data retention enforcement service (background job)
- [ ] Compliance report generation endpoint

---

## Phase 5: Ecosystem

### 5.1 API Enhancements
- [ ] GraphQL endpoint (Apollo Server) alongside REST
- [ ] OpenAPI/Swagger documentation generation
- [ ] API versioning (v2 with breaking changes isolated)
- [ ] Webhook management (user-configurable outbound webhooks)

### 5.2 Integration Service
- [ ] GitHub App integration (OAuth, issues API)
- [ ] Jira integration (OAuth, issues API)
- [ ] PagerDuty integration (Events API v2)
- [ ] Discord webhook support
- [ ] Microsoft Teams connector

**Files to create**:
- `src/services/integrations/github.integration.ts`
- `src/services/integrations/jira.integration.ts`
- `src/services/integrations/pagerduty.integration.ts`
- `src/services/integrations/discord.integration.ts`

### 5.3 Background Jobs
- [ ] Implement job queue (Bull/BullMQ with Redis)
- [ ] Jobs: log retention cleanup, anomaly scanning, usage metering, report generation
- [ ] Job dashboard for monitoring

---

## Phase 6: Scale

### 6.1 Database Optimization
- [ ] Read replicas for analytics queries
- [ ] Time-based collection partitioning for logs
- [ ] Query optimization (explain analysis, index tuning)
- [ ] Connection pool tuning

### 6.2 Ingestion Pipeline
- [ ] Message queue for async log processing (decouple ingestion from storage)
- [ ] Bulk write operations for batch ingestion
- [ ] Write concern optimization per operation type
- [ ] Backpressure handling

### 6.3 Caching Strategy
- [ ] Redis cluster for distributed caching
- [ ] Cache warming for frequently accessed dashboards
- [ ] Cache invalidation strategy (event-driven, not time-based)

---

## Testing Strategy

### Unit Tests (Phase 0+)
- Every service method has unit tests
- Mock database operations
- Test edge cases: empty inputs, invalid IDs, boundary values
- Framework: Jest with ts-jest

### Integration Tests (Phase 1+)
- Test full request → response cycles
- Use MongoDB Memory Server for isolated testing
- Test middleware chains (auth + validation + handler)
- Test error handling paths

### Load Tests (Phase 2+)
- Test log ingestion throughput (target: 1000 logs/second)
- Test dashboard query performance under load
- Test WebSocket connection capacity
- Tool: Artillery or k6

---

*Last updated: March 2026*
