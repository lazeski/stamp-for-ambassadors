import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SALE_HOSTS = new Set(["codingretreats.com", "www.codingretreats.com"]);

const SALE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>codingretreats.com is for sale</title>
  <meta name="description" content="The domain codingretreats.com is for sale.">
  <meta name="robots" content="index, follow">
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f4f1ea;
      color: #1c1b19;
      font-family: Georgia, "Iowan Old Style", Palatino, serif;
    }
    main { width: min(36rem, calc(100% - 3rem)); padding: 3rem 0; }
    .label {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.75rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0.6rem 0 1rem;
      font-weight: 500;
      font-size: clamp(2.6rem, 7vw, 4.4rem);
      line-height: 1.02;
      letter-spacing: -0.03em;
    }
    p { margin: 0; font-size: 1.2rem; line-height: 1.5; }
    a { color: inherit; }
  </style>
</head>
<body>
  <main>
    <p class="label">codingretreats.com</p>
    <h1>This domain is for sale.</h1>
    <p>Write to <a href="mailto:info@codingretreats.com">info@codingretreats.com</a>.</p>
  </main>
</body>
</html>
`;

export function middleware(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const hostname = forwarded.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  if (!hostname || !SALE_HOSTS.has(hostname)) return NextResponse.next();
  return new NextResponse(SALE_PAGE, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
