// src/tools/searchTools.js
const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");
const { getSafePath, isBinaryFile, isSecretFile, WORKSPACE_ROOT } = require("../safety/pathSafety");
const { successResult, errorResult } = require("../utils/errors");
const { getConfig } = require("../utils/config");

const DEFAULT_IGNORED_DIRS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.cache/**",
  "**/.agent/**",
];

/**
 * Searches code across project files with context and filtering
 */
function searchCode({
  query,
  searchDirectory = ".",
  maxResults = 50,
  contextLines = 3,
  caseSensitive = false,
  isRegex = false,
  fileExtension = "",
} = {}) {
  try {
    if (!query) {
      return errorResult("query is required for searchCode.", "INVALID_ARGUMENTS");
    }

    const config = getConfig();
    const limit = Math.min(
      parseInt(maxResults, 10) || config.maxSearchResults || 50,
      100
    );
    const ctx = Math.min(parseInt(contextLines, 10) || 3, 10);

    const safeDir = getSafePath(searchDirectory);
    const relativeSearchDir = path.relative(WORKSPACE_ROOT, safeDir).replace(/\\/g, "/") || ".";

    let pattern;
    if (fileExtension) {
      const cleanExt = fileExtension.replace(/^\./, "");
      pattern = relativeSearchDir === "."
        ? `**/*.${cleanExt}`
        : `${relativeSearchDir}/**/*.${cleanExt}`;
    } else {
      pattern = relativeSearchDir === "."
        ? "**/*"
        : `${relativeSearchDir}/**/*`;
    }

    const files = globSync(pattern, {
      cwd: WORKSPACE_ROOT,
      ignore: DEFAULT_IGNORED_DIRS,
      nodir: true,
      dot: false,
    });

    let regexMatcher;
    if (isRegex) {
      try {
        regexMatcher = new RegExp(query, caseSensitive ? "g" : "gi");
      } catch (e) {
        return errorResult(`Invalid regular expression: ${e.message}`, "INVALID_REGEX");
      }
    }

    const matches = [];

    for (const relFile of files) {
      if (matches.length >= limit) break;

      const normRelFile = relFile.replace(/\\/g, "/");
      if (isBinaryFile(normRelFile) || isSecretFile(normRelFile)) {
        continue;
      }

      const fullPath = path.resolve(WORKSPACE_ROOT, relFile);
      let content;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > 2000000) continue; // Skip files > 2MB
        content = fs.readFileSync(fullPath, "utf-8");
      } catch (_) {
        continue;
      }

      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= limit) break;

        const currentLine = lines[i];
        let isMatch = false;

        if (isRegex) {
          regexMatcher.lastIndex = 0;
          isMatch = regexMatcher.test(currentLine);
        } else if (caseSensitive) {
          isMatch = currentLine.includes(query);
        } else {
          isMatch = currentLine.toLowerCase().includes(query.toLowerCase());
        }

        if (isMatch) {
          const startIdx = Math.max(0, i - ctx);
          const endIdx = Math.min(lines.length - 1, i + ctx);

          const context = [];
          for (let j = startIdx; j <= endIdx; j++) {
            context.push({
              line: j + 1,
              text: lines[j],
              isTarget: j === i,
            });
          }

          matches.push({
            file: normRelFile,
            line: i + 1,
            text: currentLine.trim(),
            context,
          });
        }
      }
    }

    return successResult(
      {
        query,
        totalMatches: matches.length,
        hasMore: matches.length >= limit,
        results: matches,
      },
      { tool: "searchCode", query, count: matches.length }
    );
  } catch (err) {
    return errorResult(err.message, "SEARCH_CODE_ERROR");
  }
}

module.exports = {
  searchCode,
};
