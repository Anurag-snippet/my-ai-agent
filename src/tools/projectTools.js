// src/tools/projectTools.js
const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");
const { WORKSPACE_ROOT } = require("../safety/pathSafety");
const { successResult, errorResult } = require("../utils/errors");

const IGNORE_PATTERNS = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "build/**",
  ".next/**",
  "coverage/**",
  ".cache/**",
  ".agent/**",
];

/**
 * Returns the project file structure up to a max depth
 */
function getProjectStructure({ maxDepth = 3 } = {}) {
  try {
    const depth = Math.min(Math.max(parseInt(maxDepth, 10) || 3, 1), 6);
    const files = globSync("**/*", {
      cwd: WORKSPACE_ROOT,
      ignore: IGNORE_PATTERNS,
      nodir: false,
      dot: true,
      maxDepth: depth,
    });

    // Format into tree representation
    const formatted = files
      .filter((f) => !f.startsWith(".git") && !f.startsWith("node_modules"))
      .map((f) => f.replace(/\\/g, "/"));

    return successResult(
      {
        totalEntries: formatted.length,
        structure: formatted,
      },
      { tool: "getProjectStructure", count: formatted.length }
    );
  } catch (err) {
    return errorResult(err.message, "PROJECT_STRUCTURE_ERROR");
  }
}

/**
 * Analyzes project type, framework, dependencies, scripts, and entry points
 */
function analyzeProject() {
  try {
    const analysis = {
      projectType: "Unknown",
      language: "Unknown",
      framework: null,
      packageManager: null,
      entryPoints: [],
      configFiles: [],
      scripts: {},
      testCommands: [],
      buildCommands: [],
      lintCommands: [],
      dependenciesSummary: [],
    };

    // Check configuration and manifest files
    const checkFile = (fileName) => fs.existsSync(path.join(WORKSPACE_ROOT, fileName));

    // Node.js project
    if (checkFile("package.json")) {
      analysis.projectType = "Node.js";
      analysis.language = checkFile("tsconfig.json") ? "TypeScript" : "JavaScript";
      analysis.configFiles.push("package.json");

      if (checkFile("pnpm-lock.yaml")) analysis.packageManager = "pnpm";
      else if (checkFile("yarn.lock")) analysis.packageManager = "yarn";
      else if (checkFile("package-lock.json")) analysis.packageManager = "npm";
      else analysis.packageManager = "npm";

      try {
        const pkg = JSON.parse(
          fs.readFileSync(path.join(WORKSPACE_ROOT, "package.json"), "utf-8")
        );
        analysis.scripts = pkg.scripts || {};

        if (pkg.main) analysis.entryPoints.push(pkg.main);
        if (checkFile("index.js")) analysis.entryPoints.push("index.js");
        if (checkFile("src/index.js")) analysis.entryPoints.push("src/index.js");
        if (checkFile("src/main.js")) analysis.entryPoints.push("src/main.js");
        if (checkFile("src/App.jsx")) analysis.entryPoints.push("src/App.jsx");

        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };

        // Detect frameworks
        if (allDeps.next) analysis.framework = "Next.js";
        else if (allDeps.vite) analysis.framework = "Vite";
        else if (allDeps.react) analysis.framework = "React";
        else if (allDeps.express) analysis.framework = "Express";
        else if (allDeps.nest || allDeps["@nestjs/core"]) analysis.framework = "NestJS";
        else if (allDeps.fastify) analysis.framework = "Fastify";

        // Verification commands
        if (analysis.scripts.test && !analysis.scripts.test.includes("no test specified")) {
          analysis.testCommands.push("npm test");
        }
        if (analysis.scripts.build) {
          analysis.buildCommands.push("npm run build");
        }
        if (analysis.scripts.lint) {
          analysis.lintCommands.push("npm run lint");
        }

        analysis.dependenciesSummary = Object.keys(allDeps).slice(0, 15);
      } catch (_) {}
    } else if (checkFile("pyproject.toml") || checkFile("requirements.txt") || checkFile("setup.py")) {
      analysis.projectType = "Python";
      analysis.language = "Python";
      if (checkFile("pytest.ini") || checkFile("tests")) analysis.testCommands.push("pytest");
    } else if (checkFile("Cargo.toml")) {
      analysis.projectType = "Rust";
      analysis.language = "Rust";
      analysis.testCommands.push("cargo test");
      analysis.buildCommands.push("cargo build");
    } else if (checkFile("go.mod")) {
      analysis.projectType = "Go";
      analysis.language = "Go";
      analysis.testCommands.push("go test ./...");
      analysis.buildCommands.push("go build ./...");
    }

    // Default syntax validation fallback
    if (analysis.testCommands.length === 0 && analysis.language === "JavaScript") {
      analysis.testCommands.push("node --check <file>");
    }

    return successResult(analysis, { tool: "analyzeProject" });
  } catch (err) {
    return errorResult(err.message, "ANALYZE_PROJECT_ERROR");
  }
}

module.exports = {
  getProjectStructure,
  analyzeProject,
};
