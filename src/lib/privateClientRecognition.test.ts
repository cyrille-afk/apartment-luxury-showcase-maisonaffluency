import { describe, expect, it, vi } from "vitest";
import { recognizePrivateClient } from "../../supabase/functions/_shared/privateClientRecognition";

function store(returning = true) {
  return {request:vi.fn(async()=>({id:"challenge",code:"123456"})),verify:vi.fn(async()=>true),activity:vi.fn(async()=>returning),send:vi.fn(async()=>{})};
}
describe("verified cross-device recognition",()=>{
  it("never looks up customer activity while sending a code",async()=>{
    const s=store();
    const result=await recognizePrivateClient({action:"request",email:" CLIENT@example.com "},null,"ip",s);
    expect(result.body).toEqual({ok:true,challengeId:"challenge"});
    expect(s.activity).not.toHaveBeenCalled();
    expect(s.send).toHaveBeenCalledWith("client@example.com","challenge","123456");
  });
  it("rejects unauthenticated and other-account email lookups",async()=>{
    for (const email of [null,"other@example.com"]) {
      const s=store();
      expect((await recognizePrivateClient({action:"check",email:"client@example.com"},email,"ip",s)).status).toBe(401);
      expect(s.activity).not.toHaveBeenCalled();
    }
  });
  it("never reveals returning status for invalid or expired codes",async()=>{
    const s=store();s.verify.mockResolvedValue(false);
    expect((await recognizePrivateClient({action:"verify",email:"client@example.com",challengeId:"id",code:"123456"},null,"ip",s)).status).toBe(403);
    expect(s.activity).not.toHaveBeenCalled();
  });
  it("returns only verified returning status after code consumption",async()=>{
    const s=store();
    const result=await recognizePrivateClient({action:"verify",email:"client@example.com",challengeId:"id",code:"123456",sessionId:"current"},null,"ip",s);
    expect(result.body).toEqual({verified:true,returning:true});
    expect(s.activity).toHaveBeenCalledWith("client@example.com","current");
    expect(s.verify.mock.invocationCallOrder[0]).toBeLessThan(s.activity.mock.invocationCallOrder[0]);
  });
  it("allows verified matching email without changing the sign-in session",async()=>{
    const s=store(false);
    expect((await recognizePrivateClient({action:"check",email:"CLIENT@example.com"},"client@example.com","ip",s)).body).toEqual({verified:true,returning:false});
    expect(s.request).not.toHaveBeenCalled();
  });
});