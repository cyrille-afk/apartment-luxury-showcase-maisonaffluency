import React, { useCallback } from "react";

interface BiographyToolbarProps {
  textareaId: string;
  value: string;
  onChange: (newValue: string) => void;
}

const BUTTONS = [
  { label: "B", wrap: ["<strong>", "</strong>"], placeholder: "bold text", title: "Bold" },
  { label: "I", wrap: ["<em>", "</em>"], placeholder: "italic text", title: "Italic" },
  { label: "❝", prefix: "\u2018", suffix: "\u2019", placeholder: "quoted text", title: "Single Quote (highlighted)" },
  { label: "Link", title: "Hyperlink" },
  { label: "—", insert: "\n\n", title: "Paragraph break" },
] as const;

/**
 * Formatting toolbar for biography textareas.
 * Wraps selected text or inserts placeholder at cursor.
 * Uses HTML tags that EditorialBiography's renderParagraph() already supports.
 */
export default function BiographyToolbar({ textareaId, value, onChange }: BiographyToolbarProps) {
  const handleClick = useCallback(
    (btn: (typeof BUTTONS)[number]) => {
      const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.substring(start, end);
      let replacement: string;
      let cursorStart: number;
      let cursorEnd: number;

      if (btn.label === "Link") {
        const url = prompt("URL (e.g. /designer/ecart or https://...):", "/designer/");
        if (!url) return;
        const linkText = selected || prompt("Link text:", "") || "link text";
        replacement = `<a href="${url}">${linkText}</a>`;
        cursorStart = cursorEnd = start + replacement.length;
      } else if ("insert" in btn && btn.insert) {
        replacement = btn.insert;
        cursorStart = cursorEnd = start + replacement.length;
      } else if ("wrap" in btn && btn.wrap) {
        const inner = selected || btn.placeholder || "";
        replacement = `${btn.wrap[0]}${inner}${btn.wrap[1]}`;
        if (selected) {
          cursorStart = cursorEnd = start + replacement.length;
        } else {
          cursorStart = start + btn.wrap[0].length;
          cursorEnd = cursorStart + inner.length;
        }
      } else if ("prefix" in btn && btn.prefix) {
        const inner = selected || btn.placeholder || "";
        replacement = `${btn.prefix}${inner}${btn.suffix || ""}`;
        if (selected) {
          cursorStart = cursorEnd = start + replacement.length;
        } else {
          cursorStart = start + btn.prefix.length;
          cursorEnd = cursorStart + inner.length;
        }
      } else {
        return;
      }

      const newValue = value.substring(0, start) + replacement + value.substring(end);
      onChange(newValue);

      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursorStart, cursorEnd);
      });
    },
    [textareaId, value, onChange],
  );

  return (
    <div className="flex items-center gap-1 mt-1 mb-1">
      {BUTTONS.map((btn) => (
        <button
          key={btn.label}
          type="button"
          title={btn.title}
          className="px-2 py-1 text-[11px] font-mono border border-border rounded hover:bg-muted transition-colors"
          style={
            btn.label === "B"
              ? { fontWeight: 700 }
              : btn.label === "I"
                ? { fontStyle: "italic" }
                : undefined
          }
          onClick={() => handleClick(btn)}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
