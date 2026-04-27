import { Building2, Check, ChevronDown, Settings as SettingsIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStudio } from "@/hooks/useStudio";
import { useNavigate } from "react-router-dom";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export function StudioSwitcher() {
  const { studios, currentStudio, setCurrentStudioId, loading } = useStudio();
  const navigate = useNavigate();

  if (loading || studios.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-2 px-2 max-w-[180px] md:max-w-[240px]">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate text-sm font-medium">
            {currentStudio?.name ?? "Select studio"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Your studios</DropdownMenuLabel>
        {studios.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => setCurrentStudioId(s.id)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-sm">{s.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ROLE_LABEL[s.role]}
                </div>
              </div>
            </div>
            {currentStudio?.id === s.id && <Check className="h-4 w-4 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/trade/settings/studio")}>
          <SettingsIcon className="h-4 w-4 mr-2" /> Studio settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/trade/settings/studio?new=1")}>
          <Plus className="h-4 w-4 mr-2" /> Create new studio
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
