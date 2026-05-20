import { type NextRequest, NextResponse } from "next/server";

/**
 * WebDAV Proxy Route
 *
 * Forwards all WebDAV method requests to the configured WebDAV server
 * from the server side, bypassing browser CORS restrictions.
 *
 * This is the correct architectural pattern: user-supplied WebDAV servers
 * (Nextcloud, Synology, etc.) will never set CORS headers for our domain.
 * Server-side proxying is the only robust solution.
 *
 * Usage: client sends requests to /api/webdav/<path>
 *  with headers:
 *    X-WebDAV-URL: <full base url of their webdav server>
 *    Authorization: Basic <base64 credentials>
 */

const ALLOWED_METHODS = [
  "GET",
  "PUT",
  "DELETE",
  "PROPFIND",
  "PROPPATCH",
  "MKCOL",
  "COPY",
  "MOVE",
  "OPTIONS",
  "REPORT",
  "HEAD",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyWebDAV(request, await params, "GET");
}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyWebDAV(request, await params, "PUT");
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyWebDAV(request, await params, "DELETE");
}
export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyWebDAV(request, await params, "OPTIONS");
}

/**
 * Handle WebDAV-specific methods (PROPFIND, MKCOL, etc.)
 * Next.js only allows standard HTTP methods as named exports. For everything else,
 * we catch them in the POST handler and check the actual method from the request.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const method = request.method;
  return proxyWebDAV(request, await params, method);
}

async function proxyWebDAV(
  request: NextRequest,
  params: { path?: string[] },
  method: string,
): Promise<NextResponse> {
  // Guard: only allow known WebDAV-safe methods
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  // The client passes the WebDAV server base URL via a custom header
  const webdavBaseUrl = request.headers.get("X-WebDAV-URL");
  if (!webdavBaseUrl) {
    return NextResponse.json(
      { error: "Missing X-WebDAV-URL header" },
      { status: 400 },
    );
  }

  // Reconstruct the target URL
  const path = params.path?.join("/") ?? "";
  const targetUrl = `${webdavBaseUrl.replace(/\/$/, "")}/${path}`;

  // Forward all headers except host-specific ones
  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "x-webdav-url" ||
      lower === "connection"
    ) {
      continue;
    }
    forwardHeaders.set(key, value);
  }

  // Forward the body (required for PUT, PROPFIND etc.)
  const body =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS"
      ? await request.arrayBuffer()
      : undefined;

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: body ?? null,
      // @ts-expect-error — Node 18+ fetch supports duplex
      duplex: "half",
    });

    const responseBody = await response.arrayBuffer();
    const responseHeaders = new Headers();

    // Forward response headers back to client
    for (const [key, value] of response.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower === "transfer-encoding") continue; // not valid in HTTP/2
      responseHeaders.set(key, value);
    }

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown proxy error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
