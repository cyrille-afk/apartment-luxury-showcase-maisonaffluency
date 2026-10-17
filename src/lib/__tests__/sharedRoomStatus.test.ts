import { describe, it, expect } from "vitest";
import { sharedRoomStatus } from "../sharedRoomStatus";
const now=Date.parse("2026-10-17T04:12:00Z");
const invite={id:"client",email:"client@example.com",role:"client",status:"pending",expires_at:"2026-11-17T00:00:00Z",last_seen_at:null};
const items=[{id:"one",product_name:"Chair",approval_status:"approved"},{id:"two",product_name:"Table",approval_status:"pending"}];
describe("Shared room decisions",()=>{
  it("counts each furniture instance and pending decision",()=>{const r=sharedRoomStatus(items,[invite],[],now);expect(r.status).toBe("Partially approved");expect(r.approved).toBe(1);expect(r.pending).toBe(1);expect(r.decisions[0].id).toBe("two");});
  it("shows client finish proposals as outstanding changes",()=>{const r=sharedRoomStatus(items,[invite],[{item_id:"two",invite_id:"client",comment:"Finish request: Smoked Oak",reaction:null,created_at:"2026-10-17"}],now);expect(r.status).toBe("Changes requested");expect(r.attention).toBe(1);expect(r.decisions[0].comment).toBe("Smoked Oak");});
  it("does not count contractors or revoked invitations as clients",()=>{expect(sharedRoomStatus(items,[{...invite,role:"contractor"}],[],now).status).toBe("Not invited");expect(sharedRoomStatus(items,[{...invite,status:"revoked"}],[],now).status).toBe("Not invited");});
  it("requires every piece approved before room approval",()=>{expect(sharedRoomStatus(items.map(i=>({...i,approval_status:"approved"})),[invite],[],now).status).toBe("Approved");expect(sharedRoomStatus([],[invite],[],now).status).not.toBe("Approved");});
  it("identifies rejected pieces and expired invitations",()=>{expect(sharedRoomStatus([{...items[1],approval_status:"rejected"}],[invite],[],now).attention).toBe(1);expect(sharedRoomStatus(items,[{...invite,expires_at:"2026-10-01"}],[],now).status).toBe("Invitation expired");});
});