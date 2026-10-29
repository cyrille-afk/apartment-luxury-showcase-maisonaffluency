import { expect, it } from 'vitest';
import { deduplicateInquiryFinish } from './inquiryMessage';

it('keeps one occurrence of the same structured finish in an enquiry', () => {
  const finish = 'Selected finish: Solid Oak - Black / TEDDY MOHAIR - Sable';
  expect(deduplicateInquiryFinish(`${finish}\nPhone: 123\n${finish}`)).toBe(`${finish}\nPhone: 123`);
});
it('preserves different finishes and customer notes', () => {
  const message = 'Selected finish: Oak\nPlease compare Oak and Walnut.\nSelected finish: Walnut';
  expect(deduplicateInquiryFinish(message)).toBe(message);
});