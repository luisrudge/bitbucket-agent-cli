// API command: raw API access to Bitbucket
import { ApiClient, AuthError, NotFoundError, ForbiddenError } from "../api/client.ts";
import { getAuth } from "../config.ts";
import { outputError } from "../output.ts";

/**
 * Raw API access command
 */
export async function api(endpoint: string): Promise<void> {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // Get auth credentials
  const auth = await getAuth();
  if (!auth) {
    outputError(
      "Authentication required. Run 'bitbucket-agent-cli auth login' or set BB_USERNAME and BB_API_TOKEN environment variables.",
      2,
    );
  }

  const client = new ApiClient(auth.username, auth.apiToken);

  try {
    const response = await client.get<unknown>(normalizedEndpoint);
    console.log(JSON.stringify(response, null, 2));
    process.exit(0);
  } catch (error) {
    if (error instanceof AuthError) {
      outputError(`Authentication failed: ${error.message}`, 2);
    }
    if (error instanceof NotFoundError) {
      outputError(`Not found: ${error.message}`, 3);
    }
    if (error instanceof ForbiddenError) {
      outputError(`Access forbidden: ${error.message}`, 3);
    }
    const message = error instanceof Error ? error.message : String(error);
    outputError(`API request failed: ${message}`, 1);
  }
}
