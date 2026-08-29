const { execSync } = require("child_process");

function runCommand({ command }) {
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });

    return {
      success: true,
      output: output.trim(),
    };
  } catch (error) {
    return {
      success: false,
      output: error.stdout?.toString().trim() || "",
      error: error.stderr?.toString().trim() || error.message,
    };
  }
}

module.exports = {
  runCommand,
};