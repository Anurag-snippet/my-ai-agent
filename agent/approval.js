// agent/approval.js
// Compatibility shim forwarding to src/agent/ApprovalManager.js

const {
  ApprovalManager,
  getApprovalManager,
  askForApproval,
} = require("../src/agent/ApprovalManager");

module.exports = {
  ApprovalManager,
  getApprovalManager,
  askForApproval,
};
