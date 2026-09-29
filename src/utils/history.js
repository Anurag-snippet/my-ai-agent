// src/utils/history.js
// Tracks file modifications for undo/redo and audit history

const fs = require("fs");
const path = require("path");

class HistoryManager {
  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.undoStack = [];
    this.redoStack = [];
    this.historyLog = [];
    this.historyDir = path.join(workspaceRoot, ".agent", "history");
  }

  ensureHistoryDir() {
    if (!fs.existsSync(this.historyDir)) {
      try {
        fs.mkdirSync(this.historyDir, { recursive: true });
      } catch (_) {}
    }
  }

  /**
   * Records a file change
   * @param {object} change - { type: 'edit'|'create'|'delete'|'move', filePath, oldContent, newContent, oldPath, newPath }
   */
  recordChange(change) {
    const entry = {
      id: Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      ...change,
    };

    this.undoStack.push(entry);
    this.redoStack = []; // Clear redo stack on new action
    this.historyLog.push(entry);

    // Optionally persist snapshot to .agent/history
    this.saveSnapshot(entry);
    return entry;
  }

  saveSnapshot(entry) {
    try {
      this.ensureHistoryDir();
      const snapshotPath = path.join(this.historyDir, `change-${entry.id}.json`);
      fs.writeFileSync(snapshotPath, JSON.stringify(entry, null, 2), "utf-8");
    } catch (_) {}
  }

  /**
   * Reverts the most recent change
   */
  undo() {
    if (this.undoStack.length === 0) {
      return { success: false, message: "Nothing to undo." };
    }

    const entry = this.undoStack.pop();

    try {
      if (entry.type === "edit" || entry.type === "write") {
        const fullPath = path.resolve(this.workspaceRoot, entry.filePath);
        if (entry.oldContent === null || entry.oldContent === undefined) {
          // File was created brand new, so undo means removing it
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } else {
          fs.writeFileSync(fullPath, entry.oldContent, "utf-8");
        }
      } else if (entry.type === "create") {
        const fullPath = path.resolve(this.workspaceRoot, entry.filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } else if (entry.type === "delete") {
        const fullPath = path.resolve(this.workspaceRoot, entry.filePath);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, entry.oldContent || "", "utf-8");
      } else if (entry.type === "move") {
        const oldFullPath = path.resolve(this.workspaceRoot, entry.oldPath);
        const newFullPath = path.resolve(this.workspaceRoot, entry.newPath);
        if (fs.existsSync(newFullPath)) {
          const parentDir = path.dirname(oldFullPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.renameSync(newFullPath, oldFullPath);
        }
      }

      this.redoStack.push(entry);
      return {
        success: true,
        message: `Undid ${entry.type} on ${entry.filePath || entry.oldPath || entry.newPath}`,
        entry,
      };
    } catch (err) {
      this.undoStack.push(entry); // restore if failed
      return {
        success: false,
        message: `Undo failed: ${err.message}`,
      };
    }
  }

  /**
   * Re-applies the most recently undone change
   */
  redo() {
    if (this.redoStack.length === 0) {
      return { success: false, message: "Nothing to redo." };
    }

    const entry = this.redoStack.pop();

    try {
      if (entry.type === "edit" || entry.type === "write") {
        const fullPath = path.resolve(this.workspaceRoot, entry.filePath);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, entry.newContent, "utf-8");
      } else if (entry.type === "create") {
        const fullPath = path.resolve(this.workspaceRoot, entry.filePath);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, entry.newContent || "", "utf-8");
      } else if (entry.type === "delete") {
        const fullPath = path.resolve(this.workspaceRoot, entry.filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } else if (entry.type === "move") {
        const oldFullPath = path.resolve(this.workspaceRoot, entry.oldPath);
        const newFullPath = path.resolve(this.workspaceRoot, entry.newPath);
        if (fs.existsSync(oldFullPath)) {
          const parentDir = path.dirname(newFullPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.renameSync(oldFullPath, newFullPath);
        }
      }

      this.undoStack.push(entry);
      return {
        success: true,
        message: `Redid ${entry.type} on ${entry.filePath || entry.newPath}`,
        entry,
      };
    } catch (err) {
      this.redoStack.push(entry);
      return {
        success: false,
        message: `Redo failed: ${err.message}`,
      };
    }
  }

  getHistory() {
    return [...this.historyLog];
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.historyLog = [];
  }
}

// Global default instance for the current process
let defaultHistory = null;

function getHistoryManager(workspaceRoot = process.cwd()) {
  if (!defaultHistory || defaultHistory.workspaceRoot !== workspaceRoot) {
    defaultHistory = new HistoryManager(workspaceRoot);
  }
  return defaultHistory;
}

module.exports = {
  HistoryManager,
  getHistoryManager,
};
