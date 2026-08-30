const { execSync } = require("child_process");
const { WORKSPACE_ROOT } = require("../workspace");

function gitStatus() {
  try {
    const output = execSync("git status", {
      cwd: WORKSPACE_ROOT,
      encoding: "utf-8",
      timeout: 10000,
    });
    return output.trim();
  } catch (error) {
    return error.stderr?.toString().trim() || error.message;
  }
}

function gitDiff() {
  try {
    const output = execSync("git diff", {
      cwd: WORKSPACE_ROOT,
      encoding: "utf-8",
      timeout: 10000,
    });
    return output.trim() || "No uncommitted changes.";
  } catch (error) {
    return error.stderr?.toString().trim() || error.message;
  }
}

function gitLog({ count = 5 } = {}) {
  try {
    const limit = parseInt(count, 10) || 5;
    const output = execSync(`git log -n ${limit} --oneline`, {
      cwd: WORKSPACE_ROOT,
      encoding: "utf-8",
      timeout: 10000,
    });
    return output.trim();
  } catch (error) {
    return error.stderr?.toString().trim() || error.message;
  }
}

module.exports = {
  gitStatus,
  gitDiff,
  gitLog,
};
