import { useState, useRef } from "react";
import { Upload, FileUp, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PlanUploaderProps {
  onPlanUploaded: (url: string) => void;
}

const PlanUploader = ({ onPlanUploaded }: PlanUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please upload an image or PDF of your floor plan", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `room-plans/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from("assets").upload(path, file, { contentType: file.type });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      onPlanUploaded(urlData.publicUrl);
      toast({ title: "Plan uploaded", description: "Now trace your room walls on the plan" });
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="font-display text-2xl text-foreground mb-2">Upload Your Floor Plan</h2>
        <p className="font-body text-sm text-muted-foreground leading-relaxed">
          Upload a 2D architectural plan (image or PDF). You'll trace the room walls, 
          then view your space in 3D and furnish it with products from our catalog.
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`
          flex flex-col items-center justify-center gap-4 w-full max-w-md p-12
          border-2 border-dashed rounded-xl cursor-pointer transition-all
          ${dragOver ? "border-foreground bg-muted/50" : "border-border hover:border-foreground/30 hover:bg-muted/30"}
          ${uploading ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        {uploading ? (
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-muted-foreground" />
        )}
        <div className="text-center">
          <span className="font-body text-sm text-foreground block mb-1">
            {uploading ? "Uploading…" : "Drop your floor plan here"}
          </span>
          <span className="font-body text-xs text-muted-foreground">
            PNG, JPG, or PDF — max 50 MB
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
    </div>
  );
};

export default PlanUploader;
