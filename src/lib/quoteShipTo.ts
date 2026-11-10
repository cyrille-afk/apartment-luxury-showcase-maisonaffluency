import type { WorkspaceClientProfile } from "@/contexts/ProjectWorkspaceContext";

export function quoteShipToFromClient(checked: boolean, profile?: WorkspaceClientProfile | null) {
  const address = checked ? profile?.corporateAddress : undefined;
  return {
    name: checked ? profile?.companyName?.trim() || profile?.clientName?.trim() || "" : "",
    attention: checked ? profile?.clientName?.trim() || "" : "",
    address1: address?.line1 || "", address2: address?.line2 || "",
    city: address?.city || "", state: address?.region || "",
    postal_code: address?.postalCode || "", country: address?.country || "",
    phone: checked ? profile?.phone || "" : "",
    email: checked ? profile?.email || "" : "", notes: "",
  };
}