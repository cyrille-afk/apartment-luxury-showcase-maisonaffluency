# FF&E Schedule Wide-Desktop Layout

## Changes
- Reduce desktop outer spacing and let the FF&E workspace use the available portal width up to its existing 1800px cap.
- Keep the page itself overflow-free while allowing only the table region to scroll horizontally when a narrower desktop cannot fit every metadata column.
- Rebalance the fixed table into fluid percentage-based columns with compact cell spacing and intentional minimum widths.
- Truncate long item, brand, project, client, studio, and status values to one line; expose each full value through an accessible hover tooltip.
- Keep the item thumbnail column sticky on the left and the quote action column sticky on the right, with centered content, opaque semantic backgrounds, and subtle inset borders.
- Preserve current filtering, editing, export, drawer, pricing, and date calculations.

## Technical details
- Use a constrained `min-w-0 max-w-full` page wrapper and a table-only `overflow-x-auto overscroll-x-contain` viewport.
- Use `table-fixed`, a responsive minimum table width, and percentage-based `colgroup` allocations so wide screens fill naturally without page overflow.
- Use the existing tooltip and button components for full-cell text and quote actions.

## Verification
- Check type safety.
- Verify the authenticated FF&E Schedule at 1400px and 2560px widths.
- Confirm no page-level horizontal overflow, full table use on wide desktop, clipped labels reveal their full text, and both sticky edge columns remain aligned while the table viewport scrolls.
