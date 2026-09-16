#!/usr/bin/env node

import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
	spawn(npmCommand, ["run", "start"], { stdio: "inherit" }),
	spawn(npmCommand, ["run", "auto-sign"], { stdio: "inherit" })
];
let shuttingDown = false;

function shutdown(exitCode = 0) {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;
	for (const child of children) {
		if (!child.killed) {
			child.kill("SIGTERM");
		}
	}
	setTimeout(() => process.exit(exitCode), 500);
}

for (const child of children) {
	child.on("error", (error) => {
		console.error(`Failed to start child process: ${error.message}`);
		shutdown(1);
	});
	child.on("exit", (code, signal) => {
		if (!shuttingDown && (code ?? 1) !== 0) {
			console.error(`Child process stopped unexpectedly: code=${code ?? "null"}, signal=${signal ?? "null"}`);
			shutdown(code ?? 1);
		}
	});
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
