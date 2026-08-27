const readline = require("readline");

function askForApproval(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `${message} [y/n]: `,
      (answer) => {
        rl.close();

        resolve(
          answer.trim().toLowerCase() === "y"
        );
      }
    );
  });
}

module.exports = {
  askForApproval,
};

