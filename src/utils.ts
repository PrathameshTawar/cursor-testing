import path from "path";
import micromatch from "micromatch";

export type PromptSummary = {
  source: string;
  summary: string;
  timestamp: string;
  relatedFiles: string[];
};

export function normalizePath(value: string): string {
  return path.resolve(value).replace(/\\/g, "/").replace(/\/\/$/, "");
}

export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

export function isBlockedFilename(filePath: string, blockedPatterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return micromatch.some(normalized, blockedPatterns, { dot: true });
}

export function fileMatchesPatterns(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return micromatch.some(normalized, patterns, { dot: true });
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

const secretKeywords = ["token", "secret", "password", "apiKey", "apikey", "authorization", "auth", "credential", "private key"];

export function looksLikeSecret(line: string): boolean {
  const lower = line.toLowerCase();
  return secretKeywords.some((keyword) => lower.includes(keyword));
}

export function scrubPromptText(value: string): string {
  const lines = value.split(/\r?\n/);
  const safeLines = lines.filter((line) => !looksLikeSecret(line));
  return truncateText(safeLines.join(" "), 300);
}

export function safeExtractStrings(input: unknown): string[] {
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

export function extractPromptSummariesFromJson(json: unknown, source: string): PromptSummary[] {
  const candidates: PromptSummary[] = [];
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
