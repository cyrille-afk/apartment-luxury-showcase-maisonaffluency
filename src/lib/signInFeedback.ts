export function signInErrorMessage(error: { code?: string; status?: number } | null): string {
  if (error?.status === 429 || error?.code === "over_request_rate_limit") return "Please wait a moment before trying to sign in again.";
  if (error?.code === "email_not_confirmed") return "Please confirm your email using the link in your inbox, then sign in again.";
  if (error?.status && error.status >= 500) return "We can’t reach your account right now. Please try again shortly.";
  return "We couldn’t sign you in. Check your email and password, then try again.";
}