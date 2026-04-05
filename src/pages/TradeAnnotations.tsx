import { Helmet } from "react-helmet-async";
import { useState, useRef } from "react";
import { Upload, MessageCircle, X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Pin {
  id: string;
  x: number;
  y: number;
  text: string;
}

export default function TradeAnnotations() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPins([]);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacing || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newPin: Pin = { id: crypto.randomUUID(), x, y, text: "" };
    setPins((prev) => [...prev, newPin]);
    setActivePin(newPin.id);
    setIsPlacing(false);
  };

  const updatePinText = (id: string, text: string) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
  };

  const removePin = (id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
    if (activePin === id) setActivePin(null);
  };

  return (
    <>
      <Helmet><title>Markup & Annotation — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">Markup & Annotation</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Pin comments directly on floor plans, renders, or product photos for team and client review.
            </p>
          </div>
          {imageUrl && (
            <Button variant="outline" size="sm" onClick={() => setIsPlacing(!isPlacing)} className={isPlacing ? "border-primary text-primary" : ""}>
              <Plus className="h-4 w-4 mr-2" />
              {isPlacing ? "Click image to place pin" : "Add Pin"}
            </Button>
          )}
        </div>

        {!imageUrl ? (
          <label className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-foreground/30 transition-colors">
            <Upload className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">Upload a floor plan or image to annotate</p>
            <p className="font-body text-xs text-muted-foreground/60 mt-1">JPG, PNG up to 20MB</p>
            <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </label>
        ) : (
          <div className="flex gap-6 flex-col lg:flex-row">
            <div className="flex-1">
              <div
                ref={imgRef}
                onClick={handleImageClick}
                className={`relative border border-border rounded-lg overflow-hidden ${isPlacing ? "cursor-crosshair" : ""}`}
              >
                <img src={imageUrl} alt="Annotated" className="w-full h-auto" />
                {pins.map((pin, i) => (
                  <button
                    key={pin.id}
                    onClick={(e) => { e.stopPropagation(); setActivePin(pin.id); }}
                    className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${activePin === pin.id ? "bg-primary text-primary-foreground scale-110 shadow-lg" : "bg-foreground text-background shadow-md hover:scale-105"}`}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full lg:w-80 space-y-2 shrink-0">
              <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {pins.length} annotation{pins.length !== 1 ? "s" : ""}
              </p>
              {pins.length === 0 && (
                <p className="font-body text-xs text-muted-foreground/70">Click "Add Pin" then click on the image to place annotations.</p>
              )}
              {pins.map((pin, i) => (
                <div
                  key={pin.id}
                  className={`p-3 rounded-lg border transition-colors ${activePin === pin.id ? "border-primary bg-primary/5" : "border-border"}`}
                  onClick={() => setActivePin(pin.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display text-xs text-foreground">Pin {i + 1}</span>
                    <button onClick={() => removePin(pin.id)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <Textarea
                    value={pin.text}
                    onChange={(e) => updatePinText(pin.id, e.target.value)}
                    placeholder="Add a note..."
                    className="font-body text-xs min-h-[60px] resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
