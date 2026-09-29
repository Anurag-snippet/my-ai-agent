// src/utils/logger.js
const fs = require("fs");
const path = require("path");
const { getConfig } = require("./config");

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  warning: 2,
  error: 3,
  none: 4,
};

let logFileStream = null;
let currentSessionId = null;

// Common secret patterns to redact
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g, // Google API key
  /(api[_-]?key\s*[:=]\s*['"]?)([\w-]{8,})(['"]?)/gi,
  /(token\s*[:=]\s*['"]?)([\w-]{8,})(['"]?)/gi,
  /(password\s*[:=]\s*['"]?)([\w-]{8,})(['"]?)/gi,
  /(secret\s*[:=]\s*['"]?)([\w-]{8,})(['"]?)/gi,
  /(authorization:\s*bearer\s+)([\w.-]+)/gi,
];

function redactSecrets(text) {
  if (typeof text !== "string") {
    try {
      text = JSON.stringify(text, null, 2);
    } catch (_) {
      text = String(text);
    }
  }

  let sanitized = text;
  // If process.env.GEMINI_API_KEY is present, explicitly redact it
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) {
    sanitized = sanitized.split(process.env.GEMINI_API_KEY).join("[REDACTED_API_KEY]");
  }

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match, p1, p2, p3) => {
      if (p2) return `${p1}[REDACTED]${p3 || ""}`;
      return "[REDACTED_SECRET]";
    });
  }

  return sanitized;
}

function initSessionLogger(workspaceRoot = process.cwd()) {
  const config = getConfig(workspaceRoot);
  if (!config.saveLogs) return;

  try {
    const logsDir = path.join(workspaceRoot, ".agent", "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    currentSessionId = new Date().toISOString().replace(/[:.]/g, "-");
    const logFilePath = path.join(logsDir, `session-${currentSessionId}.log`);
    logFileStream = fs.createWriteStream(logFilePath, { flags: "a" });
  } catch (err) {
    // Silently continue if log cannot be initialized
  }
}

function log(level, message, meta = null) {
  const config = getConfig();
  const currentThreshold = LOG_LEVELS[config.logLevel?.toLowerCase()] ?? LOG_LEVELS.info;
  const targetLevel = LOG_LEVELS[level.toLowerCase()] ?? LOG_LEVELS.info;

  const timestamp = new Date().toISOString();
  const cleanMessage = redactSecrets(message);
  const cleanMeta = meta ? redactSecrets(meta) : null;

  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${cleanMessage}${
    cleanMeta ? ` ${cleanMeta}` : ""
  }\n`;

  if (logFileStream) {
    try {
      logFileStream.write(logEntry);
    } catch (_) {}
  }

  if (targetLevel < currentThreshold) {
    return;
  }

  // Only output to console for debug or when specifically requested,
  // to avoid cluttering the clean CLI interface
  if (config.logLevel === "debug") {
    const prefix = `[${level.toUpperCase()}]`;
    if (level === "error") {
      console.error(prefix, cleanMessage, meta || "");
    } else if (level === "warn" || level === "warning") {
      console.warn(prefix, cleanMessage, meta || "");
    } else {
      console.log(prefix, cleanMessage, meta || "");
    }
  }
}

const logger = {
  debug: (msg, meta) => log("debug", msg, meta),
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
  redactSecrets,
  initSessionLogger,
};

module.exports = logger;
