// src/tools/terminalTools.js
const { spawnSync } = require("child_process");
const path = require("path");
const { WORKSPACE_ROOT, getSafePath } = require("../safety/pathSafety");
const { successResult, errorResult } = require("../utils/errors");
const { getConfig } = require("../utils/config");
const logger = require("../utils/logger");

/**
 * Runs a terminal command safely in the workspace with timeout and timing
 */
function runCommand({ command, timeout, cwd } = {}) {
  try {
    if (!command || typeof command !== "string") {
      return errorResult("command is required and must be a string.", "INVALID_ARGUMENTS");
    }

    const config = getConfig();
    const effectiveTimeout = timeout || config.commandTimeout || 30000;
    const workingDir = cwd ? getSafePath(cwd) : WORKSPACE_ROOT;

    const startTime = Date.now();
    logger.debug(`Executing command: ${command} (cwd: ${workingDir}, timeout: ${effectiveTimeout}ms)`);

    // Use platform shell (cmd/powershell on Windows, /bin/sh on Unix)
    const isWin = process.platform === "win32";
    const shell = isWin ? (process.env.ComSpec || "cmd.exe") : "/bin/sh";
    const shellArgs = isWin ? ["/d", "/s", "/c", command] : ["-c", command];

    const result = spawnSync(shell, shellArgs, {
      cwd: workingDir,
      timeout: effectiveTimeout,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
      windowsVerbatimArguments: isWin,
    });

    const duration = Date.now() - startTime;
    const stdout = (result.stdout || "").trim();
    const stderr = (result.stderr || "").trim();
    const exitCode = result.status !== null ? result.status : (result.error ? 1 : 0);
    const timedOut = result.error?.code === "ETIMEDOUT";

    const data = {
      command,
      success: exitCode === 0 && !timedOut,
      exitCode,
      stdout,
      stderr,
      duration,
      timedOut,
      cwd: path.relative(WORKSPACE_ROOT, workingDir) || ".",
    };

    if (timedOut) {
      return errorResult(
        `Command timed out after ${effectiveTimeout}ms: '${command}'`,
        "COMMAND_TIMEOUT",
        data,
        { tool: "runCommand" }
      );
    }

    if (result.error) {
      return errorResult(
        result.error.message,
        "COMMAND_EXECUTION_ERROR",
        data,
        { tool: "runCommand" }
      );
    }

    return successResult(data, { tool: "runCommand", exitCode });
  } catch (err) {
    return errorResult(err.message, "RUN_COMMAND_ERROR");
  }
}

module.exports = {
  runCommand,
};
