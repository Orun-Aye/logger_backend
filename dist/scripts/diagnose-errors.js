"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Read-only diagnostic: counts errors for a project across multiple
 * dimensions to find out why the dashboard shows 0 errors when errors
 * may actually exist.
 *
 * Usage:  npx ts-node src/scripts/diagnose-errors.ts [projectName]
 *         (defaults to "vaultly")
 */
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const log_model_1 = require("../models/log.model");
const project_model_1 = require("../models/project.model");
const PROJECT_NAME_ARG = (process.argv[2] || "vaultly").trim();
async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI not set");
        process.exit(1);
    }
    await mongoose_1.default.connect(uri);
    // 1. Find the project (case-insensitive name match)
    const project = await project_model_1.ProjectModel.findOne({
        name: { $regex: `^${PROJECT_NAME_ARG}$`, $options: "i" },
    }).lean();
    if (!project) {
        console.log(`No project named "${PROJECT_NAME_ARG}" found.`);
        await mongoose_1.default.disconnect();
        return;
    }
    const projectId = String(project._id);
    console.log(`\nProject: ${project.name}  id=${projectId}`);
    console.log(`  isActive=${project.isActive}  logCount(field)=${project.logCount}`);
    // 2. Total documents in DB
    const total = await log_model_1.LogModel.countDocuments({ projectId });
    console.log(`\n  Total log docs: ${total}`);
    // 3. By level
    const byLevel = await log_model_1.LogModel.aggregate([
        { $match: { projectId } },
        { $group: { _id: "$level", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);
    console.log(`\n  By level:`);
    for (const row of byLevel) {
        console.log(`    ${String(row._id).padEnd(8)} ${row.count}`);
    }
    // 4. By eventType
    const byEventType = await log_model_1.LogModel.aggregate([
        { $match: { projectId } },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);
    console.log(`\n  By eventType:`);
    for (const row of byEventType) {
        console.log(`    ${String(row._id ?? "(none)").padEnd(12)} ${row.count}`);
    }
    // 5. Errors per the trends.logs definition (level in error|fatal,
    //    eventType !== system) — what the dashboard counts.
    const trendsErrors = await log_model_1.LogModel.countDocuments({
        projectId,
        eventType: { $ne: "system" },
        level: { $in: ["error", "fatal"] },
    });
    console.log(`\n  Errors that match trends.logs query (level in [error,fatal] AND eventType != system): ${trendsErrors}`);
    // 6. Errors per the overview.errorLogs definition (level in error|fatal,
    //    eventType != system, range-scoped but here without time filter)
    const overviewErrors = await log_model_1.LogModel.countDocuments({
        projectId,
        level: { $in: ["error", "fatal"] },
        eventType: { $ne: "system" },
    });
    console.log(`  Errors per overview.errorLogs definition: ${overviewErrors}`);
    // 7. Errors regardless of eventType
    const errorsAnyEventType = await log_model_1.LogModel.countDocuments({
        projectId,
        level: { $in: ["error", "fatal"] },
    });
    console.log(`  Errors regardless of eventType: ${errorsAnyEventType}`);
    // 8. Cross-tab: errors broken down by eventType
    const errorsByEventType = await log_model_1.LogModel.aggregate([
        { $match: { projectId, level: { $in: ["error", "fatal"] } } },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);
    console.log(`\n  Error logs broken down by eventType:`);
    for (const row of errorsByEventType) {
        console.log(`    ${String(row._id ?? "(none)").padEnd(12)} ${row.count}`);
    }
    // 9. Earliest + latest log timestamps (string ISO)
    const earliest = await log_model_1.LogModel.findOne({ projectId }, { timestamp: 1, level: 1, eventType: 1, message: 1 })
        .sort({ timestamp: 1 })
        .lean();
    const latest = await log_model_1.LogModel.findOne({ projectId }, { timestamp: 1, level: 1, eventType: 1, message: 1 })
        .sort({ timestamp: -1 })
        .lean();
    console.log(`\n  Earliest log: ${earliest?.timestamp}  (${earliest?.level}/${earliest?.eventType})`);
    console.log(`  Latest log:   ${latest?.timestamp}  (${latest?.level}/${latest?.eventType})`);
    // 10. Sample 5 most-recent error rows so the user can see them
    const recentErrors = await log_model_1.LogModel.find({ projectId, level: { $in: ["error", "fatal"] } }, { timestamp: 1, level: 1, eventType: 1, message: 1, "error.message": 1 })
        .sort({ timestamp: -1 })
        .limit(5)
        .lean();
    console.log(`\n  Sample of 5 most-recent error rows:`);
    if (recentErrors.length === 0) {
        console.log("    (none)");
    }
    else {
        for (const r of recentErrors) {
            const msg = r.message || r.error?.message || "(no message)";
            console.log(`    [${r.timestamp}] ${String(r.level).padEnd(5)} ${String(r.eventType ?? "(none)").padEnd(10)} ${msg.slice(0, 80)}`);
        }
    }
    await mongoose_1.default.disconnect();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
