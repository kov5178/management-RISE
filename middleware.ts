import { NextRequest, NextResponse } from "next/server";
import {
  getSessionFromRequest,
  hasAnyRole,
  hasOnlyRegisteredUserRole
} from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/login", "/register"];
const REGISTERED_USER_ALLOWED_PATHS = [
  "/dashboard",
  "/api/dashboard",
  "/account",
  "/auth/change-password",
  "/api/account",
  "/api/auth/change-password",
  "/api/auth/logout"
];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/register")
  );
}

function isRegisteredUserAllowedPath(pathname: string) {
  return REGISTERED_USER_ALLOWED_PATHS.some(
    (allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (session.mustChangePassword && pathname !== "/auth/change-password") {
    return NextResponse.redirect(new URL("/auth/change-password", request.url));
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!hasAnyRole(session, ["SUPER_ADMIN", "ADMIN"])) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (hasOnlyRegisteredUserRole(session) && !isRegisteredUserAllowedPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
