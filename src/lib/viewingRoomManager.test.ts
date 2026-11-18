import { describe, it, expect } from "vitest";
import { managerBoardSummary, type ManagerBoard } from "./viewingRoomManager";
const board: ManagerBoard = { id: "board", title: "Essential", items: [
  { id: "chair", name: "Chair", image: null, glb_url: "https://example.com/chair.glb", price_cents: 479100, price_from: false },
  { id: "table", name: "Table", image: null, glb_url: "https://example.com/table.glb", price_cents: 2920200, price_from: true },
] };
describe("viewing room manager board summary", () => {
  it("calculates furniture total from retail cents", () => { expect(managerBoardSummary(board).totalCents).toBe(3399300); expect(managerBoardSummary(board).from).toBe(true); });
  it("requires every item to have a valid model for 3D Ready", () => { expect(managerBoardSummary(board).isReady).toBe(true); expect(managerBoardSummary({ ...board, items: [board.items[0], { ...board.items[1], glb_url: "https://example.com/photo.jpg" }] }).isReady).toBe(false); });
  it("never labels an empty board ready", () => { expect(managerBoardSummary({ ...board, items: [] }).isReady).toBe(false); });
  it("flags unknown prices rather than confirming the partial total", () => { expect(managerBoardSummary({ ...board, items: [{ ...board.items[0], price_cents: null }] }).unpriced).toBe(1); });
});