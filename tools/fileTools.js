// tools/fileTools.js
// Compatibility shim forwarding to src/tools/fileTools.js

const fileTools = require("../src/tools/fileTools");
const { getProjectStructure } = require("../src/tools/projectTools");
const { searchCode } = require("../src/tools/searchTools");

// Legacy fileTools.js directly returned un-nested content/results for some callers
module.exports = {
  ...fileTools,
  getProjectStructure: (args) => {
    const res = getProjectStructure(args);
    return res.success ? res.data.structure : [];
  },
  searchCode: (args) => {
    const res = searchCode(args);
    return res.success ? res.data.results : [];
  },
};
