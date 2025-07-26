# RemoteLogger Backend

**RemoteLogger** is an AI-enhanced platform for collecting logs, triggering alerts, and summarizing issues for developer teams. This repository contains the **Express.js API backend** for log ingestion, alerting, and AI summarization.


## 🚀 Tech Stack
- Node.js
- Express.js
- TypeScript
- MongoDB + Mongoose
- Jest
- Redis (caching, pub/sub)
- OpenAI API (summarization, anomaly detection)
- BullMQ (task queue)


## 📦 Setup
```bash
git clone https://github.com/Stanwukong/logger_backend.git
cd logger_backend
npm install
```


Create `.env`:

```
PORT=5000
DATABASE_URL=mongodb://...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...
```

Start dev server:

```bash
npm run dev
```


## 📁 Folder Structure

📦 remotelogger-backend
├── src/
│ ├── controllers/ # Route handlers for logs, insights, alerts
│ ├── services/ # Business logic for logs, insights, alerts
│ ├── models/ # Mongoose schemas (Log, Project, AlertRule, etc.)
│ ├── routes/ # Express routes
│ ├── middleware/ # API key authentication and error handling
│ ├── utils/ # Helper utilities
│ ├── app.ts # Express setup
│ └── server.ts # Entry point
├── .env.example # Sample environment variables
├── tsconfig.json # TypeScript config
└── README.md # This file


## 📌 API Endpoints (MVP)

* `POST /api/v1/:projectId/` — Ingest new log
* `GET /api/v1/:projectId` — Retrieve log list
* `GET /api/v1/summary` — AI summary of recent logs
* `POST /api/v1/alerts` — Configure alert
* `GET /api/v1/alerts` — View current alerts


## 🧪 Sample API Usage
### ➕ Add a Log
```http
POST /api/logs

Headers:
Authorization: <API_KEY>
Content-Type: application/json

Body:
{
  "projectId": "abc123",
  "timestamp": "2025-07-24T10:00:00Z",
  "level": "error",
  "message": "Something went wrong",
  "error": {
    "name": "TypeError",
    "message": "Cannot read property 'x' of undefined",
    "stack": "..."
  },
  "service": "auth-service",
  "environment": "production",
  "context": {
    "userId": "user_123"
  },
  "metadata": {
    "ip": "192.168.1.1",
    "requestId": "req_xyz"
  }
}

```

## 👀 See Also

* [RemoteLogger Frontend](https://github.com/Stanwukong/remote-logger)


