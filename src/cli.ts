#!/usr/bin/env node
import path from "node:path";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { doctor } from "./doctor.js";
import { initProject } from "./init.js";
import { findProjectRoot } from "./project.js";
import { runWrapped } from "./run.js";
import { readEvents } from "./storage.js";
import { snapshotPath } from "./paths.js";
import { ToolName } from "./types.js";

export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<number> {
  const [command, ...rest] = argv;

  try {
    switch (command) {
      case "init":
        await handleInit(cwd);
        return 0;
      case "run":
        return await handleRun(rest, cwd);
      case "status":
        await handleStatus(cwd);
        return 0;
      case "snapshot":
        await handleSnapshot(cwd);
        return 0;
      case "doctor":
        await handleDoctor(cwd);
        return 0;
      case undefined:
      case "-h":
      case "--help":
      case "help":
        printHelp();
        return 0;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`[context-mesh] ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

async function handleInit(cwd: string): Promise<void> {
  const result = await initProject(cwd);

  console.log(`[context-mesh] Initialized ${path.join(result.projectRoot, ".mesh")}`);
  console.log(`[context-mesh] ${result.gitignoreUpdated ? "Added .mesh/ to .gitignore" : ".gitignore already ignores .mesh/"}`);
  console.log(`[context-mesh] ${result.configCreated ? "Wrote default .mesh/config.json" : ".mesh/config.json already present"}`);
  console.log("\nShell aliases (add these manually if you want wrapped commands):");
  console.log(result.aliasSnippet);
  console.log("\nAGENTS.md snippet:");
  console.log(result.agentsSnippet);
  console.log("\nCLAUDE.md snippet:");
  console.log(result.claudeSnippet);
}

async function handleRun(args: string[], cwd: string): Promise<number> {
  const parsed = parseRunArgs(args);
  if (parsed.showedHelp) {
    return 0;
  }

  const result = await runWrapped({
    cwd,
    command: parsed.command,
    tool: parsed.tool,
    userNote: parsed.userNote,
    captureRaw: parsed.captureRaw,
    noInject: parsed.noInject
  });

  console.log(
    `[context-mesh] Logged ${result.event.tool} ${result.event.status} event to ${path.join(result.projectRoot, ".mesh", "events.jsonl")}`
  );

  return result.event.exitCode ?? 1;
}

async function handleStatus(cwd: string): Promise<void> {
  const projectRoot = await requireProjectRoot(cwd);
  const events = await readEvents(projectRoot);
  const recent = events.slice(-5);

  if (recent.length === 0) {
    console.log("[context-mesh] No events recorded yet.");
    return;
  }

  console.log("Last context events:");
  for (const event of recent) {
    const files = event.filesAffected.length > 0 ? event.filesAffected.join(", ") : "no file changes";
    console.log(`- [${event.tool} | ${event.status}] ${event.outcomeSummary} (${files})`);
  }
}

async function handleSnapshot(cwd: string): Promise<void> {
  const projectRoot = await requireProjectRoot(cwd);
  console.log(await readFile(snapshotPath(projectRoot), "utf8"));
}

async function handleDoctor(cwd: string): Promise<void> {
  const result = await doctor(cwd);
  console.log(`mesh initialized: ${formatCheck(result.meshInitialized)}`);
  console.log(`git available: ${formatCheck(result.gitAvailable)}`);
  console.log(`claude available: ${formatCheck(result.claudeAvailable)}`);
  console.log(`codex available: ${formatCheck(result.codexAvailable)}`);
}

async function requireProjectRoot(cwd: string): Promise<string> {
  const projectRoot = await findProjectRoot(cwd);
  if (!projectRoot) {
    throw new Error("No .mesh directory found. Run `mesh init` in this project first.");
  }

  return projectRoot;
}

function parseRunArgs(args: string[]): {
  tool?: ToolName;
  userNote?: string;
  captureRaw: boolean;
  noInject: boolean;
  command: string[];
  showedHelp: boolean;
} {
  let tool: ToolName | undefined;
  let userNote: string | undefined;
  let captureRaw = false;
  let noInject = false;
  let showedHelp = false;
  const command: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--") {
      command.push(...args.slice(i + 1));
      break;
    }

    if (arg === "--tool") {
      const value = args[++i];
      if (value !== "claude" && value !== "codex" && value !== "unknown") {
        throw new Error("--tool must be claude, codex, or unknown");
      }
      tool = value;
      continue;
    }

    if (arg === "--note") {
      userNote = args[++i];
      if (!userNote) throw new Error("--note requires a value");
      continue;
    }

    if (arg === "--raw") {
      captureRaw = true;
      continue;
    }

    if (arg === "--no-inject") {
      noInject = true;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printRunHelp();
      showedHelp = true;
      break;
    }

    command.push(...args.slice(i));
    break;
  }

  if (command.length === 0 && !showedHelp) {
    throw new Error("No command provided. Use: mesh run [--tool claude|codex] [--note text] [--raw] [--no-inject] -- <command> [...args]");
  }

  return { tool, userNote, captureRaw, noInject, command, showedHelp };
}

function formatCheck(value: boolean): string {
  return value ? "yes" : "no";
}

function printHelp(): void {
  console.log(`context-mesh

Usage:
  mesh init
  mesh run [--tool claude|codex] [--note text] [--raw] [--no-inject] -- <command> [...args]
  mesh status
  mesh snapshot
  mesh doctor
`);
}

function printRunHelp(): void {
  console.log(`mesh run

Usage:
  mesh run [--tool claude|codex] [--note text] [--raw] [--no-inject] -- <command> [...args]

Examples:
  mesh run --tool claude -- claude "refactor auth"
  mesh run --tool codex --note "added tests for auth middleware" -- codex "write tests"
`);
}

if (isEntrypoint()) {
  const code = await main();
  process.exitCode = code;
}

export function isEntrypoint(metaUrl = import.meta.url, argv1 = process.argv[1]): boolean {
  if (!argv1) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argv1);
  } catch {
    return false;
  }
}
