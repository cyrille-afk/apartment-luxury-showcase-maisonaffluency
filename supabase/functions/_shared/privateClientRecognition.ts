type Store = {
  request: (email: string, ip: string) => Promise<{ id: string; code: string } | null>;
  verify: (id: string, email: string, code: string) => Promise<boolean>;
  activity: (email: string, session: string | null) => Promise<boolean>;
  send: (email: string, id: string, code: string) => Promise<void>;
};

/** Only verified email ownership permits an activity lookup. Requests never look up customers. */
export async function recognizePrivateClient(
  body: { action: string; email: string; challengeId?: string; code?: string; sessionId?: string },
  verifiedEmail: string | null,
  ipHash: string,
  store: Store,
) {
  const email = body.email.trim().toLowerCase();
  const session = body.sessionId ?? null;
  if (body.action === "check") {
    if (verifiedEmail?.trim().toLowerCase() !== email) return { status: 401, body: { error: "Verify your email to continue." } };
    return { status: 200, body: { verified: true, returning: await store.activity(email, session) } };
  }
  if (body.action === "request") {
    const challenge = await store.request(email, ipHash);
    if (!challenge) return { status: 429, body: { error: "Please wait before requesting another code." } };
    await store.send(email, challenge.id, challenge.code);
    return { status: 200, body: { ok: true, challengeId: challenge.id } };
  }
  if (!body.challengeId || !body.code || !await store.verify(body.challengeId, email, body.code)) {
    return { status: 403, body: { error: "That code is incorrect or has expired." } };
  }
  return { status: 200, body: { verified: true, returning: await store.activity(email, session) } };
}