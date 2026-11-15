import type { EventClassification } from '@mailtrack/shared';

/**
 * Conservative User-Agent signatures for automated security scanners and link/image pre-fetchers.
 */
const SCANNER_UA_PATTERNS = [
  /barracuda/i,
  /mimecast/i,
  /proofpoint/i,
  /symantec/i,
  /messagelabs/i,
  /defender/i,
  /safelinks/i,
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /curl\//i,
  /python-requests/i,
  /go-http-client/i,
  /wget\//i,
];

/**
 * Known email client image-proxying User-Agent patterns.
 */
const PROXY_UA_PATTERNS = [/GoogleImageProxy/i, /Outlook|Microsoft Office/i];

const INTERACTIVE_BROWSER_UA_PATTERN = /Mozilla\/5\.0.*(Chrome|Firefox|Safari|Edg)\//i;
const EARLY_AUTOMATED_WINDOW_MS = 2000;

/**
 * Classifies an incoming pixel HTTP request conservatively.
 *
 * Signals used:
 * 1. Explicit scanner/bot User-Agent signatures -> SUSPECTED_SCANNER
 * 2. Known image proxy User-Agents (Gmail Proxy, Apple MPP, Outlook) -> LIKELY_PROXY
 * 3. Very early hit (< 2s after confirmed sentAt) WITHOUT an interactive browser UA -> SUSPECTED_SCANNER
 * 4. All other requests (including unknown, missing, or ambiguous UAs) -> RECORDED
 *
 * Note: Classifications are heuristic signals only and never establish human identity.
 */
export function classifyTrackingRequest(
  userAgent: string | null | undefined,
  sentAt: Date | null,
  occurredAt: Date,
): EventClassification {
  const ua = (userAgent ?? '').trim();

  if (SCANNER_UA_PATTERNS.some((pattern) => pattern.test(ua))) {
    return 'SUSPECTED_SCANNER';
  }

  if (PROXY_UA_PATTERNS.some((pattern) => pattern.test(ua))) {
    return 'LIKELY_PROXY';
  }

  // Apple Mail Privacy Protection (CFNetwork / Apple Mail without standard browser UA)
  if (/AppleWebKit.*CFNetwork|Mail\/\d+/i.test(ua) && !/Chrome|Firefox/i.test(ua)) {
    return 'LIKELY_PROXY';
  }

  // Only flag early hits as suspected scanners when combined with non-browser / missing UA
  if (
    sentAt &&
    occurredAt.getTime() - sentAt.getTime() < EARLY_AUTOMATED_WINDOW_MS &&
    !INTERACTIVE_BROWSER_UA_PATTERN.test(ua)
  ) {
    return 'SUSPECTED_SCANNER';
  }

  return 'RECORDED';
}
