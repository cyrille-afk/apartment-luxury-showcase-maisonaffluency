import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_DIAL_OPTIONS, getDialCode } from "@/lib/phonePlaceholder";

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  inferredCountry?: string | null;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
}

const cleanNational = (raw: string) => raw.replace(/[^\d\s\-\(\)\.]/g, "");

const detectDialCode = (value: string): string | null => {
  const trimmed = value.trim();
  // Prefer longest matching prefix so +1 doesn't beat +44.
  const sorted = [...COUNTRY_DIAL_OPTIONS].sort(
    (a, b) => b.dial.length - a.dial.length
  );
  return sorted.find((o) => trimmed.startsWith(o.dial))?.dial ?? null;
};

export function PhoneInput({
  id,
  value,
  onChange,
  inferredCountry,
  placeholder = "Phone number",
  className,
  hasError,
}: PhoneInputProps) {
  const inferredDial = getDialCode(inferredCountry);

  const [selectedDial, setSelectedDial] = useState<string>(() => {
    const matched = detectDialCode(value);
    return matched || inferredDial || "+65";
  });

  // Keep the selected dial code in sync if the user pastes a full international number.
  useEffect(() => {
    const matched = detectDialCode(value);
    if (matched && matched !== selectedDial) {
      setSelectedDial(matched);
    }
  }, [value, selectedDial]);

  const nationalNumber = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed.startsWith(selectedDial)) {
      return trimmed.slice(selectedDial.length).trim();
    }
    return cleanNational(trimmed);
  }, [value, selectedDial]);

  const handleDialChange = (dial: string) => {
    setSelectedDial(dial);
    const currentNational = value
      .trim()
      .replace(/^\+[\d]+\s*/, "")
      .trim();
    onChange(currentNational ? `${dial} ${currentNational}` : dial);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Allow a full international paste (e.g. +33 6 16 23 74 60).
    if (raw.trim().startsWith("+")) {
      const matched = detectDialCode(raw.trim());
      if (matched) {
        onChange(raw.trim());
        return;
      }
    }

    raw = cleanNational(raw);
    onChange(raw ? `${selectedDial} ${raw}` : selectedDial);
  };

  const borderClasses = hasError
    ? "border-destructive focus-within:border-destructive"
    : "border-border focus-within:border-foreground";

  return (
    <div
      className={`flex items-center rounded-lg bg-background overflow-hidden transition-colors ${borderClasses} ${
        className || ""
      }`}
    >
      <Select value={selectedDial} onValueChange={handleDialChange}>
        <SelectTrigger
          id={id ? `${id}-dial` : undefined}
          aria-label="Country code"
          className="h-11 w-[5.75rem] shrink-0 rounded-none border-0 border-r border-border bg-transparent pl-3 pr-2 font-body text-sm focus:ring-0 focus:ring-offset-0"
        >
          <SelectValue placeholder="+65">{selectedDial}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_DIAL_OPTIONS.map((o) => (
            <SelectItem
              key={o.country}
              value={o.dial}
              className="font-body text-sm"
            >
              <span className="mr-2 inline-block w-5 text-center">{o.flag}</span>
              <span className="mr-1">{o.country}</span>
              <span className="text-muted-foreground">{o.dial}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        value={nationalNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        className="h-11 flex-1 rounded-none border-0 bg-transparent px-3 font-body text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
