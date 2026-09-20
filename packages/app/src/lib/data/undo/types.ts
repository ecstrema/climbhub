
/** An undoable action can be done and undone. */
export interface Undoable {
  do: () => void;
  undo: () => void;
}
