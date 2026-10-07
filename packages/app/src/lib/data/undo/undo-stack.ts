import type { Undoable } from "./types";
import { UndoableGroup } from "./actions";

/** Simple undo stack */
export class UndoManager {
  #undoStack: Undoable[] = [];
  #redoStack: Undoable[] = [];
  /** Length of the undo stack when {@link beginGroup} was called */
  #groupStart: number | undefined;

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
    if (this.#groupStart !== undefined) {
      this.#groupStart = Math.min(this.#groupStart, this.#undoStack.length);
    }
  }

  redo() {
    const undoable = this.#redoStack.pop();
    if (undoable) {
      undoable.do();
      this.#undoStack.push(undoable);
    }
  }

  /**
   * Starts a group: the undoables done until {@link endGroup} are still applied immediately, but are
   * then compacted into a single {@link UndoableGroup}. Used for live edits, e.g. while typing in a field.
   */
  beginGroup() {
    this.endGroup();
    this.#groupStart = this.#undoStack.length;
  }

  endGroup() {
    if (this.#groupStart === undefined) return;
    const undoables = this.#undoStack.splice(this.#groupStart);
    this.#groupStart = undefined;
    if (undoables.length === 0) return;
    // Already applied: push the group without doing it again
    this.#undoStack.push(undoables.length === 1 ? undoables[0]! : new UndoableGroup(undoables));
  }
}
