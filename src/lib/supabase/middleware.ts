import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // 🚀 Performance: Check for guest mode cookie FIRST to avoid unnecessary Supabase calls.
  const isGuest = request.cookies.get("kanso_guest_mode")?.value === "true";
  if (isGuest) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isPublicRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/access-denied" ||
    request.nextUrl.pathname.startsWith("/auth/");

  // Handle auth errors (e.g., "Refresh Token Not Found")
  // Only redirect to login if NOT already on a public route
  if (error && !isPublicRoute && !isGuest) {
    // 🛡️ Network Resilience: If offline, don't redirect to login.
    // Redirecting while offline creates an infinite loop.
    const isNetworkError =
      error.message?.toLowerCase().includes("fetch") ||
      error.status === 0 ||
      !error.status;

    if (isNetworkError) {
      return supabaseResponse;
    }

    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user && !isPublicRoute && !isGuest) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}
