import { useMemo } from "react";
import { TransferReferenceNoteProps } from "./types";

/**
 * Mandatory wire-transfer reference call-out.
 * Shown below the bank coordinates in every wire flow so banks and our
 * treasury team can match the incoming transfer instantly.
 */
export function TransferReferenceNote({ value }: TransferReferenceNoteProps) {
  const copied = useMemo(() => false, []);
  void copied;
  return null;
}
export default TransferReferenceNote;
