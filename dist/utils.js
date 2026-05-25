"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
exports.joinPath = joinPath;
exports.isBlockedFilename = isBlockedFilename;
exports.fileMatchesPatterns = fileMatchesPatterns;
exports.truncateText = truncateText;
exports.looksLikeSecret = looksLikeSecret;
exports.scrubPromptText = scrubPromptText;
exports.safeExtractStrings = safeExtractStrings;
exports.extractPromptSummariesFromJson = extractPromptSummariesFromJson;
const path_1 = __importDefault(require("path"));
const micromatch_1 = __importDefault(require("micromatch"));
function normalizePath(value) {
    return path_1.default.resolve(value).replace(/\\/g, "/").replace(/\/\/$/, "");
}
function joinPath(...segments) {
    return path_1.default.join(...segments);
}
function isBlockedFilename(filePath, blockedPatterns) {
    const normalized = filePath.replace(/\\/g, "/");
    return micromatch_1.default.some(normalized, blockedPatterns, { dot: true });
}
function fileMatchesPatterns(filePath, patterns) {
    const normalized = filePath.replace(/\\/g, "/");
    return micromatch_1.default.some(normalized, patterns, { dot: true });
}
function truncateText(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 3)}...`;
}
const secretKeywords = ["token", "secret", "password", "apiKey", "apikey", "authorization", "auth", "credential", "private key"];
function looksLikeSecret(line) {
    const lower = line.toLowerCase();
    return secretKeywords.some((keyword) => lower.includes(keyword));
}
function scrubPromptText(value) {
    const lines = value.split(/\r?\n/);
    const safeLines = lines.filter((line) => !looksLikeSecret(line));
    return truncateText(safeLines.join(" "), 300);
}
function safeExtractStrings(input) {
    if (typeof input === "string") {
        return [input];
    }
    if (Array.isArray(input)) {
        return input.flatMap((item) => safeExtractStrings(item));
    }
    if (typeof input === "object" && input !== null) {
        return Object.values(input).flatMap((value) => safeExtractStrings(value));
    }
    return [];
}
function extractPromptSummariesFromJson(json, source) {
    const candidates = [];
    const values = safeExtractStrings(json).filter((value) => typeof value === "string");
    for (const candidate of values) {
        const lower = candidate.toLowerCase();
        if (/(prompt|query|message|input|assistant|user|chat)/.test(lower) && candidate.trim().length > 20) {
            candidates.push({
                source,
                summary: scrubPromptText(candidate),
                timestamp: new Date().toISOString(),
                relatedFiles: [source],
            });
        }
    }
    return candidates;
}
//# sourceMappingURL=utils.js.map