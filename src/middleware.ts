import { NextResponse, type NextRequest } from "next/server";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return new NextResponse("Admin credentials are not configured", {
      status: 500,
    });
  }

  const header = req.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("basic ")) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return unauthorized();
  }

  const idx = decoded.indexOf(":");
  if (idx < 0) return unauthorized();

  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(pass, expectedPass)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
