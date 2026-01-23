// Auth credential management via Bun.secrets

/** Service name for Bun.secrets keychain storage */
const KEYCHAIN_SERVICE = "io.bitbucket.cli";

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  username: string;
  apiToken: string;
}

/**
 * Store credentials in the OS keychain via Bun.secrets
 */
export async function setAuthInKeychain(username: string, apiToken: string): Promise<void> {
  await Bun.secrets.set({ service: KEYCHAIN_SERVICE, name: "username", value: username });
  await Bun.secrets.set({ service: KEYCHAIN_SERVICE, name: "api_token", value: apiToken });
}

/**
 * Get credentials from the OS keychain via Bun.secrets
 */
export async function getAuthFromKeychain(): Promise<AuthCredentials | null> {
  const username = await Bun.secrets.get({ service: KEYCHAIN_SERVICE, name: "username" });
  // Try new key first, fall back to legacy key for existing installations
  let apiToken = await Bun.secrets.get({ service: KEYCHAIN_SERVICE, name: "api_token" });
  if (!apiToken) {
    apiToken = await Bun.secrets.get({ service: KEYCHAIN_SERVICE, name: "app_password" });
  }

  if (username && apiToken) {
    return { username, apiToken };
  }

  return null;
}

/**
 * Delete credentials from the OS keychain
 */
export async function deleteAuthFromKeychain(): Promise<void> {
  await Bun.secrets.delete({ service: KEYCHAIN_SERVICE, name: "username" });
  await Bun.secrets.delete({ service: KEYCHAIN_SERVICE, name: "api_token" });
  // Also delete legacy key if it exists
  await Bun.secrets.delete({ service: KEYCHAIN_SERVICE, name: "app_password" });
}

/**
 * Get authentication credentials.
 * Resolution order:
 * 1. BB_USERNAME and BB_API_TOKEN environment variables (highest priority)
 * 2. BB_USERNAME and BB_APP_PASSWORD environment variables (legacy fallback)
 * 3. OS keychain via Bun.secrets
 * 4. Returns null if no auth found
 */
export async function getAuth(): Promise<AuthCredentials | null> {
  const envUsername = process.env["BB_USERNAME"];
  // Try new env var first, fall back to legacy
  const envToken = process.env["BB_API_TOKEN"] ?? process.env["BB_APP_PASSWORD"];

  if (envUsername && envToken) {
    return {
      username: envUsername,
      apiToken: envToken,
    };
  }

  return getAuthFromKeychain();
}

/**
 * Check where auth is configured (for status command)
 */
export async function getAuthSource(): Promise<"env" | "keychain" | null> {
  const envUsername = process.env["BB_USERNAME"];
  const envToken = process.env["BB_API_TOKEN"] ?? process.env["BB_APP_PASSWORD"];

  if (envUsername && envToken) {
    return "env";
  }

  const keychainAuth = await getAuthFromKeychain();
  if (keychainAuth) {
    return "keychain";
  }

  return null;
}
