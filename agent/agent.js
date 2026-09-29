// agent/agent.js
// Compatibility shim forwarding to src/agent/Agent.js

const { Agent, runAgent } = require("../src/agent/Agent");
const { toolDeclarations } = require("../src/tools");

module.exports = {
  Agent,
  runAgent,
  toolDeclarations,
};