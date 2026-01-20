// TypeScript interfaces for Bitbucket API responses

/**
 * Bitbucket user information
 */
export interface User {
  display_name: string;
  uuid: string;
  nickname: string;
}

/**
 * Git branch/reference information
 */
export interface BranchRef {
  branch: {
    name: string;
  };
  repository: {
    full_name: string;
  };
  commit: {
    hash: string;
  };
}

/**
 * Pull request author (subset of User)
 */
export interface Author {
  display_name: string;
  uuid: string;
  nickname: string;
}

/**
 * Pull request reviewer with approval status
 */
export interface Reviewer {
  user: User;
  approved: boolean;
}

/**
 * Pull request information
 */
export interface PullRequest {
  id: number;
  title: string;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
  author: Author;
  source: BranchRef;
  destination: BranchRef;
  created_on: string;
  updated_on: string;
  comment_count?: number;
  task_count?: number;
  links?: {
    html?: {
      href: string;
    };
  };
  reviewers?: Reviewer[];
}

/**
 * Inline comment location in a file
 */
export interface InlineComment {
  path: string;
  from: number | null;
  to: number | null;
}

/**
 * Comment content with markup
 */
export interface CommentContent {
  raw: string;
  markup: string;
  html: string;
}

/**
 * Parent comment reference for threading
 */
export interface ParentComment {
  id: number;
}

/**
 * Comment resolution status
 */
export interface CommentResolution {
  type: string;
}

/**
 * Pull request comment
 */
export interface Comment {
  id: number;
  content: CommentContent;
  user: User;
  created_on: string;
  updated_on?: string;
  inline?: InlineComment;
  parent?: ParentComment;
  resolution?: CommentResolution;
  deleted?: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  values: T[];
  page: number;
  pagelen: number;
  next?: string;
  size?: number;
}

/**
 * Repository information
 */
export interface Repository {
  full_name: string;
  name: string;
  mainbranch?: {
    name: string;
    type: string;
  };
}

/**
 * Request body for creating a pull request
 */
export interface CreatePullRequestBody {
  title: string;
  source: {
    branch: {
      name: string;
    };
  };
  destination?: {
    branch: {
      name: string;
    };
  };
  description?: string;
  close_source_branch?: boolean;
}

/**
 * Request body for creating a comment on a pull request
 */
export interface CreateCommentBody {
  content: {
    raw: string;
  };
  parent?: {
    id: number;
  };
}

/**
 * Task state
 */
export type TaskState = "UNRESOLVED" | "RESOLVED";

/**
 * Pull request task
 */
export interface Task {
  id: number;
  state: TaskState;
  content: CommentContent;
  created_on: string;
  updated_on: string;
  resolved_on: string | null;
  resolved_by: User | null;
  creator: User;
  comment?: {
    id: number;
  };
}
