// agent/diff.js
// Compatibility shim forwarding to src/utils/diff.js

const {
  createUnifiedDiff,
  createDiff,
  colorizeDiff,
} = require("../src/utils/diff");

module.exports = {
  createUnifiedDiff,
  createDiff,
  colorizeDiff,
};
