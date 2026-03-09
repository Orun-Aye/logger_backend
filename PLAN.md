# PLAN.md — Apperio Backend API Development Roadmap

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

## Phase 1: Infrastructure Hardening ✅ COMPLETE

**Goal**: Make the backend production-ready with proper validation, error handling, and monitoring.

**Completed**: March 2, 2026

### 1.1 Request Validation Layer ✅
- [x] Add Zod middleware for all endpoints
- [x] Create validation schemas for every DTO (log, project, alert, user)
- [x] Return detailed validation errors with field-level messages
- [x] Add request body size limits (1MB-10MB presets)
- [x] Validate query parameters (pagination limits, valid sort fields, date formats)

**Files created**:
- ✅ `src/middleware/validation.middleware.ts` — Generic validation middleware
- ✅ `src/validators/log.validator.ts` — Log endpoint validation schemas
- ✅ `src/validators/project.validator.ts` — Project endpoint validation schemas
- ✅ `src/validators/alert.validator.ts` — Alert endpoint validation schemas
- ✅ `src/validators/user.validator.ts` — User endpoint validation schemas
- ✅ `src/middleware/bodyLimit.middleware.ts` — Body size limit presets

### 1.2 Error Handling Standardization ✅
- [x] Create unified `AppError` base class with code, statusCode, details
- [x] Create 11 error subclasses: `ValidationError`, `NotFoundError`, `AuthError`, `ConflictError`, etc.
- [x] Implement global error handler middleware that maps errors to responses
- [x] Add request ID generation (UUID per request) for error correlation
- [x] Structured error logging (JSON format for production, pretty for development)

**Files created**:
- ✅ `src/errors/index.ts` — Error class hierarchy (11 classes)
- ✅ `src/middleware/errorHandler.middleware.ts` — Global error handler + 404 handler + asyncHandler
- ✅ `src/middleware/requestId.middleware.ts` — Request ID generator

### 1.3 Structured Logging ✅
- [x] Add Winston logger for the backend itself
- [x] Log all requests with: method, path, status, duration, requestId
- [x] Log all errors with: stack trace, requestId, userId, context
- [x] Log all external calls (MongoDB queries, Redis, email, Slack, webhook) via helper methods
- [x] Environment-aware log levels (debug in dev, info in production)
- [x] Daily rotating file transports (14-day errors, 7-day combined)

**Files created**:
- ✅ `src/utils/logger.ts` — Logger configuration with helper methods
- ✅ `src/middleware/requestLogger.middleware.ts` — HTTP request logging

### 1.4 Health & Monitoring ✅
- [x] Enhance health check endpoint with component status:
  - MongoDB connection: connected/disconnected + latency ✅
  - Redis connection: connected/disconnected + latency ✅
  - System: memory usage, uptime, node version ✅
- [x] Add readiness probe endpoint (`/ready`) ✅
- [x] Add liveness probe endpoint (`/live`) ✅

**Files created**:
- ✅ `src/services/health.service.ts` — Health check service
- ✅ `src/controllers/health.controller.ts` — Health endpoints (3 routes)
- ✅ `src/routes/health.routes.ts` — Health routes

### 1.5 Configuration Management ✅
- [x] Implement config module with environment validation
- [x] Fail fast on missing required environment variables
- [x] Add config for: database, redis, jwt, smtp, cors, rate limits, features, etc.
- [x] Type-safe config access throughout the application

**Files created**:
- ✅ `src/config/index.ts` — Centralized configuration with validation
- ✅ `src/config/database.config.ts` — DB connection with event handlers
- ✅ `src/config/auth.config.ts` — JWT + password hashing + API key generation
- ✅ `src/config/notification.config.ts` — Email, Slack, webhook helpers

### 1.6 Database Improvements ✅
- [x] Add MongoDB connection pool configuration
- [x] Add compound indexes for common query patterns (15+ indexes)
- [x] Implement query timeout limits (10-30s per operation type)
- [x] Add database health monitoring service
- [x] Create index verification utility script

**Files created**:
- ✅ `src/services/database-monitor.service.ts` — DB stats, indexes, slow queries, pool monitoring
- ✅ `src/utils/query-timeout.ts` — Query timeout wrappers + global plugin
- ✅ `src/utils/verify-indexes.ts` — Automated index verification script

**Integration**:
- ✅ All middleware integrated in `src/server.ts`
- ✅ Build verified (0 TypeScript errors)
- ✅ Runtime verified (server starts successfully)
- ✅ Health endpoints tested and working
- ✅ Documentation: `PHASE-1.3-SUMMARY.md`, `INTEGRATION-VERIFICATION.md`

---

## Phase 2: Core Feature Enhancement ✅ COMPLETE

**Goal**: Extend backend APIs to support the polished frontend experience.

**Completed**: March 4, 2026

### 2.1 Log System Extensions ✅

**Endpoints Implemented**:
| Method | Path | Description |
|--------|------|-------------|
| POST | `/:projectId/logs/batch` | Batch log ingestion (array of logs) |
| POST | `/:projectId/logs/search` | Structured query language search |
| POST | `/:projectId/logs/export` | Stream logs as CSV/JSON download |
| POST | `/:projectId/logs/saved-searches` | Save a filter configuration |
| GET | `/:projectId/logs/saved-searches` | List saved searches |
| DELETE | `/:projectId/logs/saved-searches/:id` | Delete saved search |

**Service Enhancements**:
- [x] `LogService.batchCreate()` — Accept array of logs, validate each, return results with per-log status
- [x] `LogService.structuredSearch()` — Parse query strings like `level:error AND service:auth AND responseTime>3000`
- [x] `LogService.exportLogs()` — Streaming export with cursor-based pagination for large datasets
- [x] Implement log retention enforcement (background job via `src/jobs/retention.job.ts`, 24h interval)
- [x] Add log sampling configuration (ingestion-time middleware at `src/middleware/sampling.middleware.ts`)

**Model Changes**:
- [x] Add `SavedSearch` model: `{ projectId, userId, name, filters, isDefault, isShared, sortBy, sortOrder, createdAt }`
- [x] Add `correlationId` field to Log model for distributed tracing
- [x] Add `sessionId` field to Log model for session grouping
- [x] Add `retentionConfig` and `samplingConfig` fields to Project model

**Files Created**:
- ✅ `src/middleware/sampling.middleware.ts` — Rate/percentage sampling with cache, always keeps error/fatal
- ✅ `src/jobs/index.ts` — Job registry with `initializeJobs()` / `stopJobs()`
- ✅ `src/jobs/retention.job.ts` — Per-project retention cleanup using RetentionService
- ✅ `src/utils/time.utils.ts` — Shared `parseTimeRange()` and `getPreviousPeriod()` utilities

### 2.2 Alert System Extensions ✅

**Endpoints Implemented**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai-suggestions/:projectId/suggestions` | Rule-based alert rule suggestions |
| POST | `/ai-suggestions/:projectId/suggestions/accept` | Create real rule from suggestion |
| POST | `/alert-rules/:id/test` | Test an alert rule against recent logs |
| POST | `/alert-rules/:id/snooze` | Snooze a rule for X hours |
| GET | `/alert-rules/timeline/:projectId` | Alert timeline (for incident view) |
| GET | `/alert-rules/analytics/:projectId` | Alert frequency, noisiest rules, MTTR |
| POST | `/maintenance-windows` | Create maintenance suppression window |
| GET | `/maintenance-windows` | List maintenance windows |
| POST | `/escalation-policies` | Create escalation policy |
| GET | `/escalation-policies` | List escalation policies |

**Service Enhancements**:
- [x] `AlertService.evaluateCompositeCondition()` — Support AND/OR logic in conditions
- [x] `AlertRuleService.testRule()` — Dry-run a rule against last 100 logs
- [x] `AlertService.getAlertAnalytics()` — Frequency trends, noisiest rules, avg time to resolve
- [x] Add escalation policy evaluation (if not acknowledged in X min, escalate)
- [x] Add maintenance window checking (suppress alerts during window)
- [x] `AISuggestionService.suggestAlertRules()` — Pattern-based suggestions (recurring errors, slow endpoints, error spikes, high error-rate services)

**Model Changes**:
- [x] `AlertRule.condition` — Extend to support `conditions[]` with `operator: "AND"|"OR"`
- [x] Add `EscalationPolicy` model: `{ levels: [{delay, notifyChannels, recipients}] }`
- [x] Add `MaintenanceWindow` model: `{ projectId, startTime, endTime, reason, createdBy }`
- [x] Add `resolvedAt` and `resolutionNotes` to AlertEvent model

**Files Created**:
- ✅ `src/services/aiSuggestion.service.ts` — 4 heuristic-based alert suggestion patterns
- ✅ `src/controllers/aiSuggestion.controller.ts` — Suggestion endpoints
- ✅ `src/routes/aiSuggestion.routes.ts` — `/api/v1/ai-suggestions` routes
- ✅ `src/validators/aiSuggestion.validator.ts` — Zod schemas
- ✅ `src/dtos/aiSuggestion.dto.ts` — DTOs

### 2.3 Project Enhancements ✅

**Endpoints Implemented**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/:projectId/activity/feed` | Project activity feed |
| GET | `/analytics/:projectId/environments/stats` | Per-environment statistics |
| GET | `/preferences/favorites` | Get user's favorite projects |
| POST | `/preferences/favorites` | Favorite a project |
| DELETE | `/preferences/favorites` | Unfavorite a project |
| GET | `/preferences/favorites/:projectId` | Check if project is favorited |
| PUT | `/projects/:projectId/sampling-config` | Update sampling configuration |

**Service Enhancements**:
- [x] `AnalyticsService.getActivityFeed()` — Recent events: log spikes, config changes, alerts
- [x] `AnalyticsService.getEnvironmentStats()` — Per-environment: log count, error rate, avg response time, last activity
- [x] `UserPreferenceService` — User-scoped favorites via separate collection with `$addToSet`/`$pull`

**Model Changes**:
- [x] Add `UserPreference` model: `{ userId, favoriteProjects[], createdAt, updatedAt }`

**Files Created**:
- ✅ `src/models/userPreference.model.ts` — User preferences with unique userId index
- ✅ `src/services/userPreference.service.ts` — Favorites CRUD with project validation
- ✅ `src/controllers/userPreference.controller.ts` — Favorites handlers
- ✅ `src/routes/userPreference.routes.ts` — `/api/v1/preferences` routes
- ✅ `src/validators/userPreference.validator.ts` — Zod validation

### 2.4 Authentication Extensions ✅

**Endpoints Implemented**:
| Method | Path | Description |
|--------|------|-------------|
| POST | `/users/forgot-password` | Send password reset email |
| POST | `/users/reset-password` | Reset password with token |
| GET | `/users/profile` | Get current user profile |
| PUT | `/users/profile` | Update user profile (name, avatar) |
| PUT | `/users/change-password` | Change password (verify current) |
| POST | `/users/oauth/login` | GitHub/Google OAuth code exchange |

**Service Enhancements**:
- [x] `UserService.forgotPassword()` — Generate reset token (1h expiry), send branded email
- [x] `UserService.resetPassword()` — Validate hashed token, update password
- [x] `UserService.getProfile()` — Fetch user excluding sensitive fields
- [x] `UserService.updateProfile()` — Update firstName, lastName, avatarUrl
- [x] `UserService.changePassword()` — Verify current password, hash new one
- [x] `OAuthService.login()` — Handle OAuth code exchange and user creation/login
- [x] Password reset token embedded in User model (`resetPasswordToken`, `resetPasswordExpires`)
- [x] `password` field conditionally required (not required for OAuth users)

**Files Created**:
- ✅ `src/services/oauth.service.ts` — GitHub/Google code exchange + findOrCreateOAuthUser

### 2.5 Dashboard & Analytics Extensions ✅

**Endpoints Implemented**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/custom-dashboards` | List user's custom dashboards |
| POST | `/custom-dashboards` | Create custom dashboard |
| GET | `/custom-dashboards/:id` | Get custom dashboard |
| PUT | `/custom-dashboards/:id` | Update dashboard metadata |
| DELETE | `/custom-dashboards/:id` | Delete dashboard |
| PUT | `/custom-dashboards/:id/layout` | Update widget layout |
| POST | `/custom-dashboards/:id/widgets` | Add widget |
| PUT | `/custom-dashboards/:id/widgets/:widgetId` | Update widget |
| DELETE | `/custom-dashboards/:id/widgets/:widgetId` | Remove widget |
| POST | `/custom-dashboards/:id/duplicate` | Clone dashboard |
| POST | `/funnels/:projectId/analyze` | Funnel analysis with step definitions |
| GET | `/funnels/:projectId/popular-paths` | Most common event paths |
| GET | `/analytics/:projectId/sessions/*` | Session analytics (stats, details, timeline, journeys) |
| GET | `/regressions/:projectId/detect` | Auto-detect performance regressions |
| GET | `/regressions/:projectId/baseline` | Get performance baseline metrics |
| POST | `/regressions/:projectId/compare` | Compare two time periods |

**Service Enhancements**:
- [x] `CustomDashboardService` — Full CRUD + layout management + widget add/update/remove + duplicate + sharing
- [x] `FunnelService.analyzeFunnel()` — Session-based sequential step matching via aggregation
- [x] `FunnelService.getPopularPaths()` — Top N user navigation paths
- [x] `RegressionService.detectRegressions()` — Z-score + percentage threshold comparison
- [x] `RegressionService.getBaseline()` — p50/p95/p99 percentile calculation
- [x] `RegressionService.comparePerformance()` — Arbitrary period comparison
- [x] Session analytics (stats, details, timeline, journeys) in AnalyticsService

**Model Changes**:
- [x] Add `CustomDashboard` model with widgets (grid layout), sharing, tags, default enforcement

**Files Created**:
- ✅ `src/models/customDashboard.model.ts` — Widget schema, grid layout, pre-save default enforcement
- ✅ `src/services/customDashboard.service.ts` — Full CRUD + widget management
- ✅ `src/controllers/customDashboard.controller.ts` — Dashboard handlers with error dispatch
- ✅ `src/routes/customDashboard.routes.ts` — 10 endpoints with Zod validation
- ✅ `src/validators/customDashboard.validator.ts` — Widget, layout, dashboard schemas
- ✅ `src/dtos/customDashboard.dto.ts` — DTOs
- ✅ `src/services/funnel.service.ts` — Funnel analysis with session tracking
- ✅ `src/controllers/funnel.controller.ts` — Funnel handlers
- ✅ `src/routes/funnel.routes.ts` — `/api/v1/funnels` routes
- ✅ `src/validators/funnel.validator.ts` — Step validation schemas
- ✅ `src/dtos/funnel.dto.ts` — DTOs
- ✅ `src/services/regression.service.ts` — Regression detection with stddev analysis
- ✅ `src/controllers/regression.controller.ts` — Regression handlers
- ✅ `src/routes/regression.routes.ts` — `/api/v1/regressions` routes
- ✅ `src/validators/regression.validator.ts` — Validation schemas
- ✅ `src/dtos/regression.dto.ts` — DTOs

**Integration**:
- ✅ All routes registered in `src/server.ts`
- ✅ Background jobs initialized in server startup (non-Vercel only)
- ✅ Build verified (0 TypeScript errors)

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

## Completion Status

### Phase 0: Stabilization ✅
**Completed**: February 2026
- All bugs fixed
- QA baseline established
- Data model inconsistencies resolved

### Phase 1: Infrastructure Hardening ✅
**Completed**: March 2, 2026
- **26 new files** created (validators, middleware, config, services, utils)
- **Request validation** with Zod (4 validator modules, 20+ schemas)
- **Error handling** (11 error classes, global handler, request IDs)
- **Structured logging** (Winston with file rotation, helper methods)
- **Health monitoring** (3 endpoints: /health, /ready, /live)
- **Configuration** (centralized, validated, type-safe)
- **Database optimization** (15+ indexes, query timeouts, monitoring service)
- **Build verified**: 0 TypeScript errors
- **Runtime verified**: Server starts successfully, all endpoints tested
- **Documentation**: PHASE-1.3-SUMMARY.md, INTEGRATION-VERIFICATION.md

### Phase 2: Core Feature Enhancement ✅
**Completed**: March 4, 2026
- **31 new files** created (services, controllers, routes, validators, DTOs, models, middleware, jobs)
- **14 files modified** (server.ts, config, models, services, controllers, routes, types)
- **User profile**: GET/PUT profile, change password, OAuth login (GitHub/Google)
- **Project enhancements**: Favorites, environment stats, sampling config
- **Log management**: Retention background job (24h interval), ingestion-time sampling middleware
- **Custom dashboards**: Full CRUD with widget management, layout, sharing, duplicate
- **Funnel analysis**: Session-based step tracking with popular paths
- **Regression detection**: Current vs baseline comparison with z-score/percentile analysis
- **AI alert suggestions**: 4 heuristic patterns (recurring errors, high error rates, slow endpoints, error spikes)
- **Build verified**: 0 TypeScript errors
- **Route count**: 6 new route groups (preferences, custom-dashboards, funnels, regressions, ai-suggestions + jobs init)

**Next**: Phase 3 (Intelligence).

### Phase 2.5: SDK Feature Integration ✅
**Completed**: March 4, 2026
- **14 new files** created (models, services, controllers, routes, validators)
- **Log model extensions**: traceId, spanId, release fields + 3 new eventTypes + 4 compound indexes
- **SDK remote config**: API key-authenticated endpoint for SDK consumption
- **Distributed tracing**: Trace list, detail, spans with MongoDB aggregation
- **Web vitals aggregation**: p50/p75/p95 percentiles, time-bucketed history, per-page breakdown
- **Source map storage**: Upload, list, resolve (dynamic source-map import), delete
- **Error context**: Breadcrumb-aware search, offline queue metadata support
- **Build verified**: 0 TypeScript errors

---

## Phase 2.5: SDK Feature Integration ✅ COMPLETE

**Goal**: Extend backend APIs to support SDK Phase 2 capabilities — distributed tracing, web vitals, offline sync, remote config (API key auth), source maps, and enhanced error context (breadcrumbs).

**Completed**: March 4, 2026

> **Context**: The SDK (`loghive-sdk/`) shipped Phase 2 with 6 new features. These features generate new data fields and event types that the backend must store, index, query, and expose to the frontend. This phase bridges the gap.

### 2.5.1 Log Model Extensions ✅ **COMPLETE**

**Completed**: March 4, 2026

**Schema Changes** (`src/models/log.model.ts`):
- [x] Add `traceId?: string` field — UUID linking logs within a distributed trace
- [x] Add `spanId?: string` field — UUID identifying the specific span
- [x] Add `release?: string` field — SDK release/version tag (e.g., `"1.2.3"`)
- [x] Extend `eventType` enum: add `'web-vital'`, `'breadcrumb'`, `'message'`

**Indexes**:
- [x] `{ traceId: 1, timestamp: -1 }` — trace-based queries
- [x] `{ projectId: 1, traceId: 1 }` — project + trace
- [x] `{ projectId: 1, release: 1, timestamp: -1 }` — release tracking
- [x] `{ projectId: 1, eventType: 1, timestamp: -1 }` — web vitals time queries

**Validator Changes** (`src/validators/log.validator.ts`):
- [x] Add `traceId`, `spanId`, `release`, `correlationId`, `sessionId` to `createLogSchema`
- [x] Add `traceId`, `spanId`, `release`, `correlationId`, `sessionId` to `filterLogsSchema`
- [x] Extend `eventType` enum in Zod schema

**DTO Changes**:
- [x] Add new fields to `CreateLogDTO`, `FilterLogsDTO` (`log.dto.ts`)
- [x] Add new fields to `BatchLogDTO` (`savedSearch.dto.ts`)

**Service Changes** (`src/services/log.service.ts`):
- [x] Add new filter fields to `buildLogQuery()`
- [x] Add new fields to batch log creation mapping
- [x] Add new fields to CSV export headers and rows

### 2.5.2 SDK Remote Config — API Key Authentication ✅ **COMPLETE**

**Completed**: March 4, 2026

- [x] Created `src/routes/sdk-config-public.routes.ts` — `GET /api/v1/sdk-config` with `authenticateApiKey` middleware
- [x] Added `getConfigByApiKey()` to `SDKConfigController` — reads `req.projectId` from API key, returns curated SDK-relevant config
- [x] Registered route in `server.ts` with open CORS (logIngestionCors)
- [x] Existing JWT-authenticated routes preserved for frontend dashboard management
- [x] SDK calls `GET /api/v1/sdk-config` with `X-API-Key` header → project resolved from API key

**SDK Config Response Format** (for SDK consumption):
```json
{
  "data": {
    "minLogLevel": "info",
    "batchSize": 10,
    "flushIntervalMs": 5000,
    "autoCapture": {
      "errors": true,
      "performance": true,
      "userInteractions": false,
      "networkRequests": true,
      "consoleMessages": false,
      "pageViews": true
    },
    "sanitization": {
      "preset": "BALANCED"
    }
  }
}
```

**Files to create**: `src/routes/sdk-config-public.routes.ts`
**Files to modify**: `src/server.ts` (register route), `src/controllers/sdk-config.controller.ts` (add API-key handler)

### 2.5.3 Distributed Tracing Endpoints ✅ **COMPLETE**

**Completed**: March 4, 2026

- [x] `getTraces(projectId, filters)` — Aggregate logs by `traceId`, compute per-trace summary
- [x] `getTraceDetail(projectId, traceId)` — Fetch all logs for a trace, ordered by timestamp
- [x] `getTraceSpans(projectId, traceId)` — Build span tree from logs with `spanId`/`parentSpanId`
- [x] Registered routes in `server.ts` with `restrictedCors`

**Files created (4)**: `trace.validator.ts`, `trace.service.ts`, `trace.controller.ts`, `trace.routes.ts`

### 2.5.4 Web Vitals Aggregation ✅ **COMPLETE**

**Completed**: March 4, 2026

- [x] `getWebVitals(projectId, timeRange)` — Aggregate by vital name, compute p50/p75/p95 + rating distribution (with MongoDB 5.2 `$sortArray` fallback to JS percentile)
- [x] `getWebVitalsHistory(projectId, timeRange, interval)` — Time-bucketed aggregation using `$dateTrunc`
- [x] `getWebVitalsByPage(projectId, timeRange)` — Per-URL breakdown of vitals, top 50 pages
- [x] Registered routes in `server.ts` with `restrictedCors`

**Files created (4)**: `webVitals.validator.ts`, `webVitals.service.ts`, `webVitals.controller.ts`, `webVitals.routes.ts`

### 2.5.5 Source Map Storage & De-Minification ✅ **COMPLETE**

**Completed**: March 4, 2026

- [x] Created `SourceMap` model with `projectId`, `release`, `fileName`, `originalFileName`, `sourceMapData`, `uploadedBy`, `fileSize`
- [x] Compound unique index on `{ projectId, release, originalFileName }`
- [x] `uploadSourceMap()` — upsert with JSON validation
- [x] `listSourceMaps()` — by project, optionally filtered by release (excludes sourceMapData for performance)
- [x] `resolveStackTrace()` — regex frame parsing + dynamic `import('source-map')` with graceful fallback
- [x] `deleteSourceMap()` — remove by ID
- [x] POST upload with API key auth, GET/POST resolve/DELETE with JWT auth
- [x] Resolve route placed before `:id` param route to prevent "resolve" matching as ID

**Files created (5)**: `sourceMap.model.ts`, `sourceMap.validator.ts`, `sourceMap.service.ts`, `sourceMap.controller.ts`, `sourceMap.routes.ts`
**Files modified**: `src/server.ts` (registered routes)

### 2.5.6 Enhanced Error Context Storage ✅ **COMPLETE**

**Completed**: March 4, 2026

- [x] No model changes needed (breadcrumbs/environment stored in flexible `data` field)
- [x] Extended `buildLogQuery()` search to match `data.breadcrumbs.message` via `$or` clause
- [x] Breadcrumb/environment schema documented for frontend consumption

### 2.5.7 Offline Queue Bulk Sync ✅ **COMPLETE**

**Completed**: March 4, 2026

- [x] Verified `POST /:projectId/logs/batch` handles varying timestamps (preserves client-provided values)
- [x] Batch endpoint preserves original `timestamp` values (not overwriting with server time)
- [x] `offlineQueued` metadata flag supported via existing flexible `metadata` field

---

### Implementation Order

```
Step 1: Log Model Extensions (2.5.1)         ← unlocks everything else
Step 2: SDK Config API Key Auth (2.5.2)       ← SDK already calling this
Step 3: Web Vitals Aggregation (2.5.4)        ← new dashboard feature
Step 4: Distributed Tracing Endpoints (2.5.3) ← new dashboard feature
Step 5: Source Map Storage (2.5.5)            ← enhances error debugging
Step 6: Error Context + Offline (2.5.6, 2.5.7) ← verification + docs
```

### New Files Summary (Phase 2.5)

| File | Purpose |
|------|---------|
| `src/models/sourceMap.model.ts` | Source map storage schema |
| `src/services/trace.service.ts` | Distributed trace queries |
| `src/services/webVitals.service.ts` | Web vital aggregation |
| `src/services/sourceMap.service.ts` | Source map CRUD + resolution |
| `src/controllers/trace.controller.ts` | Trace endpoint handlers |
| `src/controllers/webVitals.controller.ts` | Web vitals endpoint handlers |
| `src/controllers/sourceMap.controller.ts` | Source map endpoint handlers |
| `src/routes/trace.routes.ts` | Trace API routes |
| `src/routes/webVitals.routes.ts` | Web vitals API routes |
| `src/routes/sourceMap.routes.ts` | Source map API routes |
| `src/routes/sdk-config-public.routes.ts` | API-key-authenticated SDK config |
| `src/validators/trace.validator.ts` | Trace query validation |
| `src/validators/webVitals.validator.ts` | Web vitals query validation |
| `src/validators/sourceMap.validator.ts` | Source map upload validation |

### Files to Modify (Phase 2.5)

| File | Changes |
|------|---------|
| `src/models/log.model.ts` | Add `traceId`, `spanId`, `release` fields; extend `eventType` enum; add 4 indexes |
| `src/validators/log.validator.ts` | Add new fields to Zod schema |
| `src/dtos/log.dto.ts` | Add new fields to DTOs |
| `src/controllers/sdk-config.controller.ts` | Add API-key-authenticated handler |
| `src/server.ts` | Register 4 new route groups |
| `src/services/log.service.ts` | Verify batch timestamp handling |

---

*Last updated: March 4, 2026*
