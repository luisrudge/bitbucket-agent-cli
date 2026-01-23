// API client for Bitbucket REST API with basic auth

const BASE_URL = "https://api.bitbucket.org/2.0";

/**
 * Error thrown when authentication fails (401)
 */
export class AuthError extends Error {
  constructor(message = "Authentication failed") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Error thrown when a resource is not found (404)
 */
export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Error thrown when access is forbidden (403)
 */
export class ForbiddenError extends Error {
  constructor(message = "Access forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * API client for Bitbucket REST API
 */
export class ApiClient {
  private authHeader: string;

  /**
   * Create a new API client
   * @param username Bitbucket username
   * @param apiToken Bitbucket API token
   */
  constructor(username: string, apiToken: string) {
    // Create Basic auth header
    const credentials = `${username}:${apiToken}`;
    const encoded = Buffer.from(credentials).toString("base64");
    this.authHeader = `Basic ${encoded}`;
  }

  /**
   * Make a GET request and return parsed JSON
   * @param endpoint API endpoint path (e.g., /user or /repositories/ws/repo)
   * @returns Parsed JSON response
   * @throws AuthError for 401 responses
   * @throws NotFoundError for 404 responses
   * @throws ForbiddenError for 403 responses
   */
  async get<T = unknown>(endpoint: string): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: unknown = await response.json();
    return data as T;
  }

  /**
   * Make a GET request to a full URL (for pagination) and return parsed JSON
   * @param url Full URL to fetch (must be on api.bitbucket.org)
   * @returns Parsed JSON response
   * @throws AuthError for 401 responses
   * @throws NotFoundError for 404 responses
   * @throws ForbiddenError for 403 responses
   * @throws Error if URL is not on the allowed Bitbucket domain
   */
  async getFullUrl<T = unknown>(url: string): Promise<T> {
    // Validate URL is on the Bitbucket API domain to prevent SSRF
    const parsed = new URL(url);
    if (parsed.hostname !== "api.bitbucket.org") {
      throw new Error(`Invalid URL: requests must be to api.bitbucket.org, got ${parsed.hostname}`);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: unknown = await response.json();
    return data as T;
  }

  /**
   * Make a POST request with JSON body and return parsed JSON
   * @param endpoint API endpoint path
   * @param body Request body to send as JSON
   * @returns Parsed JSON response
   * @throws AuthError for 401 responses
   * @throws NotFoundError for 404 responses
   * @throws ForbiddenError for 403 responses
   */
  async post<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: unknown = await response.json();
    return data as T;
  }

  /**
   * Make a PUT request with JSON body and return parsed JSON
   * @param endpoint API endpoint path
   * @param body Request body to send as JSON
   * @returns Parsed JSON response
   * @throws AuthError for 401 responses
   * @throws NotFoundError for 404 responses
   * @throws ForbiddenError for 403 responses
   */
  async put<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: unknown = await response.json();
    return data as T;
  }

  /**
   * Make a DELETE request and return parsed JSON (or void for 204)
   * @param endpoint API endpoint path
   * @returns Parsed JSON response or undefined for 204
   * @throws AuthError for 401 responses
   * @throws NotFoundError for 404 responses
   * @throws ForbiddenError for 403 responses
   */
  async delete<T = unknown>(endpoint: string): Promise<T | undefined> {
    const url = `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    // 204 No Content or empty body returns nothing
    const contentLength = response.headers.get("content-length");
    if (response.status === 204 || contentLength === "0") {
      return undefined;
    }

    const text = await response.text();
    if (!text) {
      return undefined;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Make a GET request and return raw text (for diff endpoint)
   * @param endpoint API endpoint path
   * @returns Raw response text
   * @throws AuthError for 401 responses
   * @throws NotFoundError for 404 responses
   * @throws ForbiddenError for 403 responses
   */
  async getRaw(endpoint: string): Promise<string> {
    const url = `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.text();
  }

  /**
   * Handle error responses from the API
   * @param response The fetch Response object
   * @throws AuthError, NotFoundError, ForbiddenError, or generic Error
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let message: string;

    try {
      const errorBody: unknown = await response.json();
      if (typeof errorBody === "object" && errorBody !== null && "error" in errorBody) {
        const errorObj = errorBody as { error: { message?: string } };
        message = errorObj.error.message ?? response.statusText;
      } else {
        message = response.statusText;
      }
    } catch {
      message = response.statusText;
    }

    switch (response.status) {
      case 401:
        throw new AuthError(message);
      case 403:
        throw new ForbiddenError(message);
      case 404:
        throw new NotFoundError(message);
      default:
        throw new Error(`API error ${response.status}: ${message}`);
    }
  }
}
