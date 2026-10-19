import { describe, expect, it, vi } from "vitest";
import { recognizePrivateClient } from "../../supabase/functions/_shared/privateClientRecognition";

function store(returning = true) {
  return {request:vi.fn(async()=>({id:"challenge",code:"123456"})),verify:vi.fn(async()=>true),activity:vi.fn(async()=>returning),send:vi.fn(async()=>{}),forget:vi.fn(async()=>{}),optin:vi.fn(async()=>{})};
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
});describe("recognition opt-out",()=>{
  it("deletes data only after the code is verified, never revealing activity",async()=>{
    const s={...store(),forget:vi.fn(async()=>{})};
    s.verify.mockResolvedValueOnce(false);
    expect((await recognizePrivateClient({action:"verify",intent:"forget",email:"c@example.com",challengeId:"i",code:"111111"},null,"ip",s)).status).toBe(403);
    expect(s.forget).not.toHaveBeenCalled();
    const r=await recognizePrivateClient({action:"verify",intent:"forget",email:"C@example.com",challengeId:"i",code:"123456"},null,"ip",s);
    expect(r.body).toEqual({forgotten:true});
    expect(s.forget).toHaveBeenCalledWith("c@example.com");
    expect(s.activity).not.toHaveBeenCalled();
  });
  it("signed-in clients may forget only their own email",async()=>{
    const s={...store(),forget:vi.fn(async()=>{})};
    expect((await recognizePrivateClient({action:"check",intent:"forget",email:"c@example.com"},"other@example.com","ip",s)).status).toBe(401);
    expect(s.forget).not.toHaveBeenCalled();
  });
});describe("recognition opt-in",()=>{
  it("re-enables recognition for a signed-in client without a code or activity lookup",async()=>{
    const s=store();
    const r=await recognizePrivateClient({action:"check",intent:"optin",email:"C@example.com"},"c@example.com","ip",s);
    expect(r.body).toEqual({optedIn:true});
    expect(s.optin).toHaveBeenCalledWith("c@example.com");
    expect(s.activity).not.toHaveBeenCalled();
    expect(s.request).not.toHaveBeenCalled();
  });
  it("never opts in another account's email",async()=>{
    const s=store();
    expect((await recognizePrivateClient({action:"check",intent:"optin",email:"c@example.com"},"other@example.com","ip",s)).status).toBe(401);
    expect(s.optin).not.toHaveBeenCalled();
  });
  it("opts in only after the code is verified",async()=>{
    const s=store();s.verify.mockResolvedValueOnce(false);
    expect((await recognizePrivateClient({action:"verify",intent:"optin",email:"c@example.com",challengeId:"i",code:"111111"},null,"ip",s)).status).toBe(403);
    expect(s.optin).not.toHaveBeenCalled();
    const r=await recognizePrivateClient({action:"verify",intent:"optin",email:"c@example.com",challengeId:"i",code:"123456"},null,"ip",s);
    expect(r.body).toEqual({optedIn:true});
    expect(s.optin).toHaveBeenCalledWith("c@example.com");
    expect(s.activity).not.toHaveBeenCalled();
  });
});
