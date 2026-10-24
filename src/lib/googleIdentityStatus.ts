export type GoogleIdentityStatus =
  | { kind: "matched"; googleEmail: string }
  | { kind: "mismatch"; googleEmail: string; accountEmail: string }
  | { kind: "not_linked"; accountEmail: string }
  | { kind: "unverified"; accountEmail: string };

interface IdentityLike {
  provider?: string;
  identity_data?: Record<string, unknown> | null;
  email?: string | null;
}

interface UserLike {
  email?: string | null;
  email_confirmed_at?: string | null;
  identities?: IdentityLike[] | null;
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

export function getGoogleIdentityStatus(user: UserLike): GoogleIdentityStatus {
  const accountEmail = norm(user.email);
  const google = (user.identities ?? []).find((i) => i.provider === "google");
  if (google) {
    const googleEmail = norm(google.identity_data?.email ?? google.email);
    if (googleEmail && googleEmail === accountEmail) return { kind: "matched", googleEmail };
    return { kind: "mismatch", googleEmail, accountEmail };
  }
  if (!user.email_confirmed_at) return { kind: "unverified", accountEmail };
  return { kind: "not_linked", accountEmail };
}
