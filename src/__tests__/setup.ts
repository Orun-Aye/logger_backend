import mongoose from "mongoose";

// Set environment variables for tests before any imports resolve config
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing";
process.env.MONGODB_URI = "mongodb://localhost:27018/apperio_test";
process.env.PORT = "5555";
process.env.NODE_ENV = "test";
process.env.REDIS_ENABLED = "false";

// Use a unique database name per test suite to avoid collisions
const TEST_DB_URI = `mongodb://localhost:27018/apperio_test_${process.env.JEST_WORKER_ID || "0"}`;

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  // Drop the test database to clean up
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
  await mongoose.disconnect();
});
