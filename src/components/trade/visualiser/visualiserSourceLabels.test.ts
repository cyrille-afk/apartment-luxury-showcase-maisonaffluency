import { expect, it } from "vitest";
import { visualiserSourceLabels } from "../../../../visualiserSourceLabels";

it("removes injected DOM labels only inside the visualiser module tree", () => {
  const hook = visualiserSourceLabels().transform;
  if (typeof hook !== "function") throw new Error("Missing source-label transform");
  const transform = hook as (code: string, id: string) => unknown;
  const code = 'jsx("mesh", { "data-tsd-source": "/scene.tsx:1:1", visible: true })';
  expect(transform(code, "/app/src/components/trade/visualiser/SceneObject.tsx")).toEqual({ code: 'jsx("mesh", { visible: true })', map: null });
  expect(transform(code, "/app/src/pages/TradeTools.tsx")).toBeNull();
});