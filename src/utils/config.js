// src/utils/config.js
const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  maxIterations: 30,
  maxRepairAttempts: 3,
  maxFileSize: 100000, // 100 KB
  maxReadChars: 30000,
  maxSearchResults: 50,
  contextLines: 3,
  commandTimeout: 30000,
  requireApprovalForEdits: true,
  requireApprovalForDangerousCommands: true,
  allowCommands: ["npm", "node", "git", "npx", "dir", "ls", "echo", "type", "cat"],
  denyCommands: ["format", "shutdown", "diskpart", "restart-computer", "rmdir /s /q c:\\"],
  logLevel: process.env.LOG_LEVEL || "info",
  saveLogs: true,
};

let cachedConfig = null;

function getConfigPath(workspaceRoot = process.cwd()) {
  return path.join(workspaceRoot, ".agent", "config.json");
}

function loadConfig(workspaceRoot = process.cwd()) {
  const configPath = getConfigPath(workspaceRoot);
  let fileConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      fileConfig = JSON.parse(raw);
    } catch (err) {
      console.warn(`[Config] Failed to parse .agent/config.json: ${err.message}`);
    }
  }

  cachedConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
  };

  return cachedConfig;
}

function getConfig(workspaceRoot = process.cwd()) {
  if (!cachedConfig) {
    return loadConfig(workspaceRoot);
  }
  return cachedConfig;
}

function updateConfig(newValues, workspaceRoot = process.cwd()) {
  const current = getConfig(workspaceRoot);
  cachedConfig = { ...current, ...newValues };

  const agentDir = path.join(workspaceRoot, ".agent");
  if (!fs.existsSync(agentDir)) {
    try {
      fs.mkdirSync(agentDir, { recursive: true });
    } catch (_) {}
  }

  try {
    fs.writeFileSync(
      getConfigPath(workspaceRoot),
      JSON.stringify(cachedConfig, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.warn(`[Config] Failed to save config to disk: ${err.message}`);
  }

  return cachedConfig;
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  loadConfig,
  updateConfig,
};
