// Git remote detection
import { $ } from "bun";

/**
 * Repository info extracted from git remote
 */
export interface RepoInfo {
  workspace: string;
  repo: string;
}

/**
 * Check if the current directory is inside a git repository
 */
async function isGitRepo(): Promise<boolean> {
  try {
    const result = await $`git rev-parse --is-inside-work-tree`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get the remote URL for the origin remote
 */
async function getOriginUrl(): Promise<string | null> {
  try {
    const result = await $`git remote get-url origin`.quiet();
    if (result.exitCode !== 0) {
      return null;
    }
    return result.text().trim();
  } catch {
    return null;
  }
}

/**
 * Parse a Bitbucket remote URL to extract workspace and repo.
 * Supports:
 * - SSH: git@bitbucket.org:workspace/repo.git
 * - HTTPS: https://bitbucket.org/workspace/repo.git
 * - HTTPS with user: https://user@bitbucket.org/workspace/repo.git
 */
export function parseRemoteUrl(url: string): RepoInfo | null {
  // SSH format: git@bitbucket.org:workspace/repo.git
  const sshMatch = url.match(/^git@bitbucket\.org:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    const workspace = sshMatch[1];
    const repo = sshMatch[2];
    if (workspace && repo) {
      return { workspace, repo };
    }
  }

  // HTTPS format: https://bitbucket.org/workspace/repo.git
  // HTTPS with user: https://user@bitbucket.org/workspace/repo.git
  const httpsMatch = url.match(
    /^https:\/\/(?:[^@]+@)?bitbucket\.org\/([^/]+)\/([^/]+?)(?:\.git)?$/,
  );
  if (httpsMatch) {
    const workspace = httpsMatch[1];
    const repo = httpsMatch[2];
    if (workspace && repo) {
      return { workspace, repo };
    }
  }

  return null;
}

/**
 * Get current git branch name
 */
export async function getCurrentBranch(): Promise<string | undefined> {
  try {
    const result = await $`git rev-parse --abbrev-ref HEAD`.quiet();
    if (result.exitCode === 0) {
      return result.text().trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get repository info from git remote.
 * Checks if in a git repo, gets the origin URL, and parses it.
 * Returns null if not in a git repo or not a Bitbucket remote.
 */
export async function getRepoFromGit(): Promise<RepoInfo | null> {
  // Check if we're in a git repo
  if (!(await isGitRepo())) {
    return null;
  }

  // Get the origin URL
  const url = await getOriginUrl();
  if (!url) {
    return null;
  }

  // Parse the URL
  return parseRemoteUrl(url);
}
