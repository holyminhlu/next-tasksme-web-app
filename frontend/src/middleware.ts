import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/session-expired",
  "/forbidden",
  "/terms",
  "/privacy",
];

const PROTECTED_PATHS = [
  "/dashboard",
  "/members",
  "/select-workspace",
  "/onboarding",
];

const REFRESH_COOKIE = "refreshToken";

function matchesPath(pathname: string, paths: string[]) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isPublicPath(pathname: string) {
  if (matchesPath(pathname, PUBLIC_PATHS)) {
    return true;
  }

  return pathname.startsWith("/invite");
}

function isProtectedPath(pathname: string) {
  return matchesPath(pathname, PROTECTED_PATHS);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasRefreshCookie = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!hasRefreshCookie && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "redirect",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
