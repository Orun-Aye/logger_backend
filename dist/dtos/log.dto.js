"use strict";
// src/dtos/log.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
// Defining DTOs and Enums here for completeness and clarity,
// assuming they are also defined in a separate log.dto.ts file.
// If they are strictly in log.dto.ts, these can be removed from here.
var LogLevel;
(function (LogLevel) {
    LogLevel["TRACE"] = "trace";
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
