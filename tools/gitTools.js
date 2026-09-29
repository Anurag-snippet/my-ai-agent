// tools/gitTools.js
// Compatibility shim forwarding to src/tools/gitTools.js

const gitTools = require("../src/tools/gitTools");

module.exports = {
  ...gitTools,
  gitStatus: () => {
    const res = gitTools.gitStatus();
    return res.success ? res.data.raw : (res.error?.message || "");
  },
  gitDiff: (args) => {
    const res = gitTools.gitDiff(args);
    return res.success ? res.data.diff : (res.error?.message || "");
  },
  gitLog: (args) => {
    const res = gitTools.gitLog(args);
    return res.success ? res.data.raw : (res.error?.message || "");
  },
};
