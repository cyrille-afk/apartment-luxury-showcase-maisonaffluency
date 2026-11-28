import { expect, it } from "vitest";
import { removeSessionVersion, uniqueSessionVersions } from "./aiRenderSessionHistory";
it("does not add another session version when reopening the same source layout", () => {
  const layout = { imageUrl: "https://example.com/layout.png", storedUrl: null };
  expect(uniqueSessionVersions([layout, { ...layout }, { ...layout }])).toEqual([layout]);
});
it("does not treat refreshed private image signatures as new versions", () => {
  const first = { imageUrl: "https://example.com/storage/v1/object/sign/trade-private/layout.png?token=one", storedUrl: null };
  expect(uniqueSessionVersions([first, { ...first, imageUrl: first.imageUrl.replace("one", "two") }])).toEqual([first]);
});
it("deletes the selected version without deleting other renders", () => {
  const first = { imageUrl: "https://example.com/one.png", storedUrl: null };
  const second = { imageUrl: "https://example.com/two.png", storedUrl: null };
  expect(removeSessionVersion([first, second], first)).toEqual([second]);
});