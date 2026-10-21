const { spawn } = require("node:child_process");
const path = require("node:path");
const electron = require("electron");
const environment = { ...process.env, E01_AUTOMATED_PROOF: "1" };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ["."], {
  cwd: path.join(__dirname, ".."),
  env: environment,
  stdio: "inherit",
});
child.on("exit", code => process.exitCode = code ?? 1);
