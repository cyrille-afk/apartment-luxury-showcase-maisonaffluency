/** Keep horizontal sections intact; oversized sections must be split by their logical entries first. */
export function comparisonSectionPages(heights: number[], firstCapacity: number, nextCapacity: number): number[][] {
  const pages: number[][] = [[]];
  let remaining = firstCapacity;
  heights.forEach((height, index) => {
    if (!Number.isFinite(height) || height < 0 || height > nextCapacity) throw new Error("Comparison section exceeds printable area");
    if (height > remaining) { pages.push([]); remaining = nextCapacity; }
    pages[pages.length - 1].push(index); remaining -= height;
  });
  return pages;
}