import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitState {
  branch: string | null;
  statuses: Map<string, string>;
  diffStat: string | null;
}

async function git(args: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 1024 * 1024
    });
    return stdout.replace(/\s+$/, "");
  } catch {
    return null;
  }
}

export async function readGitState(cwd: string): Promise<GitState> {
  const [branch, status, diffStat] = await Promise.all([
    git(["branch", "--show-current"], cwd),
    git(["status", "--porcelain=v1"], cwd),
    git(["diff", "--stat"], cwd)
  ]);

  return {
    branch: branch || null,
    statuses: parsePorcelain(status || ""),
    diffStat: diffStat || null
  };
}

export function changedFilesSince(before: GitState, after: GitState): string[] {
  const files = new Set<string>();

  for (const [file, status] of after.statuses) {
    if (before.statuses.get(file) !== status) {
      files.add(file);
    }
  }

  for (const file of before.statuses.keys()) {
    if (!after.statuses.has(file)) {
      files.add(file);
    }
  }

  return [...files].sort();
}

function parsePorcelain(output: string): Map<string, string> {
  const statuses = new Map<string, string>();

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;

    const status = line.slice(0, 2).trim();
    const rawPath = line.slice(3).trim();
    const file = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1)! : rawPath;

    statuses.set(file, status);
  }

  return statuses;
}
