/**
 * Grants or revokes the "full" beta tier for a user.
 *
 * betaTier gates advanced dashboard routes (see remote-logger/lib/route-tiers.ts
 * and components/shared/UpgradeGate.tsx). It defaults to "core" at signup and has
 * no admin endpoint, so this script is the supported way to change it.
 *
 * Usage:
 *   npx ts-node src/scripts/set-beta-tier.ts                      # list users (read-only)
 *   npx ts-node src/scripts/set-beta-tier.ts <email>              # set to "full"
 *   npx ts-node src/scripts/set-beta-tier.ts <email> core         # set back to "core"
 */
import "dotenv/config";
import mongoose from "mongoose";
import { UserModel } from "../models/user.model";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  const email = (process.argv[2] || "").trim().toLowerCase();
  const tier = (process.argv[3] || "full").trim() as "core" | "full";

  if (tier !== "core" && tier !== "full") {
    console.error(`Invalid tier "${tier}". Expected "core" or "full".`);
    process.exit(1);
  }

  await mongoose.connect(uri);

  if (!email) {
    const users = await UserModel.find({}, "email betaTier createdAt").lean();
    console.log(`\n${users.length} user(s):\n`);
    for (const u of users) {
      console.log(`  ${String(u.betaTier ?? "core").padEnd(5)}  ${u.email}`);
    }
    console.log("\nRe-run with an email to set that user to full.\n");
    await mongoose.disconnect();
    return;
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    console.error(`No user with email "${email}".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const previous = user.betaTier ?? "core";
  if (previous === tier) {
    console.log(`${email} is already "${tier}". Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  user.betaTier = tier;
  await user.save();

  console.log(`${email}: ${previous} -> ${tier}`);
  console.log("Log out and back in to refresh the cached user payload.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
