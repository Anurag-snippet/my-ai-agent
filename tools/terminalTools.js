const { execSync } = require("child_process");

const ALLOWED_COMMANDS = [
    "node",
    "npm",
    "npx",
    "git"
];

function runCommand({ command }) {

    const commandName = command.trim().split(/\s+/)[0];

    if (!ALLOWED_COMMANDS.includes(commandName)) {
        throw new Error(
            `Command "${commandName}" is not allowed.`
        );
    }

    try {

        const output = execSync(command, {
            cwd: process.cwd(),
            encoding: "utf-8",
            timeout: 10000
        });

        return {
            success: true,
            output: output
        };

    } catch (error) {

        return {
            success: false,
            output: error.stdout || error.message
        };
    }
}

module.exports = {
    runCommand
};
