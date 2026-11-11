import { useState, type ReactNode } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, pointerWithin, useSensor, useSensors, type CollisionDetection } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

type Item = { id: string; label: string };
const sidebarCollision: CollisionDetection = args => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
function SortableRow({ item, children, list, over, active, disabled, tag }: { item: Item; children: (handle: ReactNode) => ReactNode; list: string; over: string | null; active: string | null; disabled: boolean; tag: "div" | "li" }) {
  const sortable = useSortable({ id: item.id, disabled });
  const Tag = tag;
  const handle = disabled ? null : <Button ref={sortable.setActivatorNodeRef} variant="ghost" size="icon" {...sortable.attributes} {...sortable.listeners} aria-label={`Reorder ${item.label}`} title={`Reorder ${item.label}`} className="sidebar-drag-handle ml-auto h-6 w-5 shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing"><GripVertical className="h-3 w-3" /></Button>;
  return <Tag ref={sortable.setNodeRef} data-sidebar-sortable={item.id} data-sidebar-list={list} data-dragging={sortable.isDragging || undefined} data-drop-before={over === item.id && active !== item.id && sortable.index < (sortable.activeIndex ?? 0) || undefined} data-drop-after={over === item.id && active !== item.id && sortable.index > (sortable.activeIndex ?? 0) || undefined} className="sidebar-sortable relative min-w-0" style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}>{children(handle)}</Tag>;
}

export function SortableSidebarList<T extends Item>({ items, onReorder, children, list, disabled = false, tag = "div" }: { items: T[]; onReorder: (ids: string[]) => void; children: (item: T, handle: ReactNode) => ReactNode; list: string; disabled?: boolean; tag?: "div" | "li" }) {
  const [active, setActive] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <DndContext sensors={sensors} collisionDetection={sidebarCollision} onDragStart={event => setActive(String(event.active.id))} onDragOver={event => setOver(event.over ? String(event.over.id) : null)} onDragCancel={() => { setActive(null); setOver(null); }} onDragEnd={event => {
    setActive(null); setOver(null);
    if (!event.over || event.active.id === event.over.id) return;
    const ids = items.map(item => item.id);
    const from = ids.indexOf(String(event.active.id)), to = ids.indexOf(String(event.over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
  }}><SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>{items.map(item => <SortableRow key={item.id} item={item} list={list} over={over} active={active} disabled={disabled} tag={tag}>{handle => children(item, handle)}</SortableRow>)}</SortableContext></DndContext>;
}