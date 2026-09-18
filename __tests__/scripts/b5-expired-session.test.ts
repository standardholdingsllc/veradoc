import { describe, expect, it } from "vitest";
import {
  decodeSessionCookie,
  evaluateRefreshEvidence,
  parseCredentialTable,
  sanitizeText,
  sanitizeUrl,
} from "@/scripts/b5-expired-session.mjs";

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("B5 expired-but-refreshable acceptance script", () => {
  it("parses a selected QA row without exposing adjacent credentials", () => {
    const row = parseCredentialTable(
      [
        "| Label | Email | Password | Trusted role | Trusted status | Canonical login |",
        "| --- | --- | --- | --- | --- | --- |",
        "| qa-active-realtor | qa@example.test | secret | realtor | active | app.veradoc.pe |",
      ].join("\n"),
      "qa-active-realtor",
    );
    expect(row).toEqual({
      email: "qa@example.test",
      password: "secret",
      role: "realtor",
      status: "active",
      canonicalLogin: "app.veradoc.pe",
    });
  });

  it("decodes a chunked Supabase SSR session", () => {
    const accessToken = `${base64UrlJson({ alg: "RS256" })}.${base64UrlJson({ exp: 42, sub: "user" })}.signature`;
    const encoded = `base64-${Buffer.from(
      JSON.stringify({ access_token: accessToken, refresh_token: "refresh" }),
      "utf8",
    ).toString("base64url")}`;
    const midpoint = Math.ceil(encoded.length / 2);
    const decoded = decodeSessionCookie([
      { name: "sb-project-auth-token.0", value: encoded.slice(0, midpoint) },
      { name: "sb-project-auth-token.1", value: encoded.slice(midpoint) },
    ]);
    expect(decoded.jwt).toMatchObject({ exp: 42, sub: "user" });
    expect(decoded.authCookies).toHaveLength(2);
  });

  it("passes only when every refresh, routing, role, cookie, and browser check passes", () => {
    const evidence = {
      fixtureProvenance: "server-issued-unmodified",
      expiredBeforeRequest: true,
      expectedOrigin: "https://app.veradoc.pe",
      finalOrigin: "https://app.veradoc.pe",
      allDocumentOriginsSameHost: true,
      finalPath: "/agente",
      finalHttpStatus: 200,
      heading: "Panel del agente inmobiliario",
      accessTokenRotated: true,
      refreshTokenRotated: true,
      refreshedAccessExpiresAtEpoch: 10_000,
      refreshCompletedAtEpoch: 9_000,
      identityPreserved: true,
      cookieAttributes: [
        { secure: true, sameSite: "Lax", domain: "app.veradoc.pe" },
      ],
      crossHostAuthCookieCount: 0,
      wrongRoleAttemptFinalPath: "/agente",
      wrongRoleAttemptFinalOrigin: "https://app.veradoc.pe",
      redirectLoopDetected: false,
      pageErrors: [],
      requestFailures: [],
      http5xx: [],
    };
    expect(evaluateRefreshEvidence(evidence)).toMatchObject({ status: "PASS", failedChecks: [] });
    expect(
      evaluateRefreshEvidence({ ...evidence, refreshTokenRotated: false }),
    ).toMatchObject({ status: "FAIL", failedChecks: ["refreshTokenRotated"] });
    expect(
      evaluateRefreshEvidence({
        ...evidence,
        requestFailures: [
          {
            method: "GET",
            route: "https://app.veradoc.pe/agente",
            error: "net::ERR_ABORTED",
          },
        ],
      }),
    ).toMatchObject({ status: "PASS", failedChecks: [] });
  });

  it("sanitizes tokens, credentials, and query values", () => {
    expect(sanitizeUrl("https://app.veradoc.pe/agente?code=secret")).toBe(
      "https://app.veradoc.pe/agente",
    );
    expect(sanitizeText("email qa@example.test access_token=eyJx.e30.sig")).toBe(
      "email [email-redacted] access_token=[redacted]",
    );
  });
});
