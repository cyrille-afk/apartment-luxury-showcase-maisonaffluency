import { useState, useRef } from "react";
import { Upload, X, FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CloudUploadProps {
  /** Storage folder path, e.g. "documents", "products", "journal" */
  folder: string;
  /** File types to accept, e.g. "application/pdf", "image/*" */
  accept: string;
  /** Allow multiple files */
  multiple?: boolean;
  /** Max file size in MB (default 20) */
  maxSizeMB?: number;
  /** Label text */
  label?: string;
  /** Called with the public URL(s) after upload */
  onUpload: (urls: string[]) => void;
  /** Currently uploading state override */
  disabled?: boolean;
}

const CloudUpload = ({
  folder,
  accept,
  multiple = false,
  maxSizeMB = 20,
  label,
  onUpload,
  disabled = false,
}: CloudUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isImage = accept.includes("image");
  const isPdf = accept.includes("pdf");

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const maxBytes = maxSizeMB * 1024 * 1024;
    const validFiles = Array.from(files).filter((f) => {
      if (f.size > maxBytes) {
        toast({ title: "File too large", description: `${f.name} exceeds ${maxSizeMB} MB`, variant: "destructive" });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    const urls: string[] = [];

    for (const file of validFiles) {
      const ext = file.name.split(".").pop() || (isImage ? "jpg" : "pdf");
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, {
        contentType: file.type,
      });
      if (error) {
        toast({ title: "Upload failed", description: `${file.name}: ${error.message}`, variant: "destructive" });
      } else {
        const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    }

    if (urls.length > 0) {
      onUpload(urls);
      toast({ title: `${urls.length} file${urls.length > 1 ? "s" : ""} uploaded` });
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const Icon = isPdf ? FileUp : Upload;
  const buttonLabel = label || (uploading ? "Uploading…" : `Upload ${isImage ? "image" : "file"}${multiple ? "s" : ""}`);

  return (
    <label
      className={`inline-flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-md cursor-pointer hover:border-foreground/30 transition-colors ${
        uploading || disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span className="font-body text-xs text-muted-foreground">{buttonLabel}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  );
};

export default CloudUpload;
