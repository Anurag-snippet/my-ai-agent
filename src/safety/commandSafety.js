// src/safety/commandSafety.js
// Classification of terminal commands and safety enforcement

const { getConfig } = require("../utils/config");

const CATEGORIES = {
  SAFE: "SAFE",
  LOW_RISK: "LOW_RISK",
  HIGH_RISK: "HIGH_RISK",
  DESTRUCTIVE: "DESTRUCTIVE",
};

// Patterns for destructive commands (irreversible or data-loss)
const DESTRUCTIVE_RULES = [
  { pattern: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b/i, reason: "Recursive force deletion of files and folders (rm -rf)" },
  { pattern: /\b(rmdir|rd)\s+(\/[sS]\s+\/[qQ]|\/[qQ]\s+\/[sS]|\/[sS])\b/i, reason: "Windows recursive directory removal (rmdir /s)" },
  { pattern: /\bdel(\.exe)?\s+.*(\/[sS]|\/[fF]|\/[qQ])/i, reason: "Windows recursive/force file deletion (del /s /f /q)" },
  { pattern: /\b(format(\.com|\.exe)?\s+[a-zA-Z]:)/i, reason: "Disk drive format command" },
  { pattern: /\b(diskpart|fdisk|mkfs)\b/i, reason: "Disk partitioning or filesystem creation tool" },
  { pattern: /\bshutdown(\.exe)?\b/i, reason: "System shutdown command" },
  { pattern: /\b(restart-computer|stop-computer)\b/i, reason: "System reboot/halt command" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, reason: "Permanently discards all uncommitted working tree and staged changes" },
  { pattern: /\bgit\s+clean\s+(-[a-zA-Z]*f[a-zA-Z]*d|-[a-zA-Z]*d[a-zA-Z]*f)\b/i, reason: "Permanently deletes untracked files and directories" },
  { pattern: /\bRemove-Item\b.*(-Recurse|-Force)/i, reason: "PowerShell recursive force deletion" },
  { pattern: />\s*(\/dev\/sd[a-z]|\/dev\/nvme|\\\\|C:\\Windows)/i, reason: "Direct overwrite of disk or system partition" },
];

// Patterns for high-risk commands (can alter git history, force push, or kill processes)
const HIGH_RISK_RULES = [
  { pattern: /\bgit\s+push\s+.*--force\b/i, reason: "Force push can overwrite remote branch history" },
  { pattern: /\bgit\s+branch\s+(-D|--delete\s+--force)\b/i, reason: "Force delete branch" },
  { pattern: /\bgit\s+checkout\s+--force\b/i, reason: "Force checkout discards modified files" },
  { pattern: /\bgit\s+restore\s+--staged\b/i, reason: "Unstages changes from Git index" },
  { pattern: /\b(kill\s+-9|taskkill\s+\/[fF])\b/i, reason: "Force killing processes" },
  { pattern: /\bchmod\s+(-R\s+)?777\b/i, reason: "Overly permissive file permissions modification" },
  { pattern: /\bnpm\s+publish\b/i, reason: "Publishing package to public registry" },
];

// Patterns for low-risk modifying commands
const LOW_RISK_RULES = [
  { pattern: /\bnpm\s+(install|i|add|update|uninstall|remove)\b/i, reason: "Modifies package dependencies" },
  { pattern: /\bgit\s+(add|commit|checkout|switch|merge|pull|stash)\b/i, reason: "Modifies Git state or working copy" },
  { pattern: /\b(mkdir|touch|copy|cp|move|mv)\b/i, reason: "File or directory modification" },
];

/**
 * Classifies a terminal command into safety categories
 * @param {string} command - The terminal command line string
 * @param {object} customConfig - Optional configuration
 */
function classifyCommand(command, customConfig = null) {
  if (!command || typeof command !== "string") {
    return {
      category: CATEGORIES.DESTRUCTIVE,
      reason: "Empty or invalid command",
      isAllowed: false,
      blockedReason: "Command must be a non-empty string",
    };
  }

  const trimmed = command.trim();
  const config = customConfig || getConfig();

  // Extract primary command binary/executable
  const firstToken = trimmed.split(/[\s|;&><]+/)[0].toLowerCase();
  const baseBinary = firstToken.replace(/^.*[\\/]/, "").replace(/\.(exe|cmd|bat|ps1|sh)$/i, "");

  // Check denylist
  const denyCommands = (config.denyCommands || []).map((c) => c.toLowerCase());
  for (const denied of denyCommands) {
    if (trimmed.toLowerCase().includes(denied) || baseBinary === denied) {
      return {
        category: CATEGORIES.DESTRUCTIVE,
        reason: `Command matches denylist entry '${denied}'`,
        isAllowed: false,
        blockedReason: `Command matches explicitly denied rule '${denied}' in .agent/config.json`,
      };
    }
  }

  // Check destructive rules
  for (const rule of DESTRUCTIVE_RULES) {
    if (rule.pattern.test(trimmed)) {
      return {
        category: CATEGORIES.DESTRUCTIVE,
        reason: rule.reason,
        isAllowed: true, // may be allowed if user confirms
        blockedReason: null,
      };
    }
  }

  // Check high risk rules
  for (const rule of HIGH_RISK_RULES) {
    if (rule.pattern.test(trimmed)) {
      return {
        category: CATEGORIES.HIGH_RISK,
        reason: rule.reason,
        isAllowed: true,
        blockedReason: null,
      };
    }
  }

  // Check low risk rules
  for (const rule of LOW_RISK_RULES) {
    if (rule.pattern.test(trimmed)) {
      return {
        category: CATEGORIES.LOW_RISK,
        reason: rule.reason,
        isAllowed: true,
        blockedReason: null,
      };
    }
  }

  // Check allowlist
  const allowCommands = (config.allowCommands || []).map((c) => c.toLowerCase());
  if (allowCommands.includes(baseBinary)) {
    return {
      category: CATEGORIES.SAFE,
      reason: `Command binary '${baseBinary}' is on allowlist`,
      isAllowed: true,
      blockedReason: null,
    };
  }

  // Default to SAFE for general inspection commands
  return {
    category: CATEGORIES.SAFE,
    reason: "Standard terminal command",
    isAllowed: true,
    blockedReason: null,
  };
}

/**
 * Backwards compatible helper
 */
function isDangerousCommand(command) {
  const result = classifyCommand(command);
  return (
    result.category === CATEGORIES.HIGH_RISK ||
    result.category === CATEGORIES.DESTRUCTIVE
  );
}

module.exports = {
  CATEGORIES,
  classifyCommand,
  isDangerousCommand,
  DESTRUCTIVE_RULES,
  HIGH_RISK_RULES,
};
