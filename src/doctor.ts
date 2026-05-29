import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findProjectRoot } from "./project.js";

const execFileAsync = promisify(execFile);

export interface DoctorResult {
  meshInitialized: boolean;
  claudeAvailable: boolean;
  codexAvailable: boolean;
  gitAvailable: boolean;
}

export async function doctor(cwd: string): Promise<DoctorResult> {
  const [projectRoot, claudeAvailable, codexAvailable, gitAvailable] = await Promise.all([
    findProjectRoot(cwd),
    commandAvailable("claude"),
    commandAvailable("codex"),
    commandAvailable("git")
  ]);

  return {
    meshInitialized: projectRoot !== null,
    claudeAvailable,
    codexAvailable,
    gitAvailable
  };
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["--version"], { maxBuffer: 1024 * 64 });
    return true;
  } catch {
    return false;
  }
}
