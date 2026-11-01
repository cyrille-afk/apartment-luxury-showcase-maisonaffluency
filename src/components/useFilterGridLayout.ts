import { useState } from "react";

/** Desktop density and drawer visibility change together without remounting cards. */
export function useFilterGridLayout(initialColumns: 3 | 4 = 3) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<3 | 4>(initialColumns);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    setColumns(next ? 4 : 3);
  };
  return { open, columns, changeOpen, changeColumns: setColumns };
}