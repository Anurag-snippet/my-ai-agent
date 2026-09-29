// src/ui/spinner.js
// Terminal progress indicator with non-TTY fallback

class Spinner {
  constructor(message = "") {
    this.message = message;
    this.frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    this.frameIndex = 0;
    this.timer = null;
    this.isSpinning = false;
    this.isTTY = Boolean(process.stdout.isTTY);
  }

  start(newMessage) {
    if (newMessage) this.message = newMessage;
    if (this.isSpinning) return this;

    this.isSpinning = true;
    if (!this.isTTY) {
      console.log(`... ${this.message}`);
      return this;
    }

    this.timer = setInterval(() => {
      const frame = this.frames[this.frameIndex % this.frames.length];
      this.frameIndex++;
      process.stdout.write(`\r\x1b[36m${frame}\x1b[0m ${this.message}   `);
    }, 80);

    return this;
  }

  update(newMessage) {
    this.message = newMessage;
    if (!this.isTTY) {
      console.log(`... ${this.message}`);
    }
  }

  stop() {
    if (!this.isSpinning) return;
    this.isSpinning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.isTTY) {
      process.stdout.write("\r\x1b[K"); // Clear line
    }
  }

  succeed(message) {
    this.stop();
    const text = message || this.message;
    console.log(`\x1b[32m✓\x1b[0m ${text}`);
  }

  fail(message) {
    this.stop();
    const text = message || this.message;
    console.log(`\x1b[31m✗\x1b[0m ${text}`);
  }

  info(message) {
    this.stop();
    const text = message || this.message;
    console.log(`\x1b[34mℹ\x1b[0m ${text}`);
  }
}

module.exports = { Spinner };
