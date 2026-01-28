/**
 * Client ID utility for rate limiting
 * Generates a unique ID per browser session
 */

let clientId: string | null = null;

/**
 * Get or generate a client ID for the current session
 * The ID persists for the duration of the browser session
 */
export function getClientId(): string {
  if (!clientId) {
    clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  return clientId;
}

/**
 * Reset the client ID (useful for testing)
 */
export function resetClientId(): void {
  clientId = null;
}
