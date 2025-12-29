const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

async function runPowerShell(command, { timeoutMs = 30000 } = {}) {
  const isWindows = process.platform === "win32";
  if (!isWindows) {
    const err = new Error("PowerShell printing is only supported on Windows.");
    err.code = "NOT_WINDOWS";
    throw err;
  }

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
  );
  return String(stdout || "");
}

module.exports = { runPowerShell };
