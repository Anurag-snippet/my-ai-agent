// src/ui/renderer.js
const { colorizeDiff } = require("../utils/diff");

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function banner({ model = "Gemini", workspace = process.cwd() } = {}) {
  const line = "─".repeat(50);
  console.log(`\n${COLORS.cyan}╭${line}╮${COLORS.reset}`);
  console.log(`${COLORS.cyan}│${COLORS.bold}${COLORS.magenta}               MY AI CODING AGENT                 ${COLORS.reset}${COLORS.cyan}│${COLORS.reset}`);
  console.log(`${COLORS.cyan}│${COLORS.dim}       Autonomous Cursor-like Engineering Agent   ${COLORS.reset}${COLORS.cyan}│${COLORS.reset}`);
  console.log(`${COLORS.cyan}╰${line}╯${COLORS.reset}`);
  console.log(`${COLORS.gray}Model:${COLORS.reset}     ${COLORS.bold}${model}${COLORS.reset}`);
  console.log(`${COLORS.gray}Workspace:${COLORS.reset} ${workspace}`);
  console.log(`${COLORS.gray}Type ${COLORS.cyan}/help${COLORS.gray} for available commands or ${COLORS.cyan}exit${COLORS.gray} to quit.${COLORS.reset}\n`);
}

function divider(title = "", char = "─", length = 50) {
  if (!title) {
    console.log(`${COLORS.gray}${char.repeat(length)}${COLORS.reset}`);
    return;
  }
  const prefix = `── ${title} `;
  const rem = Math.max(0, length - prefix.length);
  console.log(`${COLORS.cyan}${prefix}${char.repeat(rem)}${COLORS.reset}`);
}

function toolStart(name, args = {}) {
  let icon = "🔧";
  let desc = "";

  switch (name) {
    case "searchCode":
      icon = "🔍";
      desc = `searchCode: '${args.query || ""}'`;
      break;
    case "readFile":
      icon = "📖";
      desc = `readFile: ${args.filePath || ""}${args.startLine ? ` (lines ${args.startLine}-${args.endLine || ""})` : ""}`;
      break;
    case "writeFile":
      icon = "📝";
      desc = `writeFile: ${args.filePath || ""}`;
      break;
    case "editFile":
      icon = "📝";
      desc = `editFile: ${args.filePath || ""}`;
      break;
    case "deleteFile":
      icon = "🗑️ ";
      desc = `deleteFile: ${args.filePath || ""}`;
      break;
    case "moveFile":
      icon = "📦";
      desc = `moveFile: ${args.sourcePath} -> ${args.destinationPath}`;
      break;
    case "runCommand":
      icon = "⚙ ";
      desc = `runCommand: ${args.command || ""}`;
      break;
    case "gitStatus":
      icon = "🌿";
      desc = "gitStatus";
      break;
    case "gitDiff":
      icon = "📊";
      desc = "gitDiff";
      break;
    case "gitLog":
      icon = "📜";
      desc = `gitLog (last ${args.count || 5} commits)`;
      break;
    case "analyzeProject":
      icon = "🔎";
      desc = "analyzeProject: inspecting tech stack and scripts";
      break;
    case "getProjectStructure":
      icon = "📁";
      desc = "getProjectStructure";
      break;
    default:
      desc = `${name}(${JSON.stringify(args)})`;
  }

  console.log(`\n${COLORS.cyan}${icon} ${desc}${COLORS.reset}`);
}

function toolSuccess(name, summary) {
  console.log(`  ${COLORS.green}✓${COLORS.reset} ${summary}`);
}

function toolFailure(name, error) {
  console.log(`  ${COLORS.red}✗${COLORS.reset} ${error}`);
}

function diffCard(filePath, diffText, action = "MODIFY") {
  console.log(`\n${COLORS.cyan}────────────────────────────────────────${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.yellow}FILE CHANGE (${action})${COLORS.reset}`);
  console.log(`${COLORS.cyan}────────────────────────────────────────${COLORS.reset}`);
  console.log(`${COLORS.bold}${filePath}${COLORS.reset}\n`);
  console.log(colorizeDiff(diffText) || `${COLORS.dim}(no content diff)${COLORS.reset}`);
  console.log(`${COLORS.cyan}────────────────────────────────────────${COLORS.reset}`);
}

function dangerousCommandAlert(command, reason, category = "DESTRUCTIVE") {
  console.log(`\n${COLORS.red}╔══════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.red}║ ⚠️  DANGEROUS COMMAND REQUESTED (${category})  ║${COLORS.reset}`);
  console.log(`${COLORS.red}╚══════════════════════════════════════════════════╝${COLORS.reset}`);
  console.log(`${COLORS.bold}Command:${COLORS.reset} ${COLORS.yellow}${command}${COLORS.reset}`);
  console.log(`${COLORS.bold}Reason:${COLORS.reset}  ${reason}\n`);
}

function summaryCard(whatChanged = [], filesChanged = [], verifications = [], remaining = []) {
  console.log(`\n${COLORS.cyan}╭────────────────── TASK SUMMARY ──────────────────╮${COLORS.reset}`);

  if (whatChanged.length > 0) {
    console.log(`\n${COLORS.bold}What I Changed:${COLORS.reset}`);
    whatChanged.forEach((item) => console.log(`  • ${item}`));
  }

  if (filesChanged.length > 0) {
    console.log(`\n${COLORS.bold}Files Changed:${COLORS.reset}`);
    filesChanged.forEach((file) => console.log(`  • ${file}`));
  }

  if (verifications.length > 0) {
    console.log(`\n${COLORS.bold}Verification:${COLORS.reset}`);
    verifications.forEach((v) => {
      const icon = v.passed ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
      console.log(`  ${icon} ${v.command}: ${v.message}`);
    });
  }

  if (remaining.length > 0) {
    console.log(`\n${COLORS.bold}${COLORS.yellow}Remaining Issues:${COLORS.reset}`);
    remaining.forEach((item) => console.log(`  • ${item}`));
  }

  console.log(`\n${COLORS.cyan}╰──────────────────────────────────────────────────╯${COLORS.reset}\n`);
}

module.exports = {
  COLORS,
  banner,
  divider,
  toolStart,
  toolSuccess,
  toolFailure,
  diffCard,
  dangerousCommandAlert,
  summaryCard,
};
