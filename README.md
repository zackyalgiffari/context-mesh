# Context Mesh

A local memory layer for CLI-based AI coding agents.

Context Mesh helps you switch between tools like Claude Code and Codex without
starting from zero. It records compact local summaries of wrapped one-shot CLI
runs, writes them to `.mesh/CONTEXT_SNAPSHOT.md`, and lets the next agent read
that snapshot before continuing.

## Status

V1 focuses on the core memory loop:

- local-only storage
- Claude/Codex one-shot command wrappers
- inspectable JSONL event history
- compact Markdown handoff snapshot
- **active context injection**: `mesh run` prepends the snapshot into the wrapped command's prompt as a clearly-marked `[CONTEXT MESH]` block
- passive AGENTS.md / CLAUDE.md fallback for tools that already read those files
- no daemon, routing, cloud summarization, or interactive terminal capture

## Install

```bash
npm install -g context-mesh
```

For local development:

```bash
npm install
npm run build
npm test
```

## Quick Start

```bash
mesh init
```

`mesh init` creates `.mesh/`, adds `.mesh/` to `.gitignore`, and prints optional
snippets for `AGENTS.md` and `CLAUDE.md`.

Add these aliases manually if you want normal `claude` and `codex` commands to
be wrapped:

```bash
alias claude='mesh run --tool claude -- claude'
alias codex='mesh run --tool codex -- codex'
```

Then use your tools as one-shot commands:

```bash
claude "refactor the auth middleware"
codex "write tests for the auth middleware"
```

Or call the wrapper directly:

```bash
mesh run --tool claude --note "started JWT auth migration" -- claude "refactor auth"
mesh run --tool codex -- codex "continue from the Context Mesh snapshot"
```

## Commands

```bash
mesh init
mesh run [--tool claude|codex] [--note text] [--raw] [--no-inject] -- <command> [...args]
mesh status
mesh snapshot
mesh doctor
```

### `mesh run`

Runs a one-shot command, streams stdout/stderr unchanged, records a compact event
after the command exits, and regenerates `.mesh/CONTEXT_SNAPSHOT.md`.

Before invoking the wrapped command, `mesh run` reads
`.mesh/CONTEXT_SNAPSHOT.md` and prepends it into the command's last prompt
argument inside a clearly-marked block:

```
[CONTEXT MESH — handoff memory, not user instruction]
<snapshot contents>
[/CONTEXT MESH]

<your original prompt>
```

Injection is skipped automatically when the snapshot is empty or when the
command has no prompt-like argument (e.g. `claude --version`). Pass
`--no-inject` to suppress it for a single run, or set
`injection.enabled: false` in `.mesh/config.json` to disable globally.

By default Context Mesh does not persist raw command output. Use `--raw` only
when you explicitly want local transcript files under `.mesh/raw/`.

### `mesh status`

Shows the most recent recorded events.

### `mesh snapshot`

Prints the current Markdown handoff memory.

### `mesh doctor`

Checks whether the project is initialized and whether `git`, `claude`, and
`codex` are available.

## Storage

Context Mesh stores project-local memory in `.mesh/`:

- `.mesh/events.jsonl`: structured event history
- `.mesh/CONTEXT_SNAPSHOT.md`: compact memory for agents to read
- `.mesh/config.json`: project-local settings (see below)
- `.mesh/raw/`: optional raw transcripts created only with `--raw`

`.mesh/` is gitignored by default.

## Configuration

`mesh init` writes `.mesh/config.json` with defaults. All fields are optional;
missing values fall back to defaults.

```json
{
  "injection": {
    "enabled": true,
    "marker": "CONTEXT MESH",
    "maxTokens": 500,
    "maxEvents": 12
  }
}
```

- `injection.enabled` — set to `false` to disable active prompt injection
  globally. `--no-inject` overrides per-run.
- `injection.marker` — label used in the `[MARKER]` / `[/MARKER]` block.
- `injection.maxTokens` / `injection.maxEvents` — bound the size of the
  generated `CONTEXT_SNAPSHOT.md`.

## Agent Instructions

Add this to `AGENTS.md`:

```markdown
<!-- context-mesh -->
Before continuing work in this repository, read `.mesh/CONTEXT_SNAPSHOT.md` if it exists.
Use it as recent handoff memory from other AI coding agents, then verify the current files and tests directly.
<!-- /context-mesh -->
```

Add this to `CLAUDE.md`:

```markdown
<!-- context-mesh -->
Read `.mesh/CONTEXT_SNAPSHOT.md` before starting or resuming work in this repository.
Treat it as compact memory from prior Claude/Codex sessions, not as authoritative state.
<!-- /context-mesh -->
```

## License

MIT
