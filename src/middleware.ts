import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root to default platform
  if (pathname === "/" || pathname === "") {
    return NextResponse.redirect(new URL("/evalley/leads", request.url));
  }

  const segments = pathname.split("/").filter(Boolean);
  const slug = segments[0];

  // Valid slug pattern
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.next();
  }

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

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
