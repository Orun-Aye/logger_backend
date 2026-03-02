"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalServices = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
// Phase 1.3 Infrastructure
const config_1 = require("./config");
const database_config_1 = require("./config/database.config");
const requestId_middleware_1 = require("./middleware/requestId.middleware");
const requestLogger_middleware_1 = require("./middleware/requestLogger.middleware");
const errorHandler_middleware_1 = require("./middleware/errorHandler.middleware");
const query_timeout_1 = require("./utils/query-timeout");
const logger_1 = __importDefault(require("./utils/logger"));
// Routes
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const sdk_config_routes_1 = __importDefault(require("./routes/sdk-config.routes"));
const log_routes_1 = __importDefault(require("./routes/log.routes"));
const alertRule_routes_1 = __importDefault(require("./routes/alertRule.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const alertEvent_routes_1 = __importDefault(require("./routes/alertEvent.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const insights_routes_1 = __importDefault(require("./routes/insights.routes"));
// Services
const websocket_service_1 = require("./services/websocket.service");
const db_1 = require("./utils/db");
// Initialize configuration (validates environment variables)
(0, config_1.initializeConfig)();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Check if running in Vercel serverless environment
const isVercel = process.env.VERCEL === "1";
// CORS configuration for dashboard/admin routes (restricted)
const restrictedCors = (0, cors_1.default)({
    origin: config_1.config.cors.origin,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: config_1.config.cors.credentials,
    allowedHeaders: ["Content-Type", "Authorization"],
});
// CORS configuration for log ingestion (open to all origins)
const logIngestionCors = (0, cors_1.default)({
    origin: true, // Allow all origins
    methods: ["POST", "GET"],
    credentials: false,
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Source-Origin",
        "User-Agent",
    ],
});
// Phase 1.3 Global Middleware (order matters!)
app.use(express_1.default.json());
app.use(requestId_middleware_1.requestIdMiddleware);
app.use(requestLogger_middleware_1.conditionalRequestLogger);
app.get("/", (req, res) => {
    res.type("html").send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>LogHive Backend API</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }

          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
          }

          .header {
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white;
            padding: 40px;
            text-align: center;
          }

          .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
          }

          .header p {
            font-size: 1.2rem;
            opacity: 0.9;
            margin-bottom: 20px;
          }

          .status-badge {
            display: inline-block;
            background: #27ae60;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
          }

          .content {
            padding: 40px;
          }

          .section {
            margin-bottom: 40px;
          }

          .section h2 {
            color: #2c3e50;
            font-size: 1.8rem;
            margin-bottom: 20px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
          }

          .section h3 {
            color: #34495e;
            font-size: 1.3rem;
            margin: 20px 0 10px 0;
          }

          .tech-stack {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }

          .tech-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
            transition: transform 0.2s;
          }

          .tech-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }

          .tech-item strong {
            color: #2c3e50;
            display: block;
            margin-bottom: 5px;
          }

          .api-endpoints {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }

          .endpoint {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 15px;
            margin: 10px 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          }

          .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-right: 10px;
          }

          .method.post { background: #28a745; color: white; }
          .method.get { background: #007bff; color: white; }
          .method.put { background: #ffc107; color: black; }
          .method.delete { background: #dc3545; color: white; }

          .architecture {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }

          .arch-component {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
          }

          .arch-component h4 {
            font-size: 1.1rem;
            margin-bottom: 10px;
          }

          .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }

          .feature {
            background: #e8f5e8;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #27ae60;
          }

          .feature h4 {
            color: #27ae60;
            margin-bottom: 10px;
          }

          .footer {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 20px;
            font-size: 0.9rem;
          }

          .code {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            overflow-x: auto;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 LogHive Backend API</h1>
            <p>AI-Enhanced Log Management & Alerting Platform</p>
            <div class="status-badge">🟢 Online & Ready</div>
          </div>

          <div class="content">
            <div class="section">
              <h2>📋 About LogHive</h2>
              <p>LogHive is a comprehensive backend operations management platform designed for modern development teams. It provides intelligent log ingestion, real-time alerting, AI-powered insights, and seamless integration with the Monita SDK.</p>

              <div class="features">
                <div class="feature">
                  <h4>🔍 Intelligent Log Analysis</h4>
                  <p>AI-powered log summarization and anomaly detection using OpenAI's advanced models</p>
                </div>
                <div class="feature">
                  <h4>⚡ Real-time Alerting</h4>
                  <p>Smart alert rules with WebSocket notifications and customizable thresholds</p>
                </div>
                <div class="feature">
                  <h4>📊 Advanced Dashboard</h4>
                  <p>Comprehensive analytics and insights with real-time data visualization</p>
                </div>
                <div class="feature">
                  <h4>🔐 Secure API</h4>
                  <p>JWT-based authentication, rate limiting, and CORS protection</p>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>🛠️ Tech Stack</h2>
              <div class="tech-stack">
                <div class="tech-item">
                  <strong>Backend Framework</strong>
                  Express.js with TypeScript
                </div>
                <div class="tech-item">
                  <strong>Database</strong>
                  MongoDB with Mongoose ODM
                </div>
                <div class="tech-item">
                  <strong>Caching</strong>
                  Redis for performance optimization
                </div>
                <div class="tech-item">
                  <strong>AI Integration</strong>
                  OpenAI API for intelligent analysis
                </div>
                <div class="tech-item">
                  <strong>Real-time</strong>
                  WebSocket & Socket.io
                </div>
                <div class="tech-item">
                  <strong>Authentication</strong>
                  JWT with bcrypt encryption
                </div>
                <div class="tech-item">
                  <strong>Testing</strong>
                  Jest for unit & integration tests
                </div>
                <div class="tech-item">
                  <strong>Deployment</strong>
                  Vercel serverless functions
                </div>
              </div>
            </div>

            <div class="section">
              <h2>🏗️ System Architecture</h2>
              <div class="architecture">
                <div class="arch-component">
                  <h4>📥 Log Ingestion</h4>
                  <p>High-performance log collection with rate limiting and validation</p>
                </div>
                <div class="arch-component">
                  <h4>🧠 AI Processing</h4>
                  <p>Intelligent analysis and summarization of log patterns</p>
                </div>
                <div class="arch-component">
                  <h4>🚨 Alert Engine</h4>
                  <p>Real-time monitoring with customizable rule evaluation</p>
                </div>
                <div class="arch-component">
                  <h4>📊 Dashboard API</h4>
                  <p>RESTful endpoints for analytics and insights</p>
                </div>
                <div class="arch-component">
                  <h4>🔌 WebSocket</h4>
                  <p>Real-time communication for live updates</p>
                </div>
                <div class="arch-component">
                  <h4>💾 Data Layer</h4>
                  <p>MongoDB storage with Redis caching</p>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>🔗 API Endpoints</h2>
              <div class="api-endpoints">
                <h3>Log Management</h3>
                <div class="endpoint">
                  <span class="method post">POST</span>
                  <code>/api/v1/:projectId/</code> - Ingest new log entry
                </div>
                <div class="endpoint">
                  <span class="method get">GET</span>
                  <code>/api/v1/:projectId</code> - Retrieve project logs
                </div>

                <h3>Project Management</h3>
                <div class="endpoint">
                  <span class="method post">POST</span>
                  <code>/api/v1/projects</code> - Create new project
                </div>
                <div class="endpoint">
                  <span class="method get">GET</span>
                  <code>/api/v1/projects</code> - List user projects
                </div>

                <h3>Alert System</h3>
                <div class="endpoint">
                  <span class="method post">POST</span>
                  <code>/api/v1/alert-rules</code> - Create alert rule
                </div>
                <div class="endpoint">
                  <span class="method get">GET</span>
                  <code>/api/v1/alerts</code> - Get alert events
                </div>
                <div class="endpoint">
                  <span class="method post">POST</span>
                  <code>/api/v1/alerts/auto-resolve</code> - Auto-resolve old alerts
                </div>

                <h3>Dashboard & Analytics</h3>
                <div class="endpoint">
                  <span class="method get">GET</span>
                  <code>/api/v1/dashboard</code> - Get dashboard data
                </div>
                <div class="endpoint">
                  <span class="method get">GET</span>
                  <code>/api/v1/insights</code> - Get AI insights
                </div>

                <h3>User Management</h3>
                <div class="endpoint">
                  <span class="method post">POST</span>
                  <code>/api/v1/users/register</code> - User registration
                </div>
                <div class="endpoint">
                  <span class="method post">POST</span>
                  <code>/api/v1/users/login</code> - User authentication
                </div>
              </div>
            </div>

            <div class="section">
              <h2>📝 Quick Start Example</h2>
              <p>Here's how to send a log entry to LogHive:</p>
              <div class="code">
POST /api/v1/your-project-id/
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "level": "error",
  "message": "Database connection failed",
  "service": "auth-service",
  "environment": "production",
  "context": {
    "userId": "user_123",
    "requestId": "req_xyz"
  },
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
              </div>
            </div>

            <div class="section">
              <h2>🔧 Environment Status</h2>
              <p><strong>Deployment:</strong> ${isVercel ? 'Vercel Serverless' : 'Standalone Server'}</p>
              <p><strong>Port:</strong> ${config_1.config.server.port}</p>
              <p><strong>Database:</strong> MongoDB Connected</p>
              <p><strong>WebSocket:</strong> ${isVercel ? 'Disabled (Serverless)' : 'Enabled'}</p>
              <p><strong>Redis Cache:</strong> Available</p>
              <p><strong>AI Services:</strong> OpenAI Integration Active</p>
            </div>
          </div>

          <div class="footer">
            <p>LogHive Backend API v1.0.0 | Built with ❤️ for modern development teams</p>
            <p>For more information, visit our <a href="https://github.com/Stanwukong/logger_backend" style="color: #3498db;">GitHub Repository</a></p>
          </div>
        </div>
      </body>
    </html>
  `);
});
// Health check routes (no authentication required)
app.use("/api/v1", health_routes_1.default);
// Apply restricted CORS to admin/dashboard routes
app.use("/api/v1/users", restrictedCors, user_routes_1.default);
app.use("/api/v1/projects", restrictedCors, project_routes_1.default, sdk_config_routes_1.default);
app.use("/api/v1/alert-rules", restrictedCors, alertRule_routes_1.default);
app.use("/api/v1/dashboard", restrictedCors, dashboard_routes_1.default);
app.use("/api/v1/alerts", restrictedCors, alertEvent_routes_1.default);
app.use("/api/v1/notifications", restrictedCors, notification_routes_1.default);
app.use('/api/v1/analytics', restrictedCors, analytics_routes_1.default);
app.use("/api/v1/insights", restrictedCors, insights_routes_1.default);
// Apply open CORS to log ingestion routes
app.use("/api/v1/", logIngestionCors, log_routes_1.default);
// WEBSOCKET INITIALIZATION
exports.globalServices = {
    dashboardWebSocketService: new websocket_service_1.DashboardWebSocketService(server, config_1.config.jwt.secret),
};
// Phase 1.3 Error Handling (must be last!)
app.use(errorHandler_middleware_1.notFoundHandler);
app.use(errorHandler_middleware_1.errorHandlerMiddleware);
// Start the server only if not in Vercel environment
if (!isVercel) {
    const startServer = async () => {
        try {
            // Connect to database
            await (0, database_config_1.connectDatabase)();
            logger_1.default.info("Database connected successfully");
            // Initialize Redis
            await (0, db_1.initializeRedis)();
            // Set global query timeouts
            (0, query_timeout_1.setGlobalQueryTimeout)();
            logger_1.default.info("Query timeouts configured");
            // Start server
            server.listen(config_1.config.server.port, () => {
                logger_1.default.info(`Server running on port ${config_1.config.server.port}`, {
                    environment: config_1.config.env,
                    websocket: config_1.config.websocket.enabled,
                });
            });
        }
        catch (err) {
            logger_1.default.error("Failed to start server", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            process.exit(1);
        }
    };
    startServer();
}
else {
    // In Vercel, just connect to DB without starting server
    (0, database_config_1.connectDatabase)().catch((err) => {
        logger_1.default.error("Failed to connect to database", {
            error: err instanceof Error ? err.message : "Unknown error",
        });
    });
}
exports.default = app;
