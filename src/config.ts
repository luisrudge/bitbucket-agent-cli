// Auth credential management via Bun.secrets

/** Service name for Bun.secrets keychain storage */
const KEYCHAIN_SERVICE = "io.bitbucket.cli";

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  username: string;
  appPassword: string;
}

/**
 * Store credentials in the OS keychain via Bun.secrets
 */
export async function setAuthInKeychain(username: string, appPassword: string): Promise<void> {
  await Bun.secrets.set({ service: KEYCHAIN_SERVICE, name: "username", value: username });
  await Bun.secrets.set({ service: KEYCHAIN_SERVICE, name: "app_password", value: appPassword });
}

/**
 * Get credentials from the OS keychain via Bun.secrets
 */
export async function getAuthFromKeychain(): Promise<AuthCredentials | null> {
  const username = await Bun.secrets.get({ service: KEYCHAIN_SERVICE, name: "username" });
  const appPassword = await Bun.secrets.get({ service: KEYCHAIN_SERVICE, name: "app_password" });

  if (username && appPassword) {
    return { username, appPassword };
  }

  return null;
}

/**
 * Delete credentials from the OS keychain
 */
export async function deleteAuthFromKeychain(): Promise<void> {
  await Bun.secrets.delete({ service: KEYCHAIN_SERVICE, name: "username" });
  await Bun.secrets.delete({ service: KEYCHAIN_SERVICE, name: "app_password" });
}

/**
 * Get authentication credentials.
 * Resolution order:
 * 1. BB_USERNAME and BB_APP_PASSWORD environment variables (highest priority)
 * 2. OS keychain via Bun.secrets
 * 3. Returns null if no auth found
 */
export async function getAuth(): Promise<AuthCredentials | null> {
  const envUsername = process.env["BB_USERNAME"];
  const envPassword = process.env["BB_APP_PASSWORD"];

  if (envUsername && envPassword) {
    return {
      username: envUsername,
      appPassword: envPassword,
    };
  }

  return getAuthFromKeychain();
}

/**
 * Check where auth is configured (for status command)
 */
export async function getAuthSource(): Promise<"env" | "keychain" | null> {
  const envUsername = process.env["BB_USERNAME"];
  const envPassword = process.env["BB_APP_PASSWORD"];

  if (envUsername && envPassword) {
    return "env";
  }

  const keychainAuth = await getAuthFromKeychain();
  if (keychainAuth) {
    return "keychain";
  }

  return null;
}
