import path from "node:path";
import { access, mkdir } from "node:fs/promises";

export const MESH_DIR = ".mesh";
export const EVENTS_FILE = "events.jsonl";
export const SNAPSHOT_FILE = "CONTEXT_SNAPSHOT.md";
export const CONFIG_FILE = "config.json";
export const RAW_DIR = "raw";

export function meshDir(projectRoot: string): string {
  return path.join(projectRoot, MESH_DIR);
}

export function eventsPath(projectRoot: string): string {
  return path.join(meshDir(projectRoot), EVENTS_FILE);
}

export function snapshotPath(projectRoot: string): string {
  return path.join(meshDir(projectRoot), SNAPSHOT_FILE);
}

export function configPath(projectRoot: string): string {
  return path.join(meshDir(projectRoot), CONFIG_FILE);
}

export function rawDir(projectRoot: string): string {
  return path.join(meshDir(projectRoot), RAW_DIR);
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureMeshDirs(projectRoot: string): Promise<void> {
  await mkdir(meshDir(projectRoot), { recursive: true });
}
