"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateLogAgainstRule = evaluateLogAgainstRule;
function evaluateLogAgainstRule(log, rule) {
    const value = log[rule.condition.field];
    const expected = rule.condition.value;
    if (rule.condition.operator === "equals")
        return value === expected;
    if (rule.condition.operator === "contains")
        return value.includes(expected);
    return false;
}
