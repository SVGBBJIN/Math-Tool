import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const GUEST_PREFIX = "/guest";
const GUEST_COOKIE = "amc_guest";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Guest mode keeps everything in the browser: no session, so don't touch Supabase at all.
  if (path === GUEST_PREFIX || path.startsWith(`${GUEST_PREFIX}/`)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
