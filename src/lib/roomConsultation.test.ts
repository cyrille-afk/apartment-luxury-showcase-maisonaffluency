import { describe, expect, it } from 'vitest';
import { roomConsultationSchema } from './roomConsultation';

const input = { room: 'living-room', name: 'Alex Chen', email: 'alex@example.com', company: 'Chen Studio', profession: 'architect', phone: '', project: '', location: '', message: 'Seating and lighting for a residential living room.', website: '' };
describe('room consultation validation', () => {
  it.each(['living-room', 'dining-room', 'bedroom', 'office', 'outdoor'])('accepts the %s collection', room => {
    expect(roomConsultationSchema.parse({ ...input, room }).room).toBe(room);
  });
  it('rejects spaces without collection pages', () => {
    expect(roomConsultationSchema.safeParse({ ...input, room: 'unknown' }).success).toBe(false);
  });
  it('requires a real email and a studio', () => {
    expect(roomConsultationSchema.safeParse({ ...input, email: 'invalid' }).success).toBe(false);
    expect(roomConsultationSchema.safeParse({ ...input, company: ' ' }).success).toBe(false);
  });
  it('rejects oversized messages and filled spam traps', () => {
    expect(roomConsultationSchema.safeParse({ ...input, message: 'x'.repeat(4001) }).success).toBe(false);
    expect(roomConsultationSchema.safeParse({ ...input, website: 'spam' }).success).toBe(false);
  });
});