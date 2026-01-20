# bitbucket-agent-cli

Bitbucket CLI for AI agents (and maybe humans).

**Requires [Bun](https://bun.sh)**

## Authentication

Create an [App Password](https://bitbucket.org/account/settings/app-passwords/) with the following scopes:

| Scope                         | Required for                                   |
| ----------------------------- | ---------------------------------------------- |
| `read:user:bitbucket`         | `auth login`, `auth status`                    |
| `read:repository:bitbucket`   | Repo info, default branch detection            |
| `read:pullrequest:bitbucket`  | `pr list`, `pr view`, `pr comments`, `pr diff` |
| `write:pullrequest:bitbucket` | `pr create`, `pr comment *`, `pr task *`       |

```bash
# Option 1: Environment variables
export BB_USERNAME="your-username"
export BB_APP_PASSWORD="your-app-password"

# Option 2: OS Keychain via Bun.secrets
bunx bitbucket-agent-cli@latest auth login --username your-username --app-password your-app-password
```

The `auth login` command stores credentials in your OS keychain using [Bun.secrets](https://bun.sh/docs/runtime/secrets) (macOS Keychain, Windows Credential Manager, or Linux secret service).

## Commands

```bash
# Auth
bunx bitbucket-agent-cli@latest auth login --username <user> --app-password <pass>
bunx bitbucket-agent-cli@latest auth status
bunx bitbucket-agent-cli@latest auth logout

# Pull Requests
bunx bitbucket-agent-cli@latest pr list                        # List open PRs (auto-detects repo)
bunx bitbucket-agent-cli@latest pr list --state merged         # Filter by state
bunx bitbucket-agent-cli@latest pr view 123                    # PR details + reviewers
bunx bitbucket-agent-cli@latest pr comments 123                # Comments with tasks, resolved/unresolved status
bunx bitbucket-agent-cli@latest pr diff 123                    # PR diff
bunx bitbucket-agent-cli@latest pr create                      # Create PR from current branch to main
bunx bitbucket-agent-cli@latest pr create -t "My PR" -d dev    # Create PR with title, targeting dev branch

# Comments
bunx bitbucket-agent-cli@latest pr comment add 123 -m "LGTM!"              # Add a comment
bunx bitbucket-agent-cli@latest pr comment add 123 -m "Fixed" -p 456       # Reply to comment #456
bunx bitbucket-agent-cli@latest pr comment resolve 123 456                 # Resolve a comment thread
bunx bitbucket-agent-cli@latest pr comment unresolve 123 456               # Reopen a comment thread

# Tasks
bunx bitbucket-agent-cli@latest pr task resolve 123 789                    # Resolve a task
bunx bitbucket-agent-cli@latest pr task unresolve 123 789                  # Reopen a task

# Raw API
bunx bitbucket-agent-cli@latest api /user                      # Any Bitbucket 2.0 endpoint
bunx bitbucket-agent-cli@latest api /repositories/workspace/repo
```

Use `--repo workspace/repo` to override auto-detection.

## Output

Commands output plain text by default, optimized for LLM agents. Use `--json` flag for structured JSON.

**When to use each format:**

| Format          | Best for                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Text (default)  | Understanding context: `pr view`, `pr list`, `pr comments`. Lower token count, threaded comments with indentation, human-readable timestamps. |
| JSON (`--json`) | Extracting IDs for API calls (e.g., replying to a comment), automation pipelines, programmatic field access.                                  |

**Note:** The `api` command always outputs JSON since it returns raw API responses.

## Exit Codes

| Code | Meaning       |
| ---- | ------------- |
| 0    | Success       |
| 1    | General error |
| 2    | Auth failed   |
| 3    | Not found     |
| 4    | Invalid args  |

<details>
<summary>Agent Instructions</summary>

```

Requires Bun. If not installed, notify the user and DO NOT attempt to install it yourself.
```

</details>

## License

MIT
