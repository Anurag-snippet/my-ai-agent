// src/agent/ApprovalManager.js
const readline = require("readline");
const { diffCard, dangerousCommandAlert } = require("../ui/renderer");

class ApprovalManager {
  constructor() {
    this.sessionAutoApproveEdits = false;
    this.sessionAutoApproveCommands = false;
    this.sharedRl = null;
  }

  setSharedReadline(rl) {
    this.sharedRl = rl;
  }

  promptUser(query) {
    return new Promise((resolve) => {
      if (this.sharedRl && !this.sharedRl.closed) {
        this.sharedRl.question(query, (ans) => {
          resolve(ans.trim());
        });
      } else {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question(query, (ans) => {
          rl.close();
          resolve(ans.trim());
        });
      }
    });
  }

  resetSession() {
    this.sessionAutoApproveEdits = false;
    this.sessionAutoApproveCommands = false;
  }

  /**
   * Requests user approval for file modification or creation
   * @param {string} filePath - Path of target file
   * @param {string} diffText - Unified diff text
   * @param {string} action - 'EDIT' | 'CREATE' | 'DELETE' | 'MOVE'
   * @returns {Promise<{ approved: boolean, autoApproveSession: boolean }>}
   */
  async requestFileApproval(filePath, diffText, action = "EDIT") {
    if (this.sessionAutoApproveEdits) {
      console.log(`\n⚡ Auto-approved file change (${action}) for ${filePath} [session approval active]`);
      return { approved: true, autoApproveSession: true };
    }

    diffCard(filePath, diffText, action);

    const promptText = `Apply this change to ${filePath}? [y/n/a] (y=yes, n=no, a=approve all file changes this session): `;
    const answer = await this.promptUser(promptText);
    const lower = answer.toLowerCase();

    if (lower === "a") {
      this.sessionAutoApproveEdits = true;
      console.log("✅ Approved. All subsequent file changes in this session are auto-approved.");
      return { approved: true, autoApproveSession: true };
    }

    if (lower === "y" || lower === "yes") {
      return { approved: true, autoApproveSession: false };
    }

    return { approved: false, autoApproveSession: false };
  }

  /**
   * Requests user approval for commands classified as HIGH_RISK or DESTRUCTIVE
   */
  async requestCommandApproval(command, reason, category = "DESTRUCTIVE") {
    if (this.sessionAutoApproveCommands && category !== "DESTRUCTIVE") {
      return { approved: true };
    }

    dangerousCommandAlert(command, reason, category);

    const promptText = `Allow execution of this command? [y/n]: `;
    const answer = await this.promptUser(promptText);
    const lower = answer.toLowerCase();

    return { approved: lower === "y" || lower === "yes" };
  }
}

// Global shared singleton
let defaultApprovalManager = null;

function getApprovalManager() {
  if (!defaultApprovalManager) {
    defaultApprovalManager = new ApprovalManager();
  }
  return defaultApprovalManager;
}

// Backwards compatibility helper
async function askForApproval(message) {
  const mgr = getApprovalManager();
  const answer = await mgr.promptUser(`${message} [y/n]: `);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

module.exports = {
  ApprovalManager,
  getApprovalManager,
  askForApproval,
};
