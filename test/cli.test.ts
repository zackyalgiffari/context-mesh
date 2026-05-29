import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isEntrypoint, main } from "../src/cli.js";

const execFileAsync = promisify(execFile);

test("init creates local store, gitignore entry, and snippets", async () => {
  const cwd = await tempDir();
  const code = await main(["init"], cwd);

  assert.equal(code, 0);
  assert.equal(await fileExists(path.join(cwd, ".mesh", "events.jsonl")), true);
  assert.match(await readFile(path.join(cwd, ".mesh", "CONTEXT_SNAPSHOT.md"), "utf8"), /No context events/);
  assert.match(await readFile(path.join(cwd, ".gitignore"), "utf8"), /\.mesh\//);
});

test("run logs a one-shot command without raw transcript by default", async () => {
  const cwd = await tempDir();
  await execFileAsync("git", ["init"], { cwd });
  await writeFile(path.join(cwd, "tracked.txt"), "before\n", "utf8");
  await execFileAsync("git", ["add", "tracked.txt"], { cwd });
  await execFileAsync("git", ["commit", "-m", "initial"], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Context Mesh",
      GIT_AUTHOR_EMAIL: "mesh@example.com",
      GIT_COMMITTER_NAME: "Context Mesh",
      GIT_COMMITTER_EMAIL: "mesh@example.com"
    }
  });

  await main(["init"], cwd);

  const script = path.join(cwd, "fake-claude.mjs");
  await writeFile(
    script,
    [
      "import { appendFileSync } from 'node:fs';",
      "appendFileSync('tracked.txt', 'after\\n');",
      "console.log('sensitive output that should not be stored');"
    ].join("\n"),
    "utf8"
  );

  const code = await main(["run", "--tool", "claude", "--note", "updated tracked file", "--", process.execPath, script], cwd);

  assert.equal(code, 0);
  const events = await readFile(path.join(cwd, ".mesh", "events.jsonl"), "utf8");
  assert.match(events, /updated tracked file/);
  assert.match(events, /tracked\.txt/);
  assert.doesNotMatch(events, /sensitive output/);

  const snapshot = await readFile(path.join(cwd, ".mesh", "CONTEXT_SNAPSHOT.md"), "utf8");
  assert.match(snapshot, /updated tracked file/);
  assert.match(snapshot, /tracked\.txt/);
  assert.equal(await fileExists(path.join(cwd, ".mesh", "raw")), false);
});

test("run --no-inject does not modify argv even when a snapshot is populated", async () => {
  const cwd = await tempDir();
  await execFileAsync("git", ["init"], { cwd });
  await writeFile(path.join(cwd, "tracked.txt"), "before\n", "utf8");
  await execFileAsync("git", ["add", "tracked.txt"], { cwd });
  await execFileAsync("git", ["commit", "-m", "initial"], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Context Mesh",
      GIT_AUTHOR_EMAIL: "mesh@example.com",
      GIT_COMMITTER_NAME: "Context Mesh",
      GIT_COMMITTER_EMAIL: "mesh@example.com"
    }
  });

  await main(["init"], cwd);

  const seed = path.join(cwd, "seed.mjs");
  await writeFile(seed, "console.log('seed');\n", "utf8");
  await main(["run", "--tool", "claude", "--note", "seeded prior context", "--", process.execPath, seed], cwd);

  const echoer = path.join(cwd, "echo-argv.mjs");
  await writeFile(echoer, "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n", "utf8");

  await main(
    ["run", "--tool", "claude", "--no-inject", "--raw", "--", process.execPath, echoer, "a prompt that would otherwise be wrapped"],
    cwd
  );

  const events = (await readFile(path.join(cwd, ".mesh", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const last = events[events.length - 1];

  assert.equal(last.injected, false);

  const rawStdout = await readFile(path.join(cwd, ".mesh", "raw", `${last.id}.stdout.txt`), "utf8");
  const observedArgv = JSON.parse(rawStdout);
  assert.deepEqual(observedArgv, ["a prompt that would otherwise be wrapped"]);
});

test("entrypoint detection handles paths with spaces", async () => {
  const cwd = await tempDir();
  const dir = path.join(cwd, "path with spaces");
  await mkdir(dir);
  const cliPath = path.join(dir, "cli.js");
  await writeFile(cliPath, "", "utf8");

  assert.equal(isEntrypoint(pathToFileURL(cliPath).href, cliPath), true);
});

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "context-mesh-"));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
