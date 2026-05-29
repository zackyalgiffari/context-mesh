import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { defaultConfig, serializeConfig } from "./config.js";
import { initializeStore } from "./storage.js";
import { configPath, pathExists } from "./paths.js";

export interface InitResult {
  projectRoot: string;
  gitignoreUpdated: boolean;
  configCreated: boolean;
  agentsSnippet: string;
  claudeSnippet: string;
  aliasSnippet: string;
}

export async function initProject(projectRoot: string): Promise<InitResult> {
  await initializeStore(projectRoot);
  const gitignoreUpdated = await ensureGitignore(projectRoot);
  const configCreated = await ensureConfig(projectRoot);

  return {
    projectRoot,
    gitignoreUpdated,
    configCreated,
    agentsSnippet: agentsSnippet(),
    claudeSnippet: claudeSnippet(),
    aliasSnippet: aliasSnippet()
  };
}

async function ensureConfig(projectRoot: string): Promise<boolean> {
  const filePath = configPath(projectRoot);
  if (await pathExists(filePath)) {
    return false;
  }
  await writeFile(filePath, serializeConfig(defaultConfig()), "utf8");
  return true;
}

async function ensureGitignore(projectRoot: string): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const entry = ".mesh/";

  if (!(await pathExists(gitignorePath))) {
    await writeFile(gitignorePath, `${entry}\n`, "utf8");
    return true;
  }

  const content = await readFile(gitignorePath, "utf8");
  const hasEntry = content
    .split("\n")
    .map((line) => line.trim())
    .includes(entry);

  if (hasEntry) {
    return false;
  }

  const prefix = content.endsWith("\n") || content.length === 0 ? "" : "\n";
  await writeFile(gitignorePath, `${content}${prefix}${entry}\n`, "utf8");
  return true;
}

function agentsSnippet(): string {
  return [
    "<!-- context-mesh -->",
    "Before continuing work in this repository, read `.mesh/CONTEXT_SNAPSHOT.md` if it exists.",
    "Use it as recent handoff memory from other AI coding agents, then verify the current files and tests directly.",
    "<!-- /context-mesh -->"
  ].join("\n");
}

function claudeSnippet(): string {
  return [
    "<!-- context-mesh -->",
    "Read `.mesh/CONTEXT_SNAPSHOT.md` before starting or resuming work in this repository.",
    "Treat it as compact memory from prior Claude/Codex sessions, not as authoritative state.",
    "<!-- /context-mesh -->"
  ].join("\n");
}

function aliasSnippet(): string {
  return [
    "alias claude='mesh run --tool claude -- claude'",
    "alias codex='mesh run --tool codex -- codex'"
  ].join("\n");
}
