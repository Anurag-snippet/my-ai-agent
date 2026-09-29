// src/tools/gitTools.js
const { execSync } = require("child_process");
const { WORKSPACE_ROOT, getSafePath } = require("../safety/pathSafety");
const { successResult, errorResult } = require("../utils/errors");

function execGit(args, options = {}) {
  try {
    const output = execSync(`git ${args}`, {
      cwd: WORKSPACE_ROOT,
      encoding: "utf-8",
      timeout: options.timeout || 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, output: (output || "").trim() };
  } catch (err) {
    const msg = err.stderr ? err.stderr.toString().trim() : err.message;
    return { ok: false, error: msg, exitCode: err.status || 1 };
  }
}

function gitStatus() {
  const res = execGit("status --porcelain -b");
  if (!res.ok) {
    return errorResult(res.error, "GIT_STATUS_ERROR");
  }

  const lines = res.output.split(/\r?\n/).filter(Boolean);
  const branchHeader = lines[0] || "## detached";
  const files = lines.slice(1).map((line) => ({
    status: line.substring(0, 2).trim(),
    file: line.substring(3).trim(),
  }));

  // Also grab normal status output for readability
  const humanRes = execGit("status");

  return successResult(
    {
      branch: branchHeader.replace(/^##\s*/, ""),
      filesChangedCount: files.length,
      files,
      raw: humanRes.ok ? humanRes.output : res.output,
    },
    { tool: "gitStatus" }
  );
}

function gitDiff({ cached = false, filePath } = {}) {
  let cmd = "diff";
  if (cached) cmd += " --cached";
  if (filePath) {
    // Validate path
    getSafePath(filePath);
    cmd += ` -- "${filePath}"`;
  }

  const res = execGit(cmd);
  if (!res.ok) {
    return errorResult(res.error, "GIT_DIFF_ERROR");
  }

  return successResult(
    {
      diff: res.output || "No changes detected.",
      hasChanges: Boolean(res.output),
    },
    { tool: "gitDiff" }
  );
}

function gitLog({ count = 5 } = {}) {
  const limit = Math.min(Math.max(parseInt(count, 10) || 5, 1), 50);
  const res = execGit(`log -n ${limit} --pretty=format:"%h - %an, %ar : %s"`);
  if (!res.ok) {
    return errorResult(res.error, "GIT_LOG_ERROR");
  }

  const commits = res.output.split(/\r?\n/).filter(Boolean);
  return successResult(
    {
      count: commits.length,
      commits,
      raw: res.output,
    },
    { tool: "gitLog" }
  );
}

function gitBranch() {
  const res = execGit("branch -a");
  if (!res.ok) {
    return errorResult(res.error, "GIT_BRANCH_ERROR");
  }

  const branches = res.output.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
  const current = branches.find((b) => b.startsWith("*"))?.replace(/^\*\s*/, "") || "unknown";

  return successResult(
    {
      currentBranch: current,
      allBranches: branches.map((b) => b.replace(/^\*\s*/, "")),
    },
    { tool: "gitBranch" }
  );
}

function gitShow({ commit = "HEAD" } = {}) {
  // Sanitize commit string to avoid shell injection
  const safeCommit = commit.replace(/[^a-zA-Z0-9_.~^/-]/g, "");
  const res = execGit(`show --stat -p ${safeCommit}`);
  if (!res.ok) {
    return errorResult(res.error, "GIT_SHOW_ERROR");
  }

  return successResult(
    {
      commit: safeCommit,
      output: res.output,
    },
    { tool: "gitShow" }
  );
}

function gitBlame({ filePath, startLine, endLine } = {}) {
  if (!filePath) {
    return errorResult("filePath is required for gitBlame.", "INVALID_ARGUMENTS");
  }

  getSafePath(filePath);

  let cmd = `blame "${filePath}"`;
  if (startLine || endLine) {
    const s = parseInt(startLine, 10) || 1;
    const e = parseInt(endLine, 10) || s + 20;
    cmd += ` -L ${s},${e}`;
  }

  const res = execGit(cmd);
  if (!res.ok) {
    return errorResult(res.error, "GIT_BLAME_ERROR");
  }

  return successResult(
    {
      filePath,
      blame: res.output,
    },
    { tool: "gitBlame" }
  );
}

module.exports = {
  gitStatus,
  gitDiff,
  gitLog,
  gitBranch,
  gitShow,
  gitBlame,
};
