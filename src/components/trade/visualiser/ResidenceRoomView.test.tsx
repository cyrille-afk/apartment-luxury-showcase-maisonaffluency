import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import ResidenceRoomView from "./ResidenceRoomView";
import { roomSelectionKey,type ResidenceRoom } from "@/lib/residenceRooms";
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/viewingRoom.functions",() => ({ generateResidenceVisualization: mocks.generate }));
vi.mock("@tanstack/react-start",() => ({ useServerFn: (fn: unknown) => fn }));
afterEach(() => { cleanup();vi.resetAllMocks(); });
const choices = [{ slot_id: "living",product_id: "console" },{ slot_id: "dining",product_id: "table" }];
const room: ResidenceRoom = { id: "room",room_name: "Living Room",room_type: "living_room",shell_url: "https://example.com/shell.jpg",render_url: "https://example.com/render.jpg",slot_ids: ["living"],selection_signature: roomSelectionKey(choices,["living"]) };
const props = { token: "private-room",packageId: "package",rooms: [room],roomId: "room",onRoom: vi.fn(),choices,disabled: false };
it("displays saved room immediately without a new AI call",() => { render(<ResidenceRoomView {...props} />);expect(mocks.generate).not.toHaveBeenCalled(); });
it("updates the selected room through its saved room id and keeps complete choices for server validation",async () => { mocks.generate.mockResolvedValue({ id: "job",url: "https://example.com/new.jpg" });render(<ResidenceRoomView {...props} />);fireEvent.click(screen.getByRole("button",{ name: "Update Room View" }));await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith({ data: { token: "private-room",packageId: "package",shellUrl: room.shell_url,roomRenderId: room.id,choices } })); });
it("locked collections cannot request new room staging",() => { render(<ResidenceRoomView {...props} disabled />);expect(screen.getByRole("button",{ name: "Update Room View" })).toBeDisabled(); });
it("switches between four saved room angles without generating again",() => {
  const gallery_views = ["Front-Left","Front-Right","Back-Right","Back-Left"].map((label,i) => ({ label,url: `https://example.com/angle-${i}.png` }));
  render(<ResidenceRoomView {...props} rooms={[{ ...room,gallery_views }]} />);
  fireEvent.click(screen.getByRole("button",{ name: "Back-Left" }));
  expect(screen.getByRole("img")).toHaveAttribute("src","https://example.com/angle-3.png");
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("does not present saved gallery angles as matching changed furniture",() => {
  render(<ResidenceRoomView {...props} choices={[{ slot_id: "living",product_id: "replacement" }]} rooms={[{ ...room,gallery_views: [{ label: "Front-Left",url: "https://example.com/old.png" }] }]} />);
  expect(screen.queryByRole("group",{ name: "Room camera angles" })).not.toBeInTheDocument();
  expect(screen.getByRole("img")).not.toHaveAttribute("src","https://example.com/old.png");
});