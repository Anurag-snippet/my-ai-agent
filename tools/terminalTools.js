// tools/terminalTools.js
// Compatibility shim forwarding to src/tools/terminalTools.js

const { runCommand } = require("../src/tools/terminalTools");

module.exports = {
  runCommand: (args) => {
    const res = runCommand(args);
    if (res.success) {
      return {
        success: true,
        output: res.data?.stdout || "",
      };
    }
    return {
      success: false,
      output: res.error?.details?.stdout || "",
      error: res.error?.message || "Execution error",
    };
  },
};