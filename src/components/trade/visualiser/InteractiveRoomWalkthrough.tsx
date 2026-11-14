import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls } from "three-stdlib";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";
import { walkPosition, walkViewpoint, type WalkInput } from "@/lib/roomWalkthrough";

export default function InteractiveRoomWalkthrough({ scene, input, viewpoint, onExit }: {
  scene: AICuratedSceneSchema; input: MutableRefObject<WalkInput>;
  viewpoint: { id: number; view: "entrance" | "left" | "right" }; onExit: () => void;
}) {
  const { camera, controls, gl, invalidate } = useThree();
  const keys = useRef(new Set<string>());
  const orientation = useRef({ yaw: 0, pitch: 0 });
  const canvas = gl.domElement;
  useEffect(() => {
    const orbit = controls as OrbitControls | undefined;
    const position = camera.position.clone(), quaternion = camera.quaternion.clone(), target = orbit?.target.clone();
    const perspective = camera as PerspectiveCamera, fov = perspective.fov;
    perspective.fov = 60; perspective.updateProjectionMatrix();
    const tabindex = canvas.getAttribute("tabindex");
    canvas.tabIndex = 0; canvas.focus({ preventScroll: true });
    let pointer: number | null = null, lastX = 0, lastY = 0;
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onExit(); return; }
      if (!["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); keys.current.add(e.code);
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.code);
    const down = (e: PointerEvent) => { if (e.button !== 0) return; pointer = e.pointerId; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true }); };
    const move = (e: PointerEvent) => {
      if (pointer !== e.pointerId) return;
      orientation.current.yaw -= (e.clientX - lastX) * 0.004;
      orientation.current.pitch = Math.max(-1.1, Math.min(1.1, orientation.current.pitch - (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY; invalidate();
    };
    const clear = () => { keys.current.clear(); pointer = null; input.current = { forward: 0, right: 0, turn: 0 }; };
    canvas.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", clear); canvas.addEventListener("pointercancel", clear);
    canvas.addEventListener("blur", clear); window.addEventListener("blur", clear);
    return () => {
      clear(); camera.position.copy(position); camera.quaternion.copy(quaternion);
      perspective.fov = fov; perspective.updateProjectionMatrix();
      if (target) orbit?.target.copy(target);
      if (tabindex === null) canvas.removeAttribute("tabindex"); else canvas.setAttribute("tabindex", tabindex);
      canvas.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup);
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", clear); canvas.removeEventListener("pointercancel", clear);
      canvas.removeEventListener("blur", clear); window.removeEventListener("blur", clear);
      invalidate();
    };
  }, [camera, controls, canvas, input, invalidate, onExit]);
  useEffect(() => {
    const point = walkViewpoint(scene, viewpoint.view);
    if (!point) { onExit(); return; }
    camera.position.set(...point);
    orientation.current = { yaw: Math.atan2(point[0], point[2]), pitch: 0 };
    invalidate();
  }, [viewpoint, scene, camera, invalidate, onExit]);
  useFrame((_, delta) => {
    const k = keys.current, held = input.current;
    const forward = held.forward + Number(k.has("KeyW") || k.has("ArrowUp")) - Number(k.has("KeyS") || k.has("ArrowDown"));
    const right = held.right + Number(k.has("KeyD")) - Number(k.has("KeyA"));
    orientation.current.yaw += (held.turn + Number(k.has("ArrowLeft")) - Number(k.has("ArrowRight"))) * Math.min(delta, 0.05) * 1.2;
    const next = walkPosition(scene, [camera.position.x, camera.position.y, camera.position.z], orientation.current.yaw, { forward, right, turn: 0 }, delta);
    camera.position.set(...next); camera.rotation.set(orientation.current.pitch, orientation.current.yaw, 0, "YXZ");
    const orbit = controls as OrbitControls | undefined;
    orbit?.target.copy(camera.position).add(camera.getWorldDirection(new Vector3()));
    canvas.dataset.sceneReady = "true";
    if (import.meta.env.DEV) canvas.dataset.walkPosition = next.map(n => n.toFixed(3)).join(",");
  });
  return null;
}