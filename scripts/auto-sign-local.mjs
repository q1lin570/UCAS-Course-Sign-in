#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const configPath = join(projectRoot, "config", "ucas-account.json");
const baseUrl = getBaseUrl(process.argv.slice(2));
const intervalMs = 60 * 1000;

function getBaseUrl(args) {
	const index = args.indexOf("--base-url");
	return (index >= 0 ? args[index + 1] : "http://127.0.0.1:3000").replace(/\/+$/, "");
}

async function readConfig() {
	const raw = await readFile(configPath, "utf8");
	const config = JSON.parse(raw);
	if (
		typeof config?.cronSecret !== "string" ||
		!config.cronSecret.trim() ||
		config.cronSecret.includes("填入")
	) {
		throw new Error(`请先填写 ${configPath} 中的 cronSecret`);
	}
	return { cronSecret: config.cronSecret.trim() };
}

async function trigger(config) {
	try {
		const response = await fetch(`${baseUrl}/api/course-uuid/cron-sign`, {
			headers: {
				Authorization: `Bearer ${config.cronSecret}`
			},
			cache: "no-store"
		});
		const body = await response.text();
		console.log(`[${new Date().toISOString()}] auto-sign ${response.status}: ${body}`);
	} catch (error) {
		console.error(`[${new Date().toISOString()}] auto-sign request failed: ${error.message}`);
	}
}

try {
	const config = await readConfig();
	console.log(`Local auto-sign scheduler started for ${baseUrl}`);
	await trigger(config);
	const timer = setInterval(() => void trigger(config), intervalMs);

	const stop = () => {
		clearInterval(timer);
		console.log("Local auto-sign scheduler stopped");
		process.exit(0);
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
} catch (error) {
	console.error(`Unable to start local auto-sign scheduler: ${error.message}`);
	process.exit(1);
}
