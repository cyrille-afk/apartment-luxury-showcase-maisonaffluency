import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PairBlock from "./PairBlock";

interface JournalMarkdownProps {
  content: string;
  components: any;
  onPairImageClick?: (url: string, caption: string | null) => void;
}

const PAIR_REGEX = /:::pair\s*\n([\s\S]*?)\n:::/g;

const parsePairBody = (body: string) => {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, caption] = line.split(" | ").map((s) => s.trim());
      return { url, caption: caption || null };
    })
    .filter((img) => img.url);
};

/**
 * Renders article markdown, intercepting `:::pair ... :::` shortcodes
 * to display 2-up side-by-side image pairs inline.
 */
const JournalMarkdown = ({ content, components, onPairImageClick }: JournalMarkdownProps) => {
  const segments: Array<{ type: "md" | "pair"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  PAIR_REGEX.lastIndex = 0;

  while ((match = PAIR_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "md", value: content.substring(lastIndex, match.index) });
    }
    segments.push({ type: "pair", value: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "md", value: content.substring(lastIndex) });
  }
  if (segments.length === 0) {
    segments.push({ type: "md", value: content });
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "pair") {
          const images = parsePairBody(seg.value);
          return <PairBlock key={i} images={images} onImageClick={onPairImageClick} />;
        }
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={components}>
            {seg.value}
          </ReactMarkdown>
        );
      })}
    </>
  );
};

export default JournalMarkdown;
