import { expect, it } from 'vitest';
import { berberWeaveHeight, usesPilePhotograph } from './visualiserRugWeave';

it('never paints Herringbone Berber with the loop-pile photograph', () => {
  expect(usesPilePhotograph('herringbone')).toBe(false);
  expect(usesPilePhotograph('flatweave')).toBe(false);
  expect(usesPilePhotograph('ribbed')).toBe(false);
  expect(usesPilePhotograph('loop')).toBe(true);
});
it('reverses diagonal twill direction in adjacent Berber bands', () => {
  expect(berberWeaveHeight(8, 8)).toBeCloseTo(berberWeaveHeight(184, 8));
  expect(berberWeaveHeight(8, 8)).not.toBeCloseTo(berberWeaveHeight(8, 14));
});