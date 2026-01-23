// bitbucket-agent-cli - Bitbucket CLI for coding agents
import { program, Option, type Command } from "commander";
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

// Build full command tree for help display
function getCommandHelp(cmd: Command, prefix = ""): string[] {
  const lines: string[] = [];
  for (const sub of cmd.commands) {
    const name = prefix ? `${prefix} ${sub.name()}` : sub.name();
    // Get arguments from usage (e.g., "<pr-id>")
    const args = sub.registeredArguments
      .map((a) => (a.required ? `<${a.name()}>` : `[${a.name()}]`))
      .join(" ");
    const fullName = args ? `${name} ${args}` : name;
    lines.push(`  ${fullName.padEnd(44)} ${sub.description()}`);

    // Add options for leaf commands (commands with actions, not just subcommands)
    const opts = sub.options.filter((o) => !o.hidden);
    if (opts.length > 0 && sub.commands.length === 0) {
      for (const opt of opts) {
        const flags = opt.flags.padEnd(42);
        const req = opt.mandatory ? " (required)" : "";
        lines.push(`      ${flags} ${opt.description}${req}`);
      }
    }

    lines.push(...getCommandHelp(sub, name));
  }
  return lines;
}

// Program setup
program.option("--json", "Output in JSON format").hook("preAction", (thisCommand: Command) => {
  const opts = thisCommand.optsWithGlobals();
  setJsonOutput(opts.json === true);
});

program
  .name("bitbucket-agent-cli")
  .description("Bitbucket CLI for coding agents")
  .version(pkg.version)
  .configureHelp({
    formatHelp: (cmd, helper) => {
      const title = `${cmd.name()} v${pkg.version} - ${cmd.description()}\n`;
      const usage = `Usage: ${helper.commandUsage(cmd)}\n`;
      const commands = `\nCommands:\n${getCommandHelp(cmd).join("\n")}\n`;
      const options = `\nGlobal Options:\n  --json     Output in JSON format\n  -h, --help Display help\n  -V         Display version\n`;
      const env = `\nEnvironment Variables:\n  BB_USERNAME   Bitbucket username\n  BB_API_TOKEN  Bitbucket API token\n`;
      const exits = `\nExit Codes:\n  0  Success\n  1  General error\n  2  Authentication required or failed\n  3  Not found (PR, repo, etc.)\n`;
      return title + usage + commands + options + env + exits;
    },
  });

// Auth commands
const authCmd = program.command("auth").description("Manage authentication");

authCmd
  .command("login")
  .description("Save credentials")
  .requiredOption("-u, --username <username>", "Bitbucket username")
  .option("-t, --api-token <token>", "Bitbucket API token")
  .addOption(new Option("-p, --app-password <password>", "Legacy alias for --api-token").hideHelp())
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
