#!/usr/bin/env node
/**
 * Guards against a specific, silent, security-relevant mistake: calling one of
 * the async security helpers without `await`.
 *
 * Why this exists
 * ---------------
 * These functions enforce access control by THROWING. An un-awaited call
 * returns a pending promise, the throw becomes an unhandled rejection, and the
 * handler carries on as if the check had passed:
 *
 *     requireRole(req, ["admin"]);        // <- no await: does NOT block anyone
 *     await requireRole(req, ["admin"]);  // <- correct
 *
 * Nothing catches that. It is not a type error (the return value is simply
 * discarded), the build passes, the tests pass, and the route is wide open.
 * `enforceRateLimit` became async when its counters moved to Postgres, which is
 * exactly the kind of change that leaves stale sync call sites behind.
 *
 * This is deliberately a plain scanner rather than an ESLint rule: catching it
 * properly needs type-aware linting (@typescript-eslint/no-floating-promises),
 * which means a heavy toolchain this project does not currently have. A regex
 * over call sites is cruder, but it runs in a second and has no dependencies.
 *
 * Usage:  node scripts/check-await.mjs        (exit 1 on any finding)
 */

import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";

/** Functions that MUST be awaited at every call site. */
const MUST_AWAIT = [
  "requireRole",
  "requireSession",
  "enforceRateLimit",
  "loadOwnedPayment",
  "authorizePaymentReceipt",
  "authorizeBookingReceipt",
  "revokeToken",
  "revokeAllForAccount",
  "claimEvent",
];

/**
 * A call is fine if it is preceded by `await `, or by something that consumes
 * the promise deliberately: `return`, `.then`, `Promise.all([`, `void `.
 * Definitions (`export async function requireRole(`) are skipped.
 */
const SAFE_PREFIX = /(await|return|void|\.\s*then\s*\(|,|\[|\(\s*)\s*$/;

const files = [];
for await (const entry of glob("{app,lib,components}/**/*.{ts,tsx}")) {
  files.push(entry);
}

const findings = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    // Skip comments outright.
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;

    for (const fn of MUST_AWAIT) {
      const callPattern = new RegExp(`\\b${fn}\\s*\\(`, "g");
      let match;
      while ((match = callPattern.exec(line)) !== null) {
        const before = line.slice(0, match.index);

        // The declaration itself, not a call.
        if (/\b(function|const|let|var|export)\s*$/.test(before)) continue;
        if (/\basync\s+function\s*$/.test(before)) continue;
        // An import or re-export naming the symbol.
        if (/^\s*(import|export)\b/.test(trimmed)) continue;

        if (!SAFE_PREFIX.test(before)) {
          findings.push({
            file,
            line: index + 1,
            fn,
            text: trimmed,
          });
        }
      }
    }
  });
}

if (findings.length === 0) {
  console.log(`✓ check-await: all calls to ${MUST_AWAIT.length} security helpers are awaited`);
  process.exit(0);
}

console.error(`\n✗ check-await: ${findings.length} un-awaited security call(s).\n`);
console.error("  These do NOT block anyone — the check throws into a floating promise\n");
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}`);
  console.error(`    ${f.fn}() is not awaited`);
  console.error(`    ${f.text}\n`);
}
process.exit(1);
