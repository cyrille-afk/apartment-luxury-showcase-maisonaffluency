/** Empty capture is a render-only projection, never a mutation of saved pieces. */
export function emptyShellObjects<T>(objects: T[], capture: boolean): T[] {
  return capture ? [] : objects;
}