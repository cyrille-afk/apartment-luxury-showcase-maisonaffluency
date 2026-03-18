import { useState, useRef, useCallback, useEffect } from "react";
import { Undo2, Trash2, CheckCircle2, Plus, MousePointer } from "lucide-react";
import type { Point2D, Room } from "./types";
import { ROOM_COLORS } from "./types";

interface WallTracerProps {
  planImageUrl: string;
  rooms: Room[];
  onRoomsChange: (rooms: Room[]) => void;
  onDone: () => void;
}

type Tool = "draw" | "select";

const WallTracer = ({ planImageUrl, rooms, onRoomsChange, onDone }: WallTracerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point2D[]>([]);
  const [tool, setTool] = useState<Tool>("draw");
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [hoveredPoint, setHoveredPoint] = useState<Point2D | null>(null);

  // Load plan image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = planImageUrl;
  }, [planImageUrl]);

  // Fit canvas to container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      const h = Math.floor(entry.contentRect.height);
      if (w > 0 && h > 0) setCanvasSize({ w, h });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Compute scale/offset to fit image in canvas
  const getTransform = useCallback(() => {
    if (imgSize.w === 0) return { scale: 1, ox: 0, oy: 0 };
    const sx = canvasSize.w / imgSize.w;
    const sy = canvasSize.h / imgSize.h;
    const scale = Math.min(sx, sy) * 0.95;
    const ox = (canvasSize.w - imgSize.w * scale) / 2;
    const oy = (canvasSize.h - imgSize.h * scale) / 2;
    return { scale, ox, oy };
  }, [imgSize, canvasSize]);

  // Canvas coords → image coords
  const canvasToImage = useCallback((cx: number, cy: number): Point2D => {
    const { scale, ox, oy } = getTransform();
    return { x: (cx - ox) / scale, y: (cy - oy) / scale };
  }, [getTransform]);

  // Image coords → canvas coords
  const imageToCanvas = useCallback((p: Point2D): { cx: number; cy: number } => {
    const { scale, ox, oy } = getTransform();
    return { cx: p.x * scale + ox, cy: p.y * scale + oy };
  }, [getTransform]);

  // Draw everything
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    // Draw plan image
    if (imgRef.current && imgSize.w > 0) {
      const { scale, ox, oy } = getTransform();
      ctx.drawImage(imgRef.current, ox, oy, imgSize.w * scale, imgSize.h * scale);
    }

    // Draw completed rooms
    for (const room of rooms) {
      if (room.corners.length < 3) continue;
      ctx.beginPath();
      const first = imageToCanvas(room.corners[0]);
      ctx.moveTo(first.cx, first.cy);
      for (let i = 1; i < room.corners.length; i++) {
        const p = imageToCanvas(room.corners[i]);
        ctx.lineTo(p.cx, p.cy);
      }
      ctx.closePath();
      ctx.fillStyle = room.color.replace(")", " / 0.25)").replace("hsl(", "hsla(");
      ctx.fill();
      ctx.strokeStyle = room.color.replace("90%)", "50%)");
      ctx.lineWidth = 2;
      ctx.stroke();

      // Room label
      const cx = room.corners.reduce((s, p) => s + p.x, 0) / room.corners.length;
      const cy = room.corners.reduce((s, p) => s + p.y, 0) / room.corners.length;
      const labelPos = imageToCanvas({ x: cx, y: cy });
      ctx.font = "12px sans-serif";
      ctx.fillStyle = room.color.replace("90%)", "30%)");
      ctx.textAlign = "center";
      ctx.fillText(room.name, labelPos.cx, labelPos.cy);
    }

    // Draw current polygon in progress
    if (currentPoints.length > 0) {
      ctx.beginPath();
      const first = imageToCanvas(currentPoints[0]);
      ctx.moveTo(first.cx, first.cy);
      for (let i = 1; i < currentPoints.length; i++) {
        const p = imageToCanvas(currentPoints[i]);
        ctx.lineTo(p.cx, p.cy);
      }
      if (hoveredPoint) {
        const hp = imageToCanvas(hoveredPoint);
        ctx.lineTo(hp.cx, hp.cy);
      }
      ctx.strokeStyle = "hsl(var(--foreground))";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw points
      for (const pt of currentPoints) {
        const p = imageToCanvas(pt);
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "hsl(var(--foreground))";
        ctx.fill();
        ctx.strokeStyle = "hsl(var(--background))";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Closing indicator
      if (currentPoints.length >= 3 && hoveredPoint) {
        const dist = Math.hypot(hoveredPoint.x - currentPoints[0].x, hoveredPoint.y - currentPoints[0].y);
        const { scale } = getTransform();
        if (dist * scale < 15) {
          const fp = imageToCanvas(currentPoints[0]);
          ctx.beginPath();
          ctx.arc(fp.cx, fp.cy, 10, 0, Math.PI * 2);
          ctx.strokeStyle = "hsl(150 60% 50%)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }, [canvasSize, imgSize, rooms, currentPoints, hoveredPoint, getTransform, imageToCanvas]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== "draw") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const pt = canvasToImage(cx, cy);

    // Close polygon if clicking near first point
    if (currentPoints.length >= 3) {
      const dist = Math.hypot(pt.x - currentPoints[0].x, pt.y - currentPoints[0].y);
      const { scale } = getTransform();
      if (dist * scale < 15) {
        const newRoom: Room = {
          id: `room-${Date.now()}`,
          name: `Room ${rooms.length + 1}`,
          corners: [...currentPoints],
          color: ROOM_COLORS[rooms.length % ROOM_COLORS.length],
        };
        onRoomsChange([...rooms, newRoom]);
        setCurrentPoints([]);
        return;
      }
    }

    setCurrentPoints((prev) => [...prev, pt]);
  }, [tool, currentPoints, rooms, canvasToImage, getTransform, onRoomsChange]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setHoveredPoint(canvasToImage(cx, cy));
  }, [canvasToImage]);

  const undoLastPoint = () => setCurrentPoints((prev) => prev.slice(0, -1));
  const deleteLastRoom = () => onRoomsChange(rooms.slice(0, -1));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
        <button
          onClick={() => setTool("draw")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-body text-xs transition-colors ${
            tool === "draw" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Draw Room
        </button>
        <button
          onClick={() => setTool("select")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-body text-xs transition-colors ${
            tool === "select" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <MousePointer className="h-3.5 w-3.5" />
          Select
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={undoLastPoint}
          disabled={currentPoints.length === 0}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title="Undo last point"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={deleteLastRoom}
          disabled={rooms.length === 0}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title="Delete last room"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <div className="flex-1" />

        <span className="font-body text-xs text-muted-foreground">
          {rooms.length} room{rooms.length !== 1 ? "s" : ""} traced
        </span>

        <button
          onClick={onDone}
          disabled={rooms.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md font-body text-xs bg-foreground text-background disabled:opacity-30 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          View in 3D
        </button>
      </div>

      {/* Hint */}
      {tool === "draw" && currentPoints.length === 0 && rooms.length === 0 && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="font-body text-xs text-muted-foreground">
            Click on the plan to place corner points of a room. Click near the first point to close the shape.
          </p>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative bg-muted/20 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMove}
          className="absolute inset-0 cursor-crosshair"
          style={{ width: canvasSize.w, height: canvasSize.h }}
        />
      </div>
    </div>
  );
};

export default WallTracer;
