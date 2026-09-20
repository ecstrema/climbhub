import type { Undoable } from "./types";

/** Simple undo stack */
export class UndoManager {
  #undoStack: Undoable[] = [];
  #redoStack: Undoable[] = [];

  do(undoable: Undoable) {
    undoable.do();
    this.#undoStack.push(undoable);
    this.#redoStack = [];
  }

  undo() {
    const undoable = this.#undoStack.pop();
    if (undoable) {
      undoable.undo();
      this.#redoStack.push(undoable);
    }
  }

  redo() {
    const undoable = this.#redoStack.pop();
    if (undoable) {
      undoable.do();
      this.#undoStack.push(undoable);
    }
  }
}
