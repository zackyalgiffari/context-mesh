import { readFile } from "node:fs/promises";
import { configPath, pathExists } from "./paths.js";
import { InjectionConfig, MeshConfig } from "./types.js";

export const DEFAULT_INJECTION: InjectionConfig = {
  enabled: true,
  marker: "CONTEXT MESH",
  maxTokens: 500,
  maxEvents: 12
};

export const DEFAULT_CONFIG: MeshConfig = {
  injection: { ...DEFAULT_INJECTION }
};

export async function loadConfig(projectRoot: string): Promise<MeshConfig> {
  const filePath = configPath(projectRoot);
  if (!(await pathExists(filePath))) {
    return defaultConfig();
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<MeshConfig> | null;
    return mergeConfig(parsed ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[context-mesh] Failed to read ${filePath}: ${message}. Using defaults.`);
    return defaultConfig();
  }
}

export function defaultConfig(): MeshConfig {
  return { injection: { ...DEFAULT_INJECTION } };
}

export function mergeConfig(partial: Partial<MeshConfig>): MeshConfig {
  return {
    injection: {
      ...DEFAULT_INJECTION,
      ...(partial.injection ?? {})
    }
  };
}

export function serializeConfig(config: MeshConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}
