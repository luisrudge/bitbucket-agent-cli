// PR commands: list, view, comments, diff, create
import { getCurrentBranch, getRepoFromGit, type RepoInfo } from "../git.ts";
import { output, outputError, formatTimestamp } from "../output.ts";
import { getAuth } from "../config.ts";
import { ApiClient, AuthError, ForbiddenError, NotFoundError } from "../api/client.ts";
import type {
  Comment,
  CreatePullRequestBody,
  PaginatedResponse,
  PullRequest,
} from "../api/types.ts";

/**
 * Options for commands that need repo
 */
interface RepoOptions {
  repo?: string;
}

/**
 * Options for list command
 */
interface ListOptions extends RepoOptions {
  state: string;
}

/**
 * Parse workspace/repo string into RepoInfo
 */
function parseRepoFlag(repoFlag: string): RepoInfo | null {
  const parts = repoFlag.split("/");
  if (parts.length !== 2) {
    return null;
  }
  const workspace = parts[0];
  const repo = parts[1];
  if (!workspace || !repo) {
    return null;
  }
  return { workspace, repo };
}

/**
 * Resolve workspace/repo from --repo option or git remote.
 * Exits with error code 4 if repo cannot be determined.
 */
async function getRepo(options: RepoOptions): Promise<RepoInfo> {
  // Check --repo option first
  if (options.repo) {
    const parsed = parseRepoFlag(options.repo);
    if (!parsed) {
      return outputError(
        `Invalid --repo format: "${options.repo}". Expected format: workspace/repo`,
        4,
      );
    }
    return parsed;
  }

  // Fall back to git remote detection
  const gitRepo = await getRepoFromGit();
  if (gitRepo) {
    return gitRepo;
  }

  // Neither option nor git remote available
  return outputError(
    "Could not determine repository. Use --repo workspace/repo or run from a directory with a Bitbucket git remote.",
    4,
  );
}

/**
 * Require auth credentials or exit with error
 */
async function requireAuth(): Promise<{
  username: string;
  appPassword: string;
}> {
  const auth = await getAuth();
  if (!auth) {
    return outputError(
      "Authentication required. Run 'bitbucket-agent-cli auth login' or set BB_USERNAME and BB_APP_PASSWORD environment variables.",
      2,
    );
  }
  return auth;
}

/**
 * Parse and validate PR ID argument
 */
function parsePrId(prIdArg: string): number {
  const prId = parseInt(prIdArg, 10);
  if (isNaN(prId) || prId <= 0) {
    return outputError(`Invalid PR ID: "${prIdArg}". Must be a positive integer.`, 4);
  }
  return prId;
}

/**
 * Handle common API errors for PR commands
 */
function handleApiError(error: unknown, repo: RepoInfo, prId?: number): never {
  if (error instanceof AuthError) {
    outputError("Authentication failed. Check your credentials.", 2);
  }
  if (error instanceof ForbiddenError) {
    outputError(
      `Insufficient permissions to access ${repo.workspace}/${repo.repo}. Check your app password permissions.`,
      2,
    );
  }
  if (error instanceof NotFoundError) {
    const resource = prId
      ? `Pull request not found: ${repo.workspace}/${repo.repo}#${prId}`
      : `Repository not found: ${repo.workspace}/${repo.repo}`;
    outputError(resource, 3);
  }
  throw error;
}

/**
 * Valid PR states for filtering
 */
const VALID_STATES = ["open", "merged", "declined", "superseded"] as const;
type PrState = (typeof VALID_STATES)[number];

/**
 * Format a PR for minimal JSON output
 */
function formatPr(pr: PullRequest): {
  id: number;
  title: string;
  state: string;
  author: string;
  source: string;
  updated: string;
} {
  return {
    id: pr.id,
    title: pr.title,
    state: pr.state,
    author: pr.author.display_name,
    source: pr.source.branch.name,
    updated: pr.updated_on,
  };
}

/**
 * Format PR list as human-readable text
 */
function formatPrListText(prs: ReturnType<typeof formatPr>[], state: string): string {
  const stateLabel = state.charAt(0).toUpperCase() + state.slice(1);

  if (prs.length === 0) {
    return `No ${stateLabel.toLowerCase()} pull requests`;
  }

  const lines = [`${stateLabel} Pull Requests (${prs.length})`, ""];

  for (const pr of prs) {
    lines.push(`#${pr.id} ${pr.title}`);
    lines.push(`     by ${pr.author} | ${pr.source} -> main`);
    lines.push(`     Updated ${formatTimestamp(pr.updated)}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * List PRs in a repository
 */
export async function list(options: ListOptions): Promise<void> {
  const auth = await requireAuth();
  const repo = await getRepo(options);

  // Validate state
  const lowerState = options.state.toLowerCase() as PrState;
  if (!VALID_STATES.includes(lowerState)) {
    return outputError(
      `Invalid --state value: "${options.state}". Valid values: ${VALID_STATES.join(", ")}`,
      4,
    );
  }

  const client = new ApiClient(auth.username, auth.appPassword);
  const endpoint = `/repositories/${repo.workspace}/${repo.repo}/pullrequests?state=${lowerState.toUpperCase()}`;

  try {
    const response = await client.get<PaginatedResponse<PullRequest>>(endpoint);
    const prs = response.values.map(formatPr);
    output(formatPrListText(prs, lowerState), { prs });
    process.exit(0);
  } catch (error) {
    handleApiError(error, repo);
  }
}

/**
 * Format reviewer for output
 */
function formatReviewer(reviewer: { user: { display_name: string }; approved: boolean }): {
  user: string;
  approved: boolean;
} {
  return {
    user: reviewer.user.display_name,
    approved: reviewer.approved,
  };
}

/**
 * PR view output shape
 */
interface PrViewOutput {
  id: number;
  title: string;
  state: string;
  author: string;
  source: string;
  destination: string;
  created: string;
  updated: string;
  comments: number;
  url: string | null;
  reviewers: { user: string; approved: boolean }[];
  tasks?: { total: number; resolved: number };
}

/**
 * Format PR view as human-readable text
 */
function formatPrViewText(pr: PrViewOutput): string {
  const lines = [
    `PR #${pr.id}: ${pr.title}`,
    `State: ${pr.state}`,
    `Author: ${pr.author}`,
    `Branch: ${pr.source} -> ${pr.destination}`,
    `Created: ${formatTimestamp(pr.created)}`,
    `Updated: ${formatTimestamp(pr.updated)}`,
    `Comments: ${pr.comments}`,
  ];

  if (pr.url) {
    lines.push(`URL: ${pr.url}`);
  }

  if (pr.tasks) {
    lines.push(`Tasks: ${pr.tasks.resolved}/${pr.tasks.total} resolved`);
  }

  if (pr.reviewers.length > 0) {
    lines.push("");
    lines.push("Reviewers:");
    for (const reviewer of pr.reviewers) {
      const status = reviewer.approved ? "approved" : "pending";
      lines.push(`  - ${reviewer.user} (${status})`);
    }
  }

  return lines.join("\n");
}

/**
 * View a specific PR
 */
export async function view(prIdArg: string, options: RepoOptions): Promise<void> {
  const prId = parsePrId(prIdArg);
  const auth = await requireAuth();
  const repo = await getRepo(options);

  const client = new ApiClient(auth.username, auth.appPassword);
  const endpoint = `/repositories/${repo.workspace}/${repo.repo}/pullrequests/${prId}`;

  try {
    const pr = await client.get<PullRequest>(endpoint);

    // Build output object
    const prOutput: PrViewOutput = {
      id: pr.id,
      title: pr.title,
      state: pr.state,
      author: pr.author.display_name,
      source: pr.source.branch.name,
      destination: pr.destination.branch.name,
      created: pr.created_on,
      updated: pr.updated_on,
      comments: pr.comment_count ?? 0,
      url: pr.links?.html?.href ?? null,
      reviewers: (pr.reviewers ?? []).map(formatReviewer),
    };

    // Add task counts if available
    if (typeof pr.task_count === "number") {
      prOutput.tasks = {
        total: pr.task_count,
        resolved: 0, // Bitbucket doesn't provide resolved count in PR response
      };
    }

    output(formatPrViewText(prOutput), prOutput);
    process.exit(0);
  } catch (error) {
    handleApiError(error, repo, prId);
  }
}

/**
 * Formatted comment for output
 */
interface FormattedComment {
  id: number;
  parent: number | null;
  author: string;
  content: string;
  created: string;
  resolved: boolean;
  file: string | null;
  line: number | null;
}

/**
 * Format a comment for output
 */
function formatComment(comment: Comment): FormattedComment {
  return {
    id: comment.id,
    parent: comment.parent?.id ?? null,
    author: comment.user.display_name,
    content: comment.content.raw,
    created: comment.created_on,
    resolved: comment.resolution !== undefined,
    file: comment.inline?.path ?? null,
    line: comment.inline?.to ?? comment.inline?.from ?? null,
  };
}

/**
 * Fetch all pages of comments
 */
async function fetchAllComments(client: ApiClient, endpoint: string): Promise<Comment[]> {
  const allComments: Comment[] = [];
  let nextUrl: string | undefined = endpoint;

  while (nextUrl !== undefined) {
    const urlToFetch: string = nextUrl;
    let response: PaginatedResponse<Comment>;

    if (urlToFetch.startsWith("http")) {
      response = await client.getFullUrl<PaginatedResponse<Comment>>(urlToFetch);
    } else {
      response = await client.get<PaginatedResponse<Comment>>(urlToFetch);
    }

    allComments.push(...response.values);
    nextUrl = response.next;
  }

  return allComments;
}

/**
 * Comments output shape
 */
interface CommentsOutput {
  total: number;
  resolved: number;
  unresolved: number;
  comments: FormattedComment[];
}

/**
 * Format comments as human-readable text with threading
 */
function formatCommentsText(prId: number, data: CommentsOutput): string {
  if (data.total === 0) {
    return `No comments on PR #${prId}`;
  }

  const lines = [
    `Comments on PR #${prId} (${data.total} total, ${data.resolved} resolved, ${data.unresolved} unresolved)`,
    "",
  ];

  // Build a map of parent -> children for threading
  const childrenMap = new Map<number | null, FormattedComment[]>();
  for (const comment of data.comments) {
    const parentId = comment.parent;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(comment);
  }

  // Recursively format comments with indentation
  function formatCommentTree(parentId: number | null, indent: string): void {
    const children = childrenMap.get(parentId) ?? [];
    for (const comment of children) {
      const resolvedTag = comment.resolved ? " [RESOLVED]" : "";
      const locationTag = comment.file ? ` ${comment.file}:${comment.line}` : "";

      lines.push(
        `${indent}[#${comment.id}] ${comment.author} (${comment.created})${resolvedTag}:${locationTag}`,
      );
      lines.push(`${indent}  ${comment.content}`);
      lines.push("");

      // Recurse for replies
      formatCommentTree(comment.id, indent + "  ");
    }
  }

  formatCommentTree(null, "");

  return lines.join("\n").trimEnd();
}

/**
 * View PR comments with resolved/unresolved status
 */
export async function comments(prIdArg: string, options: RepoOptions): Promise<void> {
  const prId = parsePrId(prIdArg);
  const auth = await requireAuth();
  const repo = await getRepo(options);

  const client = new ApiClient(auth.username, auth.appPassword);
  const endpoint = `/repositories/${repo.workspace}/${repo.repo}/pullrequests/${prId}/comments`;

  try {
    const allComments = await fetchAllComments(client, endpoint);

    // Filter out deleted comments
    const activeComments = allComments.filter((c) => !c.deleted);

    // Calculate summary stats
    const resolved = activeComments.filter((c) => c.resolution !== undefined).length;
    const unresolved = activeComments.length - resolved;

    const commentsOutput: CommentsOutput = {
      total: activeComments.length,
      resolved,
      unresolved,
      comments: activeComments.map(formatComment),
    };

    output(formatCommentsText(prId, commentsOutput), commentsOutput);
    process.exit(0);
  } catch (error) {
    handleApiError(error, repo, prId);
  }
}

/**
 * View PR diff
 */
export async function diff(prIdArg: string, options: RepoOptions): Promise<void> {
  const prId = parsePrId(prIdArg);
  const auth = await requireAuth();
  const repo = await getRepo(options);

  const client = new ApiClient(auth.username, auth.appPassword);
  const endpoint = `/repositories/${repo.workspace}/${repo.repo}/pullrequests/${prId}/diff`;

  try {
    const diffText = await client.getRaw(endpoint);
    console.log(diffText);
    process.exit(0);
  } catch (error) {
    handleApiError(error, repo, prId);
  }
}

/**
 * Options for create command
 */
interface CreateOptions extends RepoOptions {
  title?: string;
  source?: string;
  destination?: string;
  description?: string;
  close?: boolean;
}

/**
 * Create PR output shape
 */
interface CreatePrOutput {
  id: number;
  title: string;
  state: string;
  source: string;
  destination: string;
  url: string | null;
}

/**
 * Format created PR as human-readable text
 */
function formatCreatePrText(pr: CreatePrOutput): string {
  const lines = [`Created PR #${pr.id}: ${pr.title}`, `Branch: ${pr.source} -> ${pr.destination}`];

  if (pr.url) {
    lines.push(`URL: ${pr.url}`);
  }

  return lines.join("\n");
}

/**
 * Create a new pull request
 */
export async function create(options: CreateOptions): Promise<void> {
  const auth = await requireAuth();
  const repo = await getRepo(options);

  // Determine source branch
  let sourceBranch = options.source;
  if (!sourceBranch) {
    sourceBranch = await getCurrentBranch();
    if (!sourceBranch) {
      return outputError(
        "Could not determine source branch. Use --source to specify the branch.",
        4,
      );
    }
  }

  // Validate not creating PR from main/master to itself
  const destBranch = options.destination ?? "main";
  if (sourceBranch === destBranch) {
    return outputError(
      `Source branch "${sourceBranch}" cannot be the same as destination branch "${destBranch}".`,
      4,
    );
  }

  // Determine title
  const title = options.title ?? sourceBranch;

  const client = new ApiClient(auth.username, auth.appPassword);
  const endpoint = `/repositories/${repo.workspace}/${repo.repo}/pullrequests`;

  const body: CreatePullRequestBody = {
    title,
    source: {
      branch: {
        name: sourceBranch,
      },
    },
  };

  if (options.destination) {
    body.destination = {
      branch: {
        name: options.destination,
      },
    };
  }

  if (options.description) {
    body.description = options.description;
  }

  if (options.close) {
    body.close_source_branch = true;
  }

  try {
    const pr = await client.post<PullRequest>(endpoint, body);

    const prOutput: CreatePrOutput = {
      id: pr.id,
      title: pr.title,
      state: pr.state,
      source: pr.source.branch.name,
      destination: pr.destination.branch.name,
      url: pr.links?.html?.href ?? null,
    };

    output(formatCreatePrText(prOutput), prOutput);
    process.exit(0);
  } catch (error) {
    handleApiError(error, repo);
  }
}
