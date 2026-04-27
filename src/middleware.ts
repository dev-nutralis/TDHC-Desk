import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "tdhc_session";
const LOGIN_PATH = "/login";

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback-dev-secret");
}

async function getSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: payload.userId as string,
      role: payload.role as "super_admin" | "admin",
      platformIds: payload.platformIds as string[],
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow login page and static assets
  if (pathname.startsWith(LOGIN_PATH)) {
    return NextResponse.next();
  }

  // Redirect root → first platform (middleware will handle auth on next request)
  if (pathname === "/" || pathname === "") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await getSession(request);

  // No session → redirect to login
  if (!session) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const segments = pathname.split("/").filter(Boolean);
  const slug = segments[0];

  // Check platform access for regular admins
  if (
    session.role === "admin" &&
    slug &&
    /^[a-z0-9-]+$/.test(slug) &&
    !session.platformIds.includes(slug) // we'll store slugs in token
  ) {
    // Redirect to first allowed platform or login
    const firstPlatformSlug = session.platformIds[0];
    if (firstPlatformSlug) {
      return NextResponse.redirect(new URL(`/${firstPlatformSlug}/leads`, request.url));
    }
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  // Set platform slug cookie and header for downstream use
  if (slug && /^[a-z0-9-]+$/.test(slug)) {
    const response = NextResponse.next({
      request: {
        headers: new Headers({
          ...Object.fromEntries(request.headers),
          "x-platform-slug": slug,
        }),
      },
    });
    response.cookies.set("x-platform-slug", slug, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
