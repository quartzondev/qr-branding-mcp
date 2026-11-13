/**
 * Version parity — the single source of truth for "what version is this?" is
 * package.json (what npm and the official MCP registry publish). The server
 * used to carry its own literal, and it drifted: npm served 0.2.7 while
 * `initialize` announced 0.2.3.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PACKAGE_VERSION } from "../src/config.js";

describe("PACKAGE_VERSION", () => {
  it("equals package.json's version", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
    assert.equal(PACKAGE_VERSION, pkg.version);
  });

  it("looks like a semver release", () => {
    assert.match(PACKAGE_VERSION, /^\d+\.\d+\.\d+$/);
  });
});