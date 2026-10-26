# omp-purge

[English](README.md) | [中文](README.zh-CN.md)

An [oh-my-pi (omp)](https://github.com/can1357/oh-my-pi) extension for system-prompt experiments. `/purge` selects the system prompt that a session runs with: the stock omp prompt, a trimmed variant, or only a persona prompt.

It is a fork of [ZiChuanLan/pi-purge](https://github.com/ZiChuanLan/pi-purge), adapted to the omp extension API. It still loads in [pi](https://github.com/earendil-works/pi-coding-agent).

Use it for prompt engineering work:

- Compare how the same request behaves when the harness prompt is present, trimmed, or absent.
- Regression-test your own instructions.
- Study instruction-following and prompt-injection robustness under controlled conditions.

When it is off, nothing changes. It does not rewrite the prompt and does not read the disk.

## Install

```bash
omp plugin install github:kvxunz/omp-purge
omp plugin list      # omp-purge must show here
```

Then, inside a session:

```text
/purge
```

A short example prompt ships inside the package, so a fresh install needs no extra files. To run your own instructions:

```text
/purge source /Users/me/prompts/my-instructions.md
/purge mode replace
/purge on
```

`/purge source embedded` switches back to the bundled persona.

To uninstall:

```bash
omp plugin uninstall omp-purge
```

## Commands

| Command | Effect |
| --- | --- |
| `/purge` | Toggle on/off for this session |
| `/purge on` / `off` | Enable or disable the rewrite |
| `/purge status` | Mode, prompt source, loaded size, and what the previous turn actually changed |
| `/purge mode append\|replace\|strict` | Switch composition mode (default `strict`) |
| `/purge source <path\|embedded>` | Change the prompt file, or go back to the bundled example; a failed switch rolls back |
| `/purge reload` | Re-read an external prompt file after editing it |

## Modes

| Mode | System prompt sent to the model | Use it when |
| --- | --- | --- |
| `append` | Your prompt, then the host prompt, unchanged. | You want a control run: baseline behavior plus your instructions on top. |
| `replace` | Your prompt, then the host prompt without its assistant identity line and pi's bundled documentation section. Tool list, guidelines, and project context stay. | You want to measure the effect of the harness framing without losing tool context. |
| `strict` | Your prompt plus `Current working directory: …` only. | You want to isolate your instructions as a single variable. This is the default. |

`replace` finds the sections by exact wording. If a host update rewords them, it keeps the prompt intact and does not cut the wrong text. `/purge status` then reports `身份段 未匹配` (identity line not found), and behavior falls back to `append`. `strict` does no matching, so it behaves the same across versions.

Tool schemas go through the API `tools` parameter, not the system prompt. Tools work in every mode, including `strict`.

## How it works in omp

pi and omp give the `before_agent_start` hook different data. omp-purge handles both:

```text
                 pi                         omp
event.systemPrompt  string                  string[]  [main prompt, project context]
working directory   systemPromptOptions.cwd ctx.cwd
identity line       "You are an expert      "You are omp's trusted
                     coding assistant …"     coding assistant."
returned prompt     string                  string[] (same shape as received)
```

- `append` / `replace` process each array part on its own, then return an array. omp keeps its section layout.
- `strict` reads the working directory from `ctx.cwd` in omp.
- `replace` removes the omp identity line in the `§ Role` section. omp has no pi documentation section, so nothing else is cut.

## Session scope and defaults

- Scope is the session. Every `session_start` (startup, `new`, `resume`, `reload`) begins **disabled**. When you quit omp, the stock behavior comes back.
- Nothing is written to disk: no state file, no cache, no marker. Two omp processes cannot affect each other.
- The default prompt is the short example bundled inside `extensions/omp-purge.ts`. `/purge source <path>` points at your own file. `/purge source embedded` comes back.
- To start every process with your own file without writing state, set `OMP_PURGE_SOURCE` to an absolute path:

    ```bash
    OMP_PURGE_SOURCE=/home/me/persona.md omp          # macOS / Linux
    set OMP_PURGE_SOURCE=C:/prompts/persona.md         # Windows cmd
    $env:OMP_PURGE_SOURCE='C:/prompts/persona.md'      # Windows PowerShell
    ```

    It only sets the initial value of `source`. You must still run `/purge on`. `enabled` still begins `false` on every `session_start`. `/purge source <path>` in a session overrides it. If the file is missing, `/purge on` reports the error. It does not fall back to the bundled example.

    The old name `PI_PURGE_SOURCE` still works as a fallback. `OMP_PURGE_SOURCE` wins when both are set.
- The bundled text is deliberately minimal. Keep your full prompt on disk and reference it with `/purge source`.
- The default mode is `strict`.

## Notes for experiments

- `strict` also drops `AGENTS.md` / project context, the skills list, and prompt text from other extensions. That makes it a clean single-variable setup. It also makes `strict` results not comparable to a normal session.
- `append` is the least invasive mode and usually gives the weakest signal. Later sections of the harness prompt still carry a lot of weight.
- `replace` still leaves harness text behind, and other extensions can append their own sections after this one. In practice only `strict` keeps the persona free from other framing.
- Extension load order affects what `before_agent_start` sees. Record `/purge status` output with any results you keep.

## Development

```bash
npm test   # four suites; all run against temporary agent dirs and assert nothing is written
```

| Suite | Covers |
| --- | --- |
| `omp-purge.test.mjs` | Commands, modes, and the pi string prompt |
| `omp-purge-host.test.mjs` | The omp array prompt and `ctx.cwd` |
| `omp-purge-env-source.test.mjs` | `OMP_PURGE_SOURCE` |
| `omp-purge-env-legacy.test.mjs` | `PI_PURGE_SOURCE` fallback |

The extension registers one `before_agent_start` hook, one `session_start` hook, and a `/purge` command. It has no other hooks, no background work, and no file writes.

To work on a local copy, link it instead of installing:

```bash
omp plugin link /path/to/omp-purge
```

## Credits

- [ZiChuanLan/pi-purge](https://github.com/ZiChuanLan/pi-purge): the original pi extension. omp-purge is a fork of it.
- [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge): the idea of **removing** the harness identity line rather than drowning it out, the three composition modes, and the bundled prompt come from that project. Credited and linked here as its author requires.

## Legal and compliance notice

**Non-profit, study and research only.** Users bear full responsibility for how they use this software. It must not be used for any unlawful purpose.

**Zero tolerance.** The authors do not support, encourage, or assist unauthorized network attacks, exploitation, data theft, intrusion into information systems, or the generation of illegal content. Any such use is unrelated to the authors, and the person doing it bears the full legal responsibility alone.

**No illegal content.** The code, docs, and bundled prompt are not malware, backdoors, unauthorized penetration tooling, ransomware, credential-stuffing scripts, or attack payloads aimed at public or third-party systems.

**Local use on your own host only.** Prompt substitution happens entirely inside the omp (or pi) installation on the user's own machine (the local agent directory and profile). The target is your own local software, not someone else's website, server, account, or information system.

**No outbound networking.** This extension only rewrites the system prompt inside the local process. It opens no network connections, and it does not scan, probe, intrude on, or send attack traffic to any public host or unauthorized system. Do not use it as a stepping stone against external networks.

**Authorized, controlled scope only.** This is an aid for prompt-engineering and robustness evaluation on an omp or pi installation you are entitled to administer. Do not run it against targets you lack written authorization for, against public online systems, or in production. All testing must stay within your own authorized local omp or pi, offline synthetic fixtures, authorized exercise ranges, and compliant lab environments.

**Mainland China, Hong Kong, and Macao are off limits.** Do not access, scan, probe, or otherwise operate against networks in mainland China, Hong Kong, or Macao, nor against servers, sites, or addresses that resolve into those ranges. Naming a cloud provider is not an exception. The only exception is the single exact IP or the single fully qualified hostname the user has registered beforehand as their own server. Keys, passwords, CIDR blocks, wildcards, and verbal statements in a conversation add no exception. Unregistered means prohibited, without exception.

**Prohibited uses.** Users must not use this project, directly or indirectly, to violate any of the following, and must comply with each without exception:

- Criminal Law of the People's Republic of China
- Cybersecurity Law of the People's Republic of China
- Data Security Law of the People's Republic of China
- Personal Information Protection Law of the People's Republic of China
- Any other applicable laws, administrative regulations, and regulatory requirements

Also prohibited: unauthorized penetration or attack against public or private information systems, extortion, damage, credential stuffing, or malware distribution; producing or spreading content that endangers national security, promotes terrorism or graphic violence, is obscene or gambling-related, fraudulent, or infringes privacy or intellectual property; and violating the terms of service or abuse policies of any model provider.

**User assumes all liability.** This project is provided "as is" under the MIT License, without warranty of any kind, express or implied, as to completeness, security, or fitness for purpose. Users bear sole and complete civil, administrative, and criminal liability for their own download, deployment, execution, modification, and distribution of this software, and for all inputs and outputs that result. The authors and contributors accept no direct, indirect, or consequential liability arising from misuse.

**License terminates on breach.** Any person or entity that uses this project for illegal attacks, malicious activity, or other violations has its open-source license terminated automatically and irrevocably from the date of the violation. That party must stop using the project immediately, permanently destroy all copies of its code, scripts, and derived data, and face the applicable legal consequences.

**Third-party independence.** This is a fully independent open-source security research project. It has no affiliation, commercial partnership, authorization, or official endorsement from omp, pi, or any related entity. It does not mean omp or pi develops, endorses, or vouches for this extension.

**Attribution required.** Anyone reusing this project's name, approach, code, or prompt must credit the author and link this repository. Failure to attribute will be pursued legally.

## License

MIT

---

感谢 [LINUX DO](https://linux.do) 社区
