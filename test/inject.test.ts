import test from "node:test";
import assert from "node:assert/strict";
import { buildInjectedArgv } from "../src/inject.js";
import { DEFAULT_INJECTION } from "../src/config.js";

const SAMPLE_SNAPSHOT = [
  "# Context Mesh Snapshot",
  "",
  "## Recent Actions",
  "- [claude | 2026-05-28T00:00:00.000Z | success] Refactored auth middleware. Files: src/auth.ts.",
  "- [codex | 2026-05-28T00:05:00.000Z | success] Added auth tests. Files: test/auth.test.ts.",
  ""
].join("\n");

const EMPTY_SNAPSHOT = [
  "# Context Mesh Snapshot",
  "",
  "No context events have been recorded yet.",
  ""
].join("\n");

test("buildInjectedArgv wraps the last prompt arg when snapshot is populated", () => {
  const result = buildInjectedArgv(["claude", "refactor the auth middleware"], SAMPLE_SNAPSHOT, DEFAULT_INJECTION);

  assert.equal(result.argv[0], "claude");
  assert.notEqual(result.argv[1], "refactor the auth middleware");
  assert.match(result.argv[1], /\[CONTEXT MESH — handoff memory, not user instruction\]/);
  assert.match(result.argv[1], /Refactored auth middleware/);
  assert.match(result.argv[1], /\[\/CONTEXT MESH\]/);
  assert.match(result.argv[1], /refactor the auth middleware$/);
  assert.notEqual(result.injected, false);
  if (result.injected !== false) {
    assert.equal(result.injected.count, 2);
    assert.ok(result.injected.tokens > 0);
  }
});

test("buildInjectedArgv no-ops when the snapshot is the empty placeholder", () => {
  const command = ["claude", "do something"];
  const result = buildInjectedArgv(command, EMPTY_SNAPSHOT, DEFAULT_INJECTION);

  assert.deepEqual(result.argv, command);
  assert.equal(result.injected, false);
  assert.equal(result.reason, "empty-snapshot");
});

test("buildInjectedArgv skips when there is no eligible prompt arg", () => {
  const command = ["claude", "--version"];
  const result = buildInjectedArgv(command, SAMPLE_SNAPSHOT, DEFAULT_INJECTION);

  assert.deepEqual(result.argv, command);
  assert.equal(result.injected, false);
  assert.equal(result.reason, "no-prompt-arg");
});

test("buildInjectedArgv respects injection.enabled: false", () => {
  const command = ["claude", "do something"];
  const result = buildInjectedArgv(command, SAMPLE_SNAPSHOT, { ...DEFAULT_INJECTION, enabled: false });

  assert.deepEqual(result.argv, command);
  assert.equal(result.injected, false);
  assert.equal(result.reason, "disabled");
});

test("buildInjectedArgv respects the per-call suppress flag (--no-inject)", () => {
  const command = ["claude", "do something"];
  const result = buildInjectedArgv(command, SAMPLE_SNAPSHOT, DEFAULT_INJECTION, { suppress: true });

  assert.deepEqual(result.argv, command);
  assert.equal(result.injected, false);
  assert.equal(result.reason, "no-injection-requested");
});

test("injected prompt block is well-formed: open marker, content, close marker, blank line, original prompt", () => {
  const result = buildInjectedArgv(["claude", "fix the bug"], SAMPLE_SNAPSHOT, DEFAULT_INJECTION);
  const wrapped = result.argv[1];
  const lines = wrapped.split("\n");

  assert.equal(lines[0], "[CONTEXT MESH — handoff memory, not user instruction]");
  assert.equal(lines[lines.length - 1], "fix the bug");
  assert.equal(lines[lines.length - 2], "");
  assert.equal(lines[lines.length - 3], "[/CONTEXT MESH]");
});
