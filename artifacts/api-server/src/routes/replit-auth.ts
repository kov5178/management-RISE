import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const ISSUER_URL = process.env["ISSUER_URL"] ?? "https://replit.com/oidc";
const OIDC_COOKIE_TTL = 10 * 60 * 1000; // 10 minutes
let oidcConfig: oidc.Configuration | null = null;

async function getOidcConfig(): Promise<oidc.Configuration> {
  if (!oidcConfig) {
    oidcConfig = await oidc.discovery(new URL(ISSUER_URL), process.env["REPL_ID"]!);
  }
  return oidcConfig;
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  return `${proto}://${host}`;
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function clearOidcCookies(res: Response) {
  for (const name of ["oidc_code_verifier", "oidc_nonce", "oidc_state", "oidc_return_to"]) {
    res.clearCookie(name, { path: "/" });
  }
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

const router: IRouter = Router();

// GET /api/login — OIDC redirect (web flow)
router.get("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/callback`;
    const returnTo = getSafeReturnTo(req.query["returnTo"]);

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const redirectUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });

    setOidcCookie(res, "oidc_code_verifier", codeVerifier);
    setOidcCookie(res, "oidc_nonce", nonce);
    setOidcCookie(res, "oidc_state", state);
    setOidcCookie(res, "oidc_return_to", returnTo);

    res.redirect(redirectUrl.href);
  } catch {
    res.redirect("/login?error=sso_failed");
  }
});

// GET /api/callback — OIDC callback, sets express-session like normal login
router.get("/callback", async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/callback`;

    const codeVerifier = req.cookies?.["oidc_code_verifier"];
    const nonce = req.cookies?.["oidc_nonce"];
    const expectedState = req.cookies?.["oidc_state"];
    const returnTo = getSafeReturnTo(req.cookies?.["oidc_return_to"]);

    clearOidcCookies(res);

    if (!codeVerifier || !expectedState) {
      res.redirect("/login?error=sso_failed");
      return;
    }

    const currentUrl = new URL(
      `${callbackUrl}?${new URL(req.url, `http://${req.headers["host"]}`).searchParams}`,
    );

    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims) {
      res.redirect("/login?error=sso_failed");
      return;
    }

    const email = claims["email"] as string | undefined;
    if (!email) {
      res.redirect("/login?error=sso_no_email");
      return;
    }

    // Look up user in our users table by email
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

    if (!user) {
      res.redirect("/login?error=sso_not_registered");
      return;
    }

    const validStatuses = ["active"];
    if (!validStatuses.includes(user.status)) {
      const errorCode =
        user.status === "pending"
          ? "sso_pending"
          : user.status === "locked"
            ? "sso_locked"
            : "sso_inactive";
      res.redirect(`/login?error=${errorCode}`);
      return;
    }

    // Set express-session exactly like the regular login
    await db
      .update(usersTable)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    req.session.userId = user.id;
    req.session.employeeNo = user.employeeNo;
    req.session.name = user.name;
    req.session.role = user.role;
    req.session.status = user.status;

    if (user.mustChangePassword) {
      res.redirect("/change-password");
    } else {
      res.redirect(returnTo);
    }
  } catch {
    clearOidcCookies(res);
    res.redirect("/login?error=sso_failed");
  }
});

// GET /api/sso-logout — destroy session and redirect to OIDC end-session
router.get("/sso-logout", async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await getOidcConfig();
    const origin = getOrigin(req);

    req.session.destroy(() => {});

    const endSessionUrl = oidc.buildEndSessionUrl(config, {
      client_id: process.env["REPL_ID"]!,
      post_logout_redirect_uri: origin,
    });
    res.redirect(endSessionUrl.href);
  } catch {
    req.session.destroy(() => {});
    res.redirect("/");
  }
});

export default router;
