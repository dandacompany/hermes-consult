export async function verifyChallenge(
  secret: string,
  token: unknown,
  hostname: string,
  site: string,
  request: typeof fetch = fetch,
): Promise<boolean> {
  if (!secret || typeof token !== "string" || !token || token.length > 2048)
    return false;
  try {
    const response = await request(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, response: token }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return false;
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
      cdata?: string;
    };
    return (
      result.success === true &&
      result.hostname === hostname &&
      result.action === "consult" &&
      result.cdata === site
    );
  } catch {
    return false;
  }
}
