import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// OMP 不传 systemPromptOptions，cwd 在 ctx 上；本套件跑内嵌源
delete process.env.OMP_PURGE_SOURCE;
delete process.env.PI_PURGE_SOURCE;

// OMP 18.x before_agent_start 的真实形态：字符串数组（主提示词 + 项目上下文）
const REAL_OMP_PROMPT = [
	`RFC 2119 keywords: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL.

§ Role
You are omp's trusted coding assistant.

# Engineering
- Correctness, then six-month maintainability.

§ Tool Policy
- Prefer dedicated tools over bash.`,
	`<project-context>
<workstation>
- OS: darwin 27.2.0
</workstation>
</project-context>`,
];

const events = new Map();
const commands = new Map();
const notes = [];

const pi = {
	on: (name, handler) => events.set(name, handler),
	registerCommand: (name, options) => commands.set(name, options),
};

const mod = await import(pathToFileURL(join(import.meta.dirname, "..", "extensions", "omp-purge.ts")).href);
mod.default(pi);

const ctx = {
	cwd: "/Users/me/project",
	ui: {
		setStatus: () => {},
		notify: (text, level) => notes.push([level ?? "info", text]),
	},
};
const cmd = commands.get("purge");
const before = events.get("before_agent_start");
const start = events.get("session_start");
const lastNote = () => notes.at(-1)?.[1] ?? "";
const inject = () => before({ type: "before_agent_start", prompt: "hi", systemPrompt: REAL_OMP_PROMPT }, ctx);

await start({ reason: "startup" }, ctx);
assert.equal(await inject(), undefined, "默认关闭，不碰系统提示词");
await cmd.handler("on", ctx);

// 1. strict：返回数组，只留人设 + ctx.cwd
const strict = (await inject()).systemPrompt;
assert.ok(Array.isArray(strict), "OMP 传数组就返回数组");
assert.equal(strict.length, 2);
assert.ok(strict[0].includes("helpful assistant"), "内嵌人设在首段");
assert.equal(strict[1], "Current working directory: /Users/me/project", "strict 从 ctx.cwd 取工作目录");

// 2. replace：切掉 OMP 身份句，其余段和项目上下文保留
await cmd.handler("mode replace", ctx);
const replaced = (await inject()).systemPrompt;
assert.equal(replaced.length, 3, "人设 + 宿主两段");
assert.ok(!replaced.join("\n").includes("You are omp's trusted coding assistant."), "replace 切除 OMP 身份句");
for (const keep of ["§ Role", "# Engineering", "§ Tool Policy", "<project-context>"]) {
	assert.ok(replaced.join("\n").includes(keep), `replace 保留宿主结构: ${keep}`);
}
await cmd.handler("status", ctx);
assert.match(lastNote(), /身份段 已切除/, "status 反映 OMP 身份段已切除");

// 3. append：宿主各段原样跟在人设后面
await cmd.handler("mode append", ctx);
const appended = (await inject()).systemPrompt;
assert.deepEqual(appended.slice(1), REAL_OMP_PROMPT, "append 不动宿主各段");

// 4. 传入数组没有被原地修改
assert.ok(REAL_OMP_PROMPT[0].includes("You are omp's trusted coding assistant."), "不改动 OMP 传入的数组");

console.log("OK — OMP 断言全部通过");
