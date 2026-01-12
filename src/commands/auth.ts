// Auth commands: login, status, logout
import { ApiClient, AuthError } from "../api/client.ts";
import { setAuthInKeychain, deleteAuthFromKeychain, getAuthSource, getAuth } from "../config.ts";
import { output, outputError } from "../output.ts";

/**
 * User info returned from /user endpoint
 */
interface UserInfo {
  display_name: string;
  username: string;
  uuid: string;
}

/**
 * Login options from Commander
 */
interface LoginOptions {
  username: string;
  appPassword: string;
}

/**
 * Login subcommand: validate and save credentials to OS keychain
 */
export async function login(options: LoginOptions): Promise<void> {
  const { username, appPassword } = options;

  // Validate credentials by calling GET /user
  const client = new ApiClient(username, appPassword);

  try {
    const user = await client.get<UserInfo>("/user");

    // Save to OS keychain
    await setAuthInKeychain(username, appPassword);

    output(`Logged in as ${user.username}`, { success: true, user: user.username });
    process.exit(0);
  } catch (error) {
    if (error instanceof AuthError) {
      outputError("Invalid credentials: authentication failed", 2);
    }
    const message = error instanceof Error ? error.message : String(error);
    outputError(`Login failed: ${message}`, 2);
  }
}

/**
 * Status subcommand: check current authentication status
 */
export async function status(): Promise<void> {
  const source = await getAuthSource();

  if (source) {
    const auth = await getAuth();
    output(`Authenticated as ${auth?.username} (source: ${source})`, {
      authenticated: true,
      username: auth?.username,
      source,
    });
    process.exit(0);
  }

  output("Not authenticated", { authenticated: false });
  process.exit(0);
}

/**
 * Logout subcommand: remove stored credentials from OS keychain
 */
export async function logout(): Promise<void> {
  await deleteAuthFromKeychain();
  output("Logged out successfully", { success: true });
  process.exit(0);
}
