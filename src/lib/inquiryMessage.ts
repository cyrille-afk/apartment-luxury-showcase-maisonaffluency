/** Remove only repeated identical structured finish lines; retain free notes
 * and different finish choices, including historical enquiry messages. */
export function deduplicateInquiryFinish(message: string): string {
  const seen = new Set<string>();
  return message.split(/\r?\n/).filter((line) => {
    if (!/^Selected finish:\s*\S/i.test(line.trim())) return true;
    const key = line.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join('\n');
}