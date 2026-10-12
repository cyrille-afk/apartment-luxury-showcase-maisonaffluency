/** Shared length policy for product technical legends. */
export function parseTechnicalSpecs(text: string, fallbackLabel = "Technical Specs") {
  const lines = text.split("\n").map((line) => line.trim());
  const first = lines.findIndex(Boolean);
  const hasHeader = first >= 0 && /:\s*$/.test(lines[first]);
  const label = hasHeader ? lines[first].replace(/:\s*$/, "").trim() : fallbackLabel;
  const bodyLines = hasHeader ? lines.slice(first + 1) : lines;
  while (bodyLines.length && !bodyLines[0]) bodyLines.shift();
  while (bodyLines.length && !bodyLines[bodyLines.length - 1]) bodyLines.pop();
  const content = bodyLines.filter(Boolean);
  const isDescription = /^description$/i.test(label);
  const collapsible = !isDescription && (content.length > 3 || content.join(" ").length > 300 || content.some((line) => line.length > 160));
  return { label, bodyLines, collapsible };
}
