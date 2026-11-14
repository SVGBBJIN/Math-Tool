import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const GUEST_PREFIX = "/guest";
const GUEST_COOKIE = "amc_guest";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Guest mode keeps everything in the browser: no session, so don't touch Supabase at all.
  if (path === GUEST_PREFIX || path.startsWith(`${GUEST_PREFIX}/`)) return NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Without Supabase config (e.g. env vars missing on the host) the middleware must not throw,
  // or the whole site shows "Routing Middleware ... failed". Fall back to guest mode.
  if (!supabaseUrl || !supabaseKey) {
    if (PUBLIC_PATHS.some((p) => path.startsWith(p))) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = GUEST_PREFIX;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    // Supabase unreachable: treat as signed out rather than crashing the middleware.
  }

  if (!user && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    // A returning guest goes straight back to guest mode instead of hitting the sign-in screen.
    url.pathname = request.cookies.get(GUEST_COOKIE)?.value === "1" ? GUEST_PREFIX : "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Skip static assets and API routes (webhooks/cron authenticate themselves).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
