# Contributing to Context Mesh

Thanks for your interest! Context Mesh is a small, focused project — these
notes should be enough to get you productive quickly.

## Development setup

```bash
git clone https://github.com/zackyalgiffari/context-mesh.git
cd context-mesh
npm install
npm test
```

You need Node.js 20 or newer. There are no runtime dependencies; the only
dev dependencies are TypeScript and `@types/node`.

## Common tasks

```bash
npm run build   # compile TypeScript -> dist/
npm test        # build + run node --test on dist/test/*.test.js
```

To run the CLI locally without installing globally:

```bash
node ./dist/src/cli.js init
node ./dist/src/cli.js status
```

## Scope (V1)

V1 deliberately stays small. In scope:

- local-only storage in `.mesh/`
- one-shot wrappers via `mesh run -- <command>`
- JSONL event history + token-budgeted `CONTEXT_SNAPSHOT.md`
- active prompt injection (`[CONTEXT MESH]` block wrapping the prompt arg)
- per-project `.mesh/config.json`

Out of scope for V1 (please open a discussion before submitting a PR):

- background daemon / IPC
- tool-specific adapters (Claude/Codex flag detection, rate-limit signals)
- routing and fallback between tools
- LLM-based summarization or compression
- cloud sync or shared memory across machines

## Adding tests

Tests live in `test/` and use the built-in `node:test` runner.
Add a `*.test.ts` file mirroring the source it covers
(e.g. `test/inject.test.ts` covers `src/inject.ts`). Tests run against the
compiled output under `dist/test/`, so make sure `npm test` passes before
opening a PR.

Prefer pure-function tests when possible (see `test/inject.test.ts` and
`test/storage.test.ts`). For end-to-end coverage that touches `git` or
`spawn`, use a temporary directory (see `test/cli.test.ts`).

## Pull requests

1. Open a discussion or issue first for non-trivial changes.
2. Keep PRs focused — one feature or fix per PR.
3. Ensure `npm test` passes locally; CI will re-run on Node 20 and 22.
4. Update `README.md` if you change user-visible behavior.

## License

By contributing, you agree that your contributions will be licensed under
the MIT License (see `LICENSE`).
