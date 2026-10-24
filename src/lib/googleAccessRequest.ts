import { z } from "zod";

export const googleAccessRequestSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100, "Use 100 characters or fewer."),
  email: z.string().trim().email("Please enter a valid email address.").max(255).transform(value => value.toLowerCase()),
});

export function googleAccessInquiry(input: unknown) {
  const data = googleAccessRequestSchema.parse(input);
  return {
    ...data,
    source: "contact_form" as const,
    subject: "Google sign-in blocked — Trade access request",
    message: "I was blocked when signing in with Google. Please review my request for Trade access using this email address. This request does not grant Google sign-in or Trade approval.",
  };
}