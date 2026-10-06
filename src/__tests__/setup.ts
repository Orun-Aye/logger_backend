import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Set environment variables for tests before any imports resolve config.
// MONGODB_URI only satisfies config's required-var check: tests connect to the
// in-memory server below. The .invalid host fails fast if anything tries to
// connect through config instead of silently reaching a real local database.
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing";
process.env.MONGODB_URI = "mongodb://mongodb-memory-server.invalid/apperio_test";
process.env.PORT = "5555";
process.env.NODE_ENV = "test";
process.env.REDIS_ENABLED = "false";
// dotenv never overrides a set variable, so this keeps a developer's .env
// from turning tests into real, billed Anthropic API calls
process.env.ANTHROPIC_ENABLED = "false";

// First boot on a machine downloads the mongod binary (version pinned in
// package.json "config.mongodbMemoryServer"), which can exceed testTimeout.
const BOOT_TIMEOUT_MS = 120_000;

// setupFilesAfterEnv runs per test file, so each suite gets its own server
let mongod: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("apperio_test"));
  // Each suite starts on an empty database, so wait for index builds.
  // Otherwise unique indexes (user email, project name, error-group
  // fingerprint) may not exist yet when a test relies on them.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}, BOOT_TIMEOUT_MS);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});
