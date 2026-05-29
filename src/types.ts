export type ToolName = "claude" | "codex" | "unknown";

export type EventStatus = "success" | "failed";

export interface InjectionConfig {
  enabled: boolean;
  marker: string;
  maxTokens: number;
  maxEvents: number;
}

export interface MeshConfig {
  injection: InjectionConfig;
}

export interface InjectionRecord {
  count: number;
  tokens: number;
}

export interface ContextEvent {
  id: string;
  timestamp: string;
  tool: ToolName;
  command: string[];
  status: EventStatus;
  exitCode: number | null;
  durationMs: number;
  promptSummary: string;
  outcomeSummary: string;
  filesAffected: string[];
  gitBranch: string | null;
  gitDiffStat: string | null;
  userNote?: string;
  injected?: InjectionRecord | false;
  rawTranscript?: {
    stdoutPath: string;
    stderrPath: string;
  };
}

export interface RunOptions {
  cwd: string;
  tool?: ToolName;
  command: string[];
  userNote?: string;
  captureRaw?: boolean;
  noInject?: boolean;
}

export interface RunResult {
  event: ContextEvent;
  projectRoot: string;
}
