import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AddToProjectPopoverProps {
  productId: string; // real UUID
  productName: string;
  children: React.ReactNode;
}

interface Board {
  id: string;
  title: string;
}

/**
 * Popover that lets the user add a product to one of their project folders (client_boards).
 * Wraps a trigger element (e.g. a button).
 */
export default function AddToProjectPopover({ productId, productName, children }: AddToProjectPopoverProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("client_boards")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setBoards((data as Board[]) || []);
        setLoading(false);
      });
  }, [open, user]);

  const addToBoard = async (boardId: string, boardTitle: string) => {
    if (!user || adding) return;
    setAdding(boardId);

    // Check if already in board
    const { data: existing } = await supabase
      .from("client_board_items")
      .select("id")
      .eq("board_id", boardId)
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      toast({ title: "Already in project", description: `${productName} is already in "${boardTitle}"` });
      setAddedTo((prev) => new Set(prev).add(boardId));
      setAdding(null);
      return;
    }

    // Get max sort_order
    const { data: items } = await supabase
      .from("client_board_items")
      .select("sort_order")
      .eq("board_id", boardId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = items && items.length > 0 ? (items[0] as any).sort_order + 1 : 0;

    const { error } = await supabase
      .from("client_board_items")
      .insert({
        board_id: boardId,
        product_id: productId,
        sort_order: nextOrder,
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAddedTo((prev) => new Set(prev).add(boardId));
      toast({ title: "Added to project", description: `${productName} → "${boardTitle}"` });
    }
    setAdding(null);
  };

  const createAndAdd = async () => {
    if (!user || adding) return;
    setAdding("new");
    const { data, error } = await supabase
      .from("client_boards")
      .insert({ user_id: user.id, title: productName.slice(0, 60), client_name: "" })
      .select("id, title")
      .single();

    if (error || !data) {
      toast({ title: "Error", description: error?.message || "Failed to create project", variant: "destructive" });
      setAdding(null);
      return;
    }

    const board = data as Board;
    setBoards((prev) => [board, ...prev]);
    await addToBoard(board.id, board.title);
  };

  if (!user) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-56 p-0 bg-background/95 backdrop-blur-xl border-border">
        <div className="p-2.5 border-b border-border">
          <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Add to project</p>
        </div>
        <div className="max-h-48 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : boards.length === 0 ? (
            <p className="font-body text-[10px] text-muted-foreground text-center py-3 px-2">
              No projects yet
            </p>
          ) : (
            boards.map((board) => {
              const done = addedTo.has(board.id);
              return (
                <button
                  key={board.id}
                  onClick={() => addToBoard(board.id, board.title)}
                  disabled={!!adding || done}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors disabled:opacity-60",
                    done && "bg-muted/20"
                  )}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : adding === board.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-body text-xs text-foreground truncate">{board.title}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-border p-1">
          <button
            onClick={createAndAdd}
            disabled={!!adding}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors rounded-sm"
          >
            {adding === "new" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-[hsl(var(--gold))] shrink-0" />
            )}
            <span className="font-body text-xs text-foreground">New project</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
