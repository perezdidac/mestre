/**
 * Undo & Redo History Manager for Mastering Rack & Audio DSP
 * Records immutable state snapshots of the signal chain upon user actions
 * (slider release, module reorder, bypass toggle, preset application, auto-align)
 * and enables non-destructive undo and redo.
 */

export class HistoryManager {
    constructor(rackEngine, callbacks = {}) {
        this.rack = rackEngine;
        this.callbacks = {
            onHistoryChange: () => {},
            onStateRestored: () => {},
            ...callbacks
        };
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.isRestoring = false;

        // Debounce timer for fast repeated events
        this.debounceTimer = null;
    }

    setRackEngine(rack) {
        this.rack = rack;
    }

    /**
     * Set the initial baseline state (not undoable on its own, but what we undo back to)
     */
    initBaseline(description = 'Initial Clean State') {
        if (!this.rack) return;
        this.undoStack = [];
        this.redoStack = [];
        const state = this.rack.exportState();
        this.undoStack.push({ description, state });
        this.notify();
    }

    /**
     * Push a new snapshot onto the undo stack when user releases slider or modifies chain
     * @param {string} description Human readable summary e.g. "Adjust VCA Threshold"
     */
    pushSnapshot(description = 'Modify Settings') {
        if (this.isRestoring || !this.rack) return;

        const state = this.rack.exportState();

        // Avoid duplicate identical snapshots in a row
        if (this.undoStack.length > 0) {
            const last = this.undoStack[this.undoStack.length - 1];
            if (JSON.stringify(last.state) === JSON.stringify(state)) {
                return;
            }
        }

        this.undoStack.push({ description, state });
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo stack on any new user intervention
        this.notify();
    }

    /**
     * Debounced snapshot for rapid mouse wheels or repeated discrete triggers
     */
    pushDebouncedSnapshot(description = 'Modify Settings', delayMs = 250) {
        if (this.isRestoring || !this.rack) return;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.pushSnapshot(description);
        }, delayMs);
    }

    /**
     * Perform Undo: restore previous state in stack
     */
    undo() {
        if (!this.canUndo() || !this.rack) return false;

        // Current state moves to redoStack
        const current = this.undoStack.pop();
        this.redoStack.push(current);

        // Previous state becomes active
        const target = this.undoStack[this.undoStack.length - 1];

        this.isRestoring = true;
        this.rack.importState(target.state);
        this.isRestoring = false;

        this.callbacks.onStateRestored?.(target.description);
        this.notify();
        return true;
    }

    /**
     * Perform Redo: step forward into redoStack
     */
    redo() {
        if (!this.canRedo() || !this.rack) return false;

        const target = this.redoStack.pop();
        this.undoStack.push(target);

        this.isRestoring = true;
        this.rack.importState(target.state);
        this.isRestoring = false;

        this.callbacks.onStateRestored?.(target.description);
        this.notify();
        return true;
    }

    canUndo() {
        return this.undoStack.length > 1;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    getUndoDescription() {
        if (!this.canUndo()) return null;
        return this.undoStack[this.undoStack.length - 1]?.description || 'Undo Action';
    }

    getRedoDescription() {
        if (!this.canRedo()) return null;
        return this.redoStack[this.redoStack.length - 1]?.description || 'Redo Action';
    }

    notify() {
        this.callbacks.onHistoryChange?.({
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoDesc: this.getUndoDescription(),
            redoDesc: this.getRedoDescription(),
            undoCount: Math.max(0, this.undoStack.length - 1),
            redoCount: this.redoStack.length
        });
    }
}
