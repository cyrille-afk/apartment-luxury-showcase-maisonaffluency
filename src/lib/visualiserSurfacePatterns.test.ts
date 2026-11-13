import { expect, it } from 'vitest';
import { OAK_BOARD_WIDTH_M, OAK_TILE_SIZE_M, OAK_ROUGHNESS, WALL_ROUGHNESS, TRAVERTINE_TEXTURE_SIZE, oakChevronSample, travertineSample } from './visualiserSurfacePatterns';
it('keeps chevron boards 12cm wide perpendicular to their 45 degree course', () => {
  expect(OAK_BOARD_WIDTH_M).toBe(.12);
  expect(OAK_TILE_SIZE_M / 6 / Math.SQRT2).toBeCloseTo(.12);
  expect(OAK_ROUGHNESS).toBe(.68);
});
it('uses 1024px travertine and a nonmetallic matte wall roughness of .92', () => {
  expect(TRAVERTINE_TEXTURE_SIZE).toBe(1024);
  expect(WALL_ROUGHNESS).toBe(.92);
  expect(travertineSample(.15,.32)).not.toEqual(travertineSample(.7,.32));
});
it('creates recessed chevron groove relief rather than square board patches', () => {
  expect(oakChevronSample(.1,.1).height).toBe(98);
  expect(oakChevronSample(.1,.18).height).toBeGreaterThan(120);
});
