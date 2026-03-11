"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Set environment variables for tests before any imports resolve config
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing";
process.env.MONGODB_URI = "mongodb://localhost:27018/apperio_test";
process.env.PORT = "5555";
process.env.NODE_ENV = "test";
process.env.REDIS_ENABLED = "false";
// Use a unique database name per test suite to avoid collisions
const TEST_DB_URI = `mongodb://localhost:27018/apperio_test_${process.env.JEST_WORKER_ID || "0"}`;
beforeAll(async () => {
    await mongoose_1.default.connect(TEST_DB_URI);
});
afterEach(async () => {
    const collections = mongoose_1.default.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});
afterAll(async () => {
    // Drop the test database to clean up
    if (mongoose_1.default.connection.db) {
        await mongoose_1.default.connection.db.dropDatabase();
    }
    await mongoose_1.default.disconnect();
});
