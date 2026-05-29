import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ContextEvent, InjectionConfig } from "./types.js";
import { DEFAULT_INJECTION } from "./config.js";
import { ensureMeshDirs, eventsPath, pathExists, rawDir, snapshotPath } from "./paths.js";

export interface SnapshotLimits {
  maxTokens: number;
  maxEvents: number;
}

export async function initializeStore(projectRoot: string): Promise<void> {
  await ensureMeshDirs(projectRoot);

  if (!(await pathExists(eventsPath(projectRoot)))) {
    await writeFile(eventsPath(projectRoot), "", "utf8");
  }

  if (!(await pathExists(snapshotPath(projectRoot)))) {
    await writeFile(snapshotPath(projectRoot), emptySnapshot(), "utf8");
  }
}

export async function appendEvent(
  projectRoot: string,
  event: ContextEvent,
  limits?: SnapshotLimits
): Promise<void> {
  await initializeStore(projectRoot);
  await appendFile(eventsPath(projectRoot), `${JSON.stringify(event)}\n`, "utf8");
  await regenerateSnapshot(projectRoot, limits);
}

export async function readEvents(projectRoot: string): Promise<ContextEvent[]> {
  if (!(await pathExists(eventsPath(projectRoot)))) {
    return [];
  }

  const content = await readFile(eventsPath(projectRoot), "utf8");
  const events: ContextEvent[] = [];

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    events.push(JSON.parse(line) as ContextEvent);
  }

  return events;
}

export async function regenerateSnapshot(projectRoot: string, limits?: SnapshotLimits): Promise<void> {
  const events = await readEvents(projectRoot);
  await writeFile(snapshotPath(projectRoot), buildSnapshot(events, limits), "utf8");
}

export function buildSnapshot(events: ContextEvent[], limits?: SnapshotLimits): string {
  if (events.length === 0) {
    return emptySnapshot();
  }

  const resolved = resolveLimits(limits);
  const selected = selectSnapshotEvents(events, resolved);
  const lines = [
    "# Context Mesh Snapshot",
    "",
    "Read this before continuing work in this repository. It summarizes recent AI-agent activity only; verify code and tests directly.",
    "",
    "## Recent Actions"
  ];

  for (const event of selected) {
    lines.push(formatEvent(event));
  }

  const latestFailure = [...events].reverse().find((event) => event.status === "failed");
  if (latestFailure) {
    lines.push("", "## Latest Known Failure", formatEvent(latestFailure));
  }

  lines.push(
    "",
    "## Handoff Guidance",
    "- Continue from the latest changed files and user notes above.",
    "- Treat this snapshot as memory, not as a source of truth; inspect the repository before editing."
  );

  return `${lines.join("\n")}\n`;
}

export async function writeRawTranscript(
  projectRoot: string,
  eventId: string,
  stdout: string,
  stderr: string
): Promise<{ stdoutPath: string; stderrPath: string }> {
  const dir = rawDir(projectRoot);
  await ensureMeshDirs(projectRoot);
  await import("node:fs/promises").then(({ mkdir }) => mkdir(dir, { recursive: true }));

  const stdoutPath = path.join(dir, `${eventId}.stdout.txt`);
  const stderrPath = path.join(dir, `${eventId}.stderr.txt`);

  await Promise.all([
    writeFile(stdoutPath, stdout, "utf8"),
    writeFile(stderrPath, stderr, "utf8")
  ]);

  return {
    stdoutPath: path.relative(projectRoot, stdoutPath),
    stderrPath: path.relative(projectRoot, stderrPath)
  };
}

export function limitsFromInjection(injection: InjectionConfig): SnapshotLimits {
  return { maxTokens: injection.maxTokens, maxEvents: injection.maxEvents };
}

function resolveLimits(limits?: SnapshotLimits): SnapshotLimits {
  return limits ?? { maxTokens: DEFAULT_INJECTION.maxTokens, maxEvents: DEFAULT_INJECTION.maxEvents };
}

function selectSnapshotEvents(events: ContextEvent[], limits: SnapshotLimits): ContextEvent[] {
  const selected: ContextEvent[] = [];

  for (const event of [...events].reverse()) {
    selected.unshift(event);
    const snapshot = selected.map(formatEvent).join("\n");

    if (
      selected.length >= limits.maxEvents ||
      estimateTokens(snapshot) > limits.maxTokens
    ) {
      selected.shift();
      break;
    }
  }

  return selected.length > 0 ? selected : events.slice(-1);
}

function formatEvent(event: ContextEvent): string {
  const time = new Date(event.timestamp).toISOString();
  const files = event.filesAffected.length > 0 ? event.filesAffected.join(", ") : "no detected file changes";
  const note = event.userNote ? ` Note: ${event.userNote}` : "";

  return `- [${event.tool} | ${time} | ${event.status}] ${event.outcomeSummary} Files: ${files}.${note}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

function emptySnapshot(): string {
  return [
    "# Context Mesh Snapshot",
    "",
    "No context events have been recorded yet.",
    ""
  ].join("\n");
}
