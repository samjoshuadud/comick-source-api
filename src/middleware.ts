import { NextRequest, NextResponse } from "next/server";

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";
const NODE_ENV = process.env.NODE_ENV || "development";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (!INTERNAL_KEY) {
    return NextResponse.json(
      { error: "Server misconfiguration: INTERNAL_API_KEY not set" },
      { status: 500 },
    );
  }

  const incomingKey = request.headers.get("x-internal-api-key") || "";
  if (incomingKey !== INTERNAL_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

