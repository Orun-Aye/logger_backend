"use strict";
// src/middleware/validation.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMultiple = exports.validate = void 0;
const zod_1 = require("zod");
/**
 * Generic Zod validation middleware
 * @param schema - Zod schema to validate against
 * @param target - Part of request to validate (body, query, or params)
 */
const validate = (schema, target = "body") => {
    return async (req, res, next) => {
        try {
            // Get the data to validate based on target
            const dataToValidate = req[target];
            // Validate and transform the data
            const validatedData = await schema.parseAsync(dataToValidate);
            // Replace the original data with validated/transformed data
            req[target] = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                // Format Zod errors for API response
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                    code: err.code,
                }));
                return res.status(400).json({
                    status: "error",
                    message: "Validation failed",
                    errors: formattedErrors,
                });
            }
            // Unexpected error during validation
            return res.status(500).json({
                status: "error",
                message: "Validation error",
            });
        }
    };
};
exports.validate = validate;
/**
 * Combine multiple schemas for different request parts
 * Useful when you need to validate body, query, and params together
 */
const validateMultiple = (schemas) => {
    return async (req, res, next) => {
        try {
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }
            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query);
            }
            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params);
            }
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                    code: err.code,
                }));
                return res.status(400).json({
                    status: "error",
                    message: "Validation failed",
                    errors: formattedErrors,
                });
            }
            return res.status(500).json({
                status: "error",
                message: "Validation error",
            });
        }
    };
};
exports.validateMultiple = validateMultiple;
