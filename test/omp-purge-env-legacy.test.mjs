import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// 旧名 PI_PURGE_SOURCE 仍然生效；OMP_PURGE_SOURCE 未设置时才回退到它
const SOURCE_DIR = mkdtempSync(join(tmpdir(), "omp-purge-legacy-src-"));
const SOURCE_FILE = join(SOURCE_DIR, "persona.md");
writeFileSync(SOURCE_FILE, "# Legacy persona", "utf8");
delete process.env.OMP_PURGE_SOURCE;
process.env.PI_PURGE_SOURCE = SOURCE_FILE;

const events = new Map();
const commands = new Map();
const notes = [];
const pi = {
	on: (name, handler) => events.set(name, handler),
	registerCommand: (name, options) => commands.set(name, options),
};

const mod = await import(pathToFileURL(join(import.meta.dirname, "..", "extensions", "omp-purge.ts")).href);
mod.default(pi);

const ctx = { ui: { setStatus: () => {}, notify: (text, level) => notes.push([level ?? "info", text]) } };

try {
	await events.get("session_start")({ reason: "startup" }, ctx);
	await commands.get("purge").handler("on", ctx);
	const sp = (await events.get("before_agent_start")({ systemPrompt: "HOST PROMPT" }, ctx)).systemPrompt;
	assert.ok(sp.startsWith("# Legacy persona"), "PI_PURGE_SOURCE 作为旧名仍然生效");
	console.log("OK — PI_PURGE_SOURCE 旧名断言通过");
} finally {
	rmSync(SOURCE_DIR, { recursive: true, force: true });
}
