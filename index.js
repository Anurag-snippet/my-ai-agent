require("dotenv").config();
const { startCli } = require("./src/ui/cli");
const { Agent, runAgent } = require("./src/agent/Agent");

if (require.main === module) {
  startCli().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

module.exports = {
  startCli,
  Agent,
  runAgent,
};