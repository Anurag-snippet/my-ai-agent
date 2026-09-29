// agent/commandSafety.js
// Compatibility shim forwarding to src/safety/commandSafety.js

const {
  CATEGORIES,
  classifyCommand,
  isDangerousCommand,
} = require("../src/safety/commandSafety");

module.exports = {
  CATEGORIES,
  classifyCommand,
  isDangerousCommand,
};