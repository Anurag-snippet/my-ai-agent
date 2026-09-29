// src/utils/errors.js
// Standardized tool results and errors for consistent agent communication

class AgentError extends Error {
  constructor(message, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.details = details;
  }
}

function successResult(data, metadata = {}) {
  return {
    success: true,
    data,
    error: null,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };
}

function errorResult(message, code = "TOOL_ERROR", details = null, metadata = {}) {
  return {
    success: false,
    data: null,
    error: {
      message: typeof message === "string" ? message : (message?.message || String(message)),
      code,
      details,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };
}

module.exports = {
  AgentError,
  successResult,
  errorResult,
};
