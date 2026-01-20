// bitbucket-agent-cli - Bitbucket CLI for coding agents
import { program, type Command } from "commander";
import { login, status, logout } from "./commands/auth.ts";
import {
  list,
  view,
  comments,
  diff,
  create,
  addComment,
  resolveComment,
  resolveTask,
} from "./commands/pr.ts";
import { api } from "./commands/api.ts";
import { setJsonOutput, outputError } from "./output.ts";
import pkg from "../package.json";

// Re-export outputError for backwards compatibility
export { outputError } from "./output.ts";

// Program setup
program.option("--json", "Output in JSON format").hook("preAction", (thisCommand: Command) => {
  const opts = thisCommand.optsWithGlobals();
  setJsonOutput(opts.json === true);
});

program
  .name("bitbucket-agent-cli")
  .description("Bitbucket CLI for coding agents")
  .version(pkg.version)
  .addHelpText(
    "after",
    `
Environment Variables:
  BB_USERNAME      Bitbucket username
  BB_APP_PASSWORD  Bitbucket app password

Exit Codes:
  0  Success
  1  General error
  2  Authentication required or failed
  3  Not found (PR, repo, etc.)`,
  );

// Auth commands
const authCmd = program.command("auth").description("Manage authentication");

authCmd
  .command("login")
  .description("Save credentials")
  .requiredOption("-u, --username <username>", "Bitbucket username")
  .requiredOption("-p, --app-password <password>", "Bitbucket app password")
  .action(login);

authCmd.command("status").description("Check authentication status").action(status);

authCmd.command("logout").description("Remove stored credentials").action(logout);

// PR commands
const prCmd = program.command("pr").description("Pull request operations");

prCmd
  .command("list")
  .description("List pull requests")
  .option("-s, --state <state>", "Filter by state (open, merged, declined, superseded)", "open")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action(list);

prCmd
  .command("view <pr-id>")
  .description("View PR details")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action(view);

prCmd
  .command("comments <pr-id>")
  .description("View PR comments")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action(comments);

prCmd
  .command("diff <pr-id>")
  .description("View PR diff")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action(diff);

prCmd
  .command("create")
  .description("Create a new pull request")
  .option("-t, --title <title>", "PR title (defaults to branch name)")
  .option("-s, --source <branch>", "Source branch (defaults to current branch)")
  .option("-d, --destination <branch>", "Destination branch (defaults to main)")
  .option("-m, --description <text>", "PR description")
  .option("-c, --close", "Close source branch after merge")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action(create);

// PR comment subcommands
const commentCmd = prCmd.command("comment").description("PR comment operations");

commentCmd
  .command("add <pr-id>")
  .description("Add a comment or reply to a pull request")
  .requiredOption("-m, --message <text>", "Comment content")
  .option("-p, --parent <id>", "Parent comment ID (for replies)")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action(addComment);

commentCmd
  .command("resolve <pr-id> <comment-id>")
  .description("Resolve a comment thread")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action(resolveComment);

commentCmd
  .command("unresolve <pr-id> <comment-id>")
  .description("Reopen a resolved comment thread")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action((prId, commentId, options) =>
    resolveComment(prId, commentId, { ...options, unresolve: true }),
  );

// PR task subcommands
const taskCmd = prCmd.command("task").description("PR task operations");

taskCmd
  .command("resolve <pr-id> <task-id>")
  .description("Resolve a task")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action(resolveTask);

taskCmd
  .command("unresolve <pr-id> <task-id>")
  .description("Reopen a resolved task")
  .option("-r, --repo <repo>", "Workspace/repo (auto-detected from git remote)")
  .action((prId, taskId, options) => resolveTask(prId, taskId, { ...options, unresolve: true }));

// API command
program
  .command("api <endpoint>")
  .description("Raw API access (GET request to Bitbucket API)")
  .action(api);

// Parse and execute
program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  outputError(message, 1);
});
