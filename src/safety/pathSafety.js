// src/safety/pathSafety.js
// Path validation, traversal defense, symlink boundary checks, and secret file guard

const path = require("path");
const fs = require("fs");
const { AgentError } = require("../utils/errors");

let currentWorkspaceRoot = path.resolve(process.cwd());

function getWorkspaceRoot() {
  return currentWorkspaceRoot;
}

function setWorkspaceRoot(newRoot) {
  if (newRoot) {
    currentWorkspaceRoot = path.resolve(newRoot);
  }
  return currentWorkspaceRoot;
}

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svgz",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp3", ".wav", ".ogg", ".mp4", ".mov", ".avi", ".mkv",
  ".pyc", ".class"
]);

const SECRET_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /credentials\.json$/i,
  /service-account.*\.json$/i,
  /secret/i,
];

/**
 * Normalizes path for case-insensitive platforms (Windows)
 */
function normalizeForComparison(p) {
  const resolved = path.resolve(p);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/**
 * Validates that a path is strictly inside the workspace.
 * Resolves symlinks if the target already exists.
 * @param {string} filePath - Path relative to workspace or absolute
 * @param {string} customWorkspaceRoot - Optional root override
 * @returns {string} Fully resolved absolute path
 */
function getSafePath(filePath, customWorkspaceRoot = currentWorkspaceRoot) {
  if (!filePath || typeof filePath !== "string") {
    throw new AgentError("Invalid file path: path must be a non-empty string.", "INVALID_PATH");
  }

  const root = path.resolve(customWorkspaceRoot || currentWorkspaceRoot);
  const absolutePath = path.resolve(root, filePath);
  const normRoot = normalizeForComparison(root);
  const normTarget = normalizeForComparison(absolutePath);

  // Check prefix
  const isInside =
    normTarget === normRoot ||
    normTarget.startsWith(normRoot + path.sep.toLowerCase()) ||
    normTarget.startsWith(normRoot + "/");

  if (!isInside) {
    throw new AgentError(
      `Access denied: path '${filePath}' is outside the workspace root '${root}'.`,
      "PATH_OUTSIDE_WORKSPACE"
    );
  }

  // Check realpath if file or parent exists (to prevent symlink breakout)
  try {
    let checkPath = absolutePath;
    while (!fs.existsSync(checkPath) && checkPath !== path.dirname(checkPath)) {
      checkPath = path.dirname(checkPath);
    }
    if (fs.existsSync(checkPath)) {
      const real = fs.realpathSync(checkPath);
      const normReal = normalizeForComparison(real);
      if (
        normReal !== normRoot &&
        !normReal.startsWith(normRoot + path.sep.toLowerCase()) &&
        !normReal.startsWith(normRoot + "/")
      ) {
        throw new AgentError(
          `Access denied: symlink resolves outside workspace root to '${real}'.`,
          "SYMLINK_OUTSIDE_WORKSPACE"
        );
      }
    }
  } catch (err) {
    if (err instanceof AgentError) throw err;
  }

  return absolutePath;
}

/**
 * Checks whether a path is safe without throwing
 */
function isSafePath(filePath, customWorkspaceRoot = currentWorkspaceRoot) {
  try {
    getSafePath(filePath, customWorkspaceRoot);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Checks if a filename matches known secret file patterns
 */
function isSecretFile(filePath) {
  const baseName = path.basename(filePath);
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(baseName));
}

/**
 * Checks if a filename is a known binary file
 */
function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

module.exports = {
  get WORKSPACE_ROOT() {
    return currentWorkspaceRoot;
  },
  getWorkspaceRoot,
  setWorkspaceRoot,
  getSafePath,
  isSafePath,
  isSecretFile,
  isBinaryFile,
  SECRET_FILE_PATTERNS,
  BINARY_EXTENSIONS,
};

