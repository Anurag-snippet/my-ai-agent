// agent/prompts.js
// Compatibility shim forwarding to src/agent/prompts.js

const { SYSTEM_PROMPT, PLANNER_PROMPT } = require("../src/agent/prompts");

module.exports = {
  SYSTEM_PROMPT,
  PLANNER_PROMPT,
};