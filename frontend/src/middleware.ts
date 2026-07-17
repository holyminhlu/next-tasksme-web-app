import { NextResponse } from "next/server";

// The refresh token cookie is HttpOnly and scoped to the backend path
// (/api/v1/auth), so it is never visible to the Next.js server. Auth
// gating therefore happens client-side in AuthGate; the middleware is a
// pass-through kept for future server-side concerns (e.g. locale).
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
