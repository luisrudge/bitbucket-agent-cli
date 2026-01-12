# Agent Development Guide

Instructions for AI coding agents working on the `bitbucket-agent-cli` project.

## Stack

- **Runtime:** Bun (not Node.js, npm, pnpm)
- **Language:** TypeScript (strict mode)
- **Linting:** oxlint
- **Formatting:** oxfmt
- **Distribution:** Bun single-file executables

## Commands

```bash
# Install dependencies
bun install

# Run CLI in development
bun run dev [command] [args]
# Example: bun run dev pr list

# Type check
bun run type-check

# Lint
bun run lint
bun run lint:fix

# Format
bun run format
bun run format:check

# Run tests
bun test

# Build single-file executables
bun run build          # Current platform only
bun run build:all      # All platforms (darwin, linux, windows)
```

## Project Structure

```
bitbucket-agent-cli/
├── src/
│   ├── index.ts           # Entry point, command router
│   ├── commands/
│   │   ├── auth.ts        # login, status, logout
│   │   ├── pr.ts          # list, view, comments, diff
│   │   └── api.ts         # raw API access
│   ├── api/
│   │   ├── client.ts      # HTTP client with basic auth
│   │   └── types.ts       # TypeScript interfaces
│   ├── config.ts          # Auth via Bun.secrets + env vars
│   └── git.ts             # Git remote detection
├── scripts/
│   └── build.ts           # Cross-platform build script
├── ralph/                 # Ralph autonomous agent files
├── package.json
├── tsconfig.json
└── AGENTS.md              # This file
```

## Code Conventions

### Bun, Not Node

```bash
# Good
bun install
bun run dev
bun test
bunx some-package

# Bad
npm install
node script.js
npx some-package
```

### Use Bun Shell for Commands

```typescript
// Good - Bun Shell
import { $ } from "bun";
const result = await $`git remote get-url origin`.text();

// Bad - spawn
import { spawn } from "child_process";
```

### TypeScript

- Strict mode enabled
- No `any` - use `unknown` and narrow
- Explicit return types on exported functions
- Use `interface` for object shapes

### Output Format

Commands output human-readable text by default (optimized for LLM agents). Use `--json` flag for structured JSON output.

```typescript
import { output, outputError } from "../output.ts";

// Success - text by default, JSON with --json flag
output("Logged in as username", { success: true, user: "username" });
process.exit(0);

// Error - always to stderr
outputError("Not found", 3); // Exits with code 3
```

**Note:** The `api` command always outputs JSON (pretty-printed) since it returns raw API responses.

### Exit Codes

| Code | Meaning                    |
| ---- | -------------------------- |
| 0    | Success                    |
| 1    | General/unknown error      |
| 2    | Auth required or failed    |
| 3    | Not found (PR, repo, etc.) |
| 4    | Invalid arguments          |

## Authentication

Credentials are stored in the OS keychain via [Bun.secrets](https://bun.sh/docs/runtime/secrets):

- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service (libsecret)

### Auth Resolution Order

1. `BB_USERNAME` + `BB_APP_PASSWORD` env vars (highest priority)
2. OS keychain via Bun.secrets
3. Error with instructions

## Bitbucket API

### Base URL

```
https://api.bitbucket.org/2.0
```

### Authentication

Basic auth with app password:

```typescript
const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
const response = await fetch(url, {
  headers: {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  },
});
```

### Key Endpoints

| Endpoint                                                          | Description  |
| ----------------------------------------------------------------- | ------------ |
| `GET /repositories/{workspace}/{repo}/pullrequests`               | List PRs     |
| `GET /repositories/{workspace}/{repo}/pullrequests/{id}`          | Get PR       |
| `GET /repositories/{workspace}/{repo}/pullrequests/{id}/comments` | PR comments  |
| `GET /repositories/{workspace}/{repo}/pullrequests/{id}/diff`     | PR diff      |
| `GET /user`                                                       | Current user |

### Pagination

Bitbucket uses cursor-based pagination:

```json
{
  "values": [...],
  "page": 1,
  "pagelen": 10,
  "next": "https://api.bitbucket.org/2.0/...?page=2"
}
```

## Git Remote Detection

Parse workspace/repo from git remote URL:

```typescript
// SSH: git@bitbucket.org:workspace/repo.git
// HTTPS: https://bitbucket.org/workspace/repo.git
// HTTPS with user: https://user@bitbucket.org/workspace/repo.git
```

## Testing

### Manual Testing

```bash
# Copy .env.example to .env and fill in your credentials
cp .env.example .env

# Test commands (bun run automatically loads .env)
bun run dev auth status
bun run dev pr list --repo workspace/repo
bun run dev pr view 123 --repo workspace/repo
bun run dev pr comments 123 --repo workspace/repo

# For one-off scripts, use --env-file flag
bun --env-file=.env -e 'console.log(process.env.BB_USERNAME)'
```

### Unit Tests

```typescript
import { test, expect } from "bun:test";

test("example test", () => {
  // ...
});
```

## Building Executables

### Single Platform

```bash
bun build --compile --minify ./src/index.ts --outfile dist/bitbucket-agent-cli
```

### Cross-Platform

```bash
# macOS ARM64
bun build --compile --target=bun-darwin-arm64 ./src/index.ts --outfile dist/bitbucket-agent-cli-darwin-arm64

# macOS x64
bun build --compile --target=bun-darwin-x64 ./src/index.ts --outfile dist/bitbucket-agent-cli-darwin-x64

# Linux x64
bun build --compile --target=bun-linux-x64 ./src/index.ts --outfile dist/bitbucket-agent-cli-linux-x64

# Linux ARM64
bun build --compile --target=bun-linux-arm64 ./src/index.ts --outfile dist/bitbucket-agent-cli-linux-arm64

# Windows x64
bun build --compile --target=bun-windows-x64 ./src/index.ts --outfile dist/bitbucket-agent-cli-windows-x64.exe
```

## Common Patterns

### Command Structure

```typescript
// src/commands/pr.ts
import { output, outputError } from "../output.ts";

export async function list(options: ListOptions): Promise<void> {
  const { workspace, repo } = await getRepo(options);
  const auth = await requireAuth();

  const response = await api.get(`/repositories/${workspace}/${repo}/pullrequests`);
  const prs = response.values.map(formatPr);

  // Text output for humans/agents, JSON with --json flag
  output(formatPrListText(prs, options.state), { prs });
  process.exit(0);
}
```

### Error Handling

```typescript
import { outputError } from "../output.ts";

function handleApiError(error: unknown): never {
  if (error instanceof AuthError) {
    outputError("Auth failed", 2); // Always to stderr
  }
  if (error instanceof NotFoundError) {
    outputError("Not found", 3);
  }
  outputError(String(error), 1);
}
```

## Troubleshooting

### "Not a git repository"

Commands that auto-detect repo need to run inside a git repo with a Bitbucket remote. Use `--repo workspace/repo` to override.

### API returns 401

- Check credentials are correct
- App password may have expired
- App password may lack required permissions (account, repository, pullrequest)
