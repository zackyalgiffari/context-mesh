import test from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "../src/storage.js";
import { ContextEvent } from "../src/types.js";

test("buildSnapshot includes recent event notes and changed files", () => {
  const snapshot = buildSnapshot([
    event({
      tool: "claude",
      outcomeSummary: "Refactored auth middleware.",
      filesAffected: ["src/auth.ts"],
      userNote: "JWT migration started"
    }),
    event({
      tool: "codex",
      outcomeSummary: "Added auth tests.",
      filesAffected: ["test/auth.test.ts"]
    })
  ]);

  assert.match(snapshot, /Context Mesh Snapshot/);
  assert.match(snapshot, /Refactored auth middleware/);
  assert.match(snapshot, /src\/auth.ts/);
  assert.match(snapshot, /JWT migration started/);
  assert.match(snapshot, /Added auth tests/);
});

test("buildSnapshot limits very long histories", () => {
  const events = Array.from({ length: 30 }, (_, index) =>
    event({
      outcomeSummary: `Completed task ${index} with detailed local memory and repository state.`,
      filesAffected: [`src/file-${index}.ts`]
    })
  );

  const snapshot = buildSnapshot(events);

  assert.match(snapshot, /file-29/);
  assert.doesNotMatch(snapshot, /file-0/);
});

function event(overrides: Partial<ContextEvent>): ContextEvent {
  return {
    id: `evt_${Math.random()}`,
    timestamp: new Date("2026-05-28T00:00:00.000Z").toISOString(),
    tool: "claude",
    command: ["claude", "do work"],
    status: "success",
    exitCode: 0,
    durationMs: 10,
    promptSummary: "claude do work",
    outcomeSummary: "Command completed.",
    filesAffected: [],
    gitBranch: "main",
    gitDiffStat: null,
    ...overrides
  };
}
