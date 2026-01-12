// Output utilities for text-first CLI with optional JSON mode

/**
 * Global state for output format
 */
let jsonOutput = false;

/**
 * Set the global JSON output mode
 */
export function setJsonOutput(value: boolean): void {
  jsonOutput = value;
}

/**
 * Check if JSON output mode is enabled
 */
export function isJsonOutput(): boolean {
  return jsonOutput;
}

/**
 * Output success data - text to stdout by default, JSON if --json flag is set
 */
export function output(text: string, jsonData: unknown): void {
  if (jsonOutput) {
    console.log(JSON.stringify(jsonData));
  } else {
    console.log(text);
  }
}

/**
 * Output error and exit - always to stderr
 */
export function outputError(message: string, code: number): never {
  if (jsonOutput) {
    console.error(JSON.stringify({ error: message, code }));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(code);
}

/**
 * Calculate relative time from an ISO date string
 * Returns strings like "2m ago", "3h ago", "5d ago"
 */
export function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years}y ago`;
  }
  if (months > 0) {
    return `${months}mo ago`;
  }
  if (weeks > 0) {
    return `${weeks}w ago`;
  }
  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return "just now";
}

/**
 * Format a timestamp with both relative and ISO time
 * Returns strings like "2h ago (2024-01-12T14:22:00Z)"
 */
export function formatTimestamp(isoDate: string): string {
  return `${relativeTime(isoDate)} (${isoDate})`;
}
