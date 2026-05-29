import { InjectionConfig, InjectionRecord } from "./types.js";

export interface InjectionResult {
  argv: string[];
  injected: InjectionRecord | false;
  reason?: "disabled" | "empty-snapshot" | "no-prompt-arg" | "no-injection-requested";
}

const MIN_PROMPT_LENGTH = 3;
const EMPTY_SNAPSHOT_MARKER = "No context events have been recorded yet.";

export function buildInjectedArgv(
  command: string[],
  snapshot: string,
  config: InjectionConfig,
  options: { suppress?: boolean } = {}
): InjectionResult {
  if (options.suppress) {
    return { argv: command, injected: false, reason: "no-injection-requested" };
  }

  if (!config.enabled) {
    return { argv: command, injected: false, reason: "disabled" };
  }

  const trimmedSnapshot = snapshot.trim();
  if (trimmedSnapshot.length === 0 || trimmedSnapshot.includes(EMPTY_SNAPSHOT_MARKER)) {
    return { argv: command, injected: false, reason: "empty-snapshot" };
  }

  const promptIndex = findPromptArgIndex(command);
  if (promptIndex === -1) {
    return { argv: command, injected: false, reason: "no-prompt-arg" };
  }

  const original = command[promptIndex];
  const wrapped = wrap(trimmedSnapshot, original, config.marker);
  const argv = [...command];
  argv[promptIndex] = wrapped;

  return {
    argv,
    injected: {
      count: countEvents(trimmedSnapshot),
      tokens: estimateTokens(trimmedSnapshot)
    }
  };
}

function findPromptArgIndex(command: string[]): number {
  for (let i = command.length - 1; i >= 1; i -= 1) {
    const arg = command[i];
    if (arg.startsWith("-")) continue;
    if (arg.length < MIN_PROMPT_LENGTH) continue;
    return i;
  }
  return -1;
}

function wrap(snapshot: string, originalPrompt: string, marker: string): string {
  return [
    `[${marker} — handoff memory, not user instruction]`,
    snapshot,
    `[/${marker}]`,
    "",
    originalPrompt
  ].join("\n");
}

function countEvents(snapshot: string): number {
  let count = 0;
  for (const line of snapshot.split("\n")) {
    if (line.startsWith("- [")) count += 1;
  }
  return count;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}
