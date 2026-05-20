// tsdav is used in caldav-adapter; webdav-sync uses the /api/webdav proxy instead
import type { BackupData } from "./types";

export interface WebDAVCredentials {
  serverUrl: string; // Base WebDAV URL (e.g., https://dav.example.com/remote.php/dav/files/user)
  username: string;
  password: string;
}

export interface WebDAVResult {
  success: boolean;
  error?: string;
  isCorsError?: boolean;
}

const BACKUP_FILENAME = "kanso-backup.json";

/**
 * Builds a proxied URL so all WebDAV requests are sent to the Next.js API
 * route, which forwards them server-side. This avoids CORS entirely — the
 * user's WebDAV server never needs to be configured for our domain.
 *
 * The actual server URL is forwarded as the X-WebDAV-URL header.
 */
function buildProxyUrl(serverUrl: string, path: string = ""): string {
  const cleanPath = path.replace(/^\//, "");
  return cleanPath ? `/api/webdav/${cleanPath}` : `/api/webdav/`;
}

function buildProxyHeaders(
  credentials: WebDAVCredentials,
): Record<string, string> {
  return {
    "X-WebDAV-URL": credentials.serverUrl,
    Authorization: `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`,
  };
}

/**
 * Test WebDAV connection with provided credentials.
 * Routes through the /api/webdav proxy — credentials only travel between
 * the browser and the Next.js server (same origin), never directly to
 * third-party servers via the browser. Credentials are NOT stored server-side.
 *
 * Uses OPTIONS (universally supported by WebDAV servers) rather than PROPFIND
 * because Next.js App Router only supports standard HTTP method exports.
 */
export async function testWebDavConnection(
  credentials: WebDAVCredentials,
): Promise<WebDAVResult> {
  try {
    const response = await fetch(buildProxyUrl(credentials.serverUrl), {
      method: "OPTIONS",
      headers: buildProxyHeaders(credentials),
    });

    // Any non-error response from the server means it is reachable and
    // credentials were accepted (WebDAV servers reject bad creds on OPTIONS too).
    if (response.ok || response.status === 204 || response.status === 200) {
      return { success: true };
    }
    if (response.status === 401) {
      return { success: false, error: "Invalid username or password" };
    }
    return { success: false, error: `Server returned ${response.status}` };
  } catch (error: unknown) {
    return handleWebDAVError(error);
  }
}

/**
 * Upload backup JSON to WebDAV server via the server-side proxy.
 */
export async function uploadWebDavBackup(
  credentials: WebDAVCredentials,
  jsonData: string,
  filename: string = BACKUP_FILENAME,
): Promise<WebDAVResult> {
  try {
    const response = await fetch(
      buildProxyUrl(credentials.serverUrl, filename),
      {
        method: "PUT",
        headers: {
          ...buildProxyHeaders(credentials),
          "Content-Type": "application/json",
        },
        body: jsonData,
      },
    );

    if (response.ok || response.status === 201 || response.status === 204) {
      return { success: true };
    }
    if (response.status === 401) {
      return { success: false, error: "Invalid username or password" };
    }
    return { success: false, error: `Server returned ${response.status}` };
  } catch (error: unknown) {
    return handleWebDAVError(error);
  }
}

/**
 * Download backup JSON from WebDAV server via the server-side proxy.
 */
export async function downloadWebDavBackup(
  credentials: WebDAVCredentials,
  filename: string = BACKUP_FILENAME,
): Promise<{
  success: boolean;
  data?: BackupData;
  error?: string;
  isCorsError?: boolean;
}> {
  try {
    const response = await fetch(
      buildProxyUrl(credentials.serverUrl, filename),
      {
        method: "GET",
        headers: {
          ...buildProxyHeaders(credentials),
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "No backup found on server" };
      }
      if (response.status === 401) {
        return { success: false, error: "Invalid username or password" };
      }
      return { success: false, error: `Server returned ${response.status}` };
    }

    const data = (await response.json()) as BackupData;

    // Basic validation
    if (!data.metadata?.version) {
      return { success: false, error: "Invalid backup format" };
    }

    return { success: true, data };
  } catch (error: unknown) {
    const result = handleWebDAVError(error);
    return { ...result, data: undefined };
  }
}

/**
 * Handle WebDAV errors with CORS detection
 * Per RESEARCH.md pitfall: Most self-hosted servers don't send CORS headers by default
 */
function handleWebDAVError(error: unknown): WebDAVResult {
  const message = error instanceof Error ? error.message : String(error);

  // Detect CORS errors (browser-specific messages)
  const isCorsError =
    message.includes("CORS") ||
    message.includes("NetworkError") ||
    message.includes("Failed to fetch") ||
    message.includes("Load failed");

  if (isCorsError) {
    return {
      success: false,
      isCorsError: true,
      error:
        "CORS blocked. Your WebDAV server needs to allow cross-origin requests. " +
        "Check your server's CORS configuration (Nextcloud: enable the 'CORS' app).",
    };
  }

  // Auth errors
  if (message.includes("401") || message.includes("Unauthorized")) {
    return {
      success: false,
      error: "Invalid username or password",
    };
  }

  return {
    success: false,
    error: message,
  };
}
