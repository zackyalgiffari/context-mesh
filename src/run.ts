import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { loadConfig } from "./config.js";
import { changedFilesSince, readGitState } from "./git.js";
import { buildInjectedArgv } from "./inject.js";
import { findProjectRoot } from "./project.js";
import { snapshotPath, pathExists } from "./paths.js";
import { appendEvent, writeRawTranscript, limitsFromInjection } from "./storage.js";
import { ContextEvent, RunOptions, RunResult, ToolName } from "./types.js";

export async function runWrapped(options: RunOptions): Promise<RunResult> {
  if (options.command.length === 0) {
    throw new Error("No command provided. Use: mesh run -- <command> [...args]");
  }

  const projectRoot = await findProjectRoot(options.cwd);
  if (!projectRoot) {
    throw new Error("No .mesh directory found. Run `mesh init` in this project first.");
  }

  const config = await loadConfig(projectRoot);
  const snapshot = await readSnapshot(projectRoot);
  const injection = buildInjectedArgv(options.command, snapshot, config.injection, {
    suppress: options.noInject
  });

  if (injection.injected !== false) {
    process.stderr.write(
      `[context-mesh] injecting ${injection.injected.count} entr${injection.injected.count === 1 ? "y" : "ies"} (~${injection.injected.tokens} tokens) from snapshot\n`
    );
  }

  const before = await readGitState(projectRoot);
  const startedAt = Date.now();
  const { exitCode, stdout, stderr } = await runCommand(injection.argv, projectRoot);
  const finishedAt = Date.now();
  const after = await readGitState(projectRoot);
  const filesAffected = changedFilesSince(before, after);
  const eventId = makeEventId();

  const event: ContextEvent = {
    id: eventId,
    timestamp: new Date(finishedAt).toISOString(),
    tool: options.tool || inferTool(options.command[0]),
    command: options.command,
    status: exitCode === 0 ? "success" : "failed",
    exitCode,
    durationMs: finishedAt - startedAt,
    promptSummary: summarizeCommand(options.command),
    outcomeSummary: summarizeOutcome(exitCode, filesAffected, options.userNote),
    filesAffected,
    gitBranch: after.branch,
    gitDiffStat: after.diffStat,
    userNote: options.userNote,
    injected: injection.injected
  };

  if (options.captureRaw) {
    event.rawTranscript = await writeRawTranscript(projectRoot, eventId, stdout, stderr);
  }

  await appendEvent(projectRoot, event, limitsFromInjection(config.injection));

  return { event, projectRoot };
}

async function readSnapshot(projectRoot: string): Promise<string> {
  const filePath = snapshotPath(projectRoot);
  if (!(await pathExists(filePath))) {
    return "";
  }
  return readFile(filePath, "utf8");
}

function runCommand(command: string[], cwd: string): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      resolve({
        exitCode: 127,
        stdout,
        stderr: `${stderr}${error.message}\n`
      });
    });
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

function inferTool(command: string): ToolName {
  const executable = path.basename(command);
  if (executable === "claude") return "claude";
  if (executable === "codex") return "codex";
  return "unknown";
}

function summarizeCommand(command: string[]): string {
  const rendered = shellQuote(command);
  return rendered.length > 180 ? `${rendered.slice(0, 177)}...` : rendered;
}

function summarizeOutcome(exitCode: number | null, filesAffected: string[], userNote?: string): string {
  if (userNote) {
    return userNote;
  }

  const changed = filesAffected.length === 1
    ? "1 file changed"
    : `${filesAffected.length} files changed`;

  if (exitCode === 0) {
    return `Command completed successfully; ${changed}.`;
  }

  return `Command failed with exit code ${exitCode ?? "unknown"}; ${changed}.`;
}

function shellQuote(parts: string[]): string {
  return parts
    .map((part) => (/^[A-Za-z0-9_./:=@-]+$/.test(part) ? part : JSON.stringify(part)))
    .join(" ");
}

function makeEventId(): string {
  return `evt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}
