const dangerousPatterns = [
  /rm\s+-rf/i,
  /del\s+\/[a-z]:/i,
  /rmdir\s+\/s/i,
  /format\s+/i,
  /shutdown/i,
  /restart-computer/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fd/i,
];

function isDangerousCommand(command) {
  return dangerousPatterns.some((pattern) =>
    pattern.test(command)
  );
}

module.exports = {
  isDangerousCommand,
};