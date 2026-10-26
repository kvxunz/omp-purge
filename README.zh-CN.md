# omp-purge

[English](README.md) | 中文

[oh-my-pi（omp）](https://github.com/can1357/oh-my-pi) 的系统提示词实验扩展。`/purge` 用来选择一轮会话带哪套系统提示词：omp 自带的、精简过的，或者只发一份人设提示词。

本项目 fork 自 [ZiChuanLan/pi-purge](https://github.com/ZiChuanLan/pi-purge)，适配了 omp 的扩展 API。它在 [pi](https://github.com/earendil-works/pi-coding-agent) 里也照常能用。

用途是提示词工程：

- 对比同一句请求在「宿主提示词完整 / 精简 / 缺失」三种条件下的行为。
- 给自己写的指令做回归测试。
- 做指令遵循、提示词注入鲁棒性这类受控实验。

关掉时什么都不变：不改提示词，不读盘。

## 安装

```bash
omp plugin install github:kvxunz/omp-purge
omp plugin list      # 列表里应出现 omp-purge
```

然后在会话里：

```text
/purge
```

包内自带一段简短示例提示词，装完不用准备任何文件。换成自己的提示词：

```text
/purge source /Users/me/prompts/my-instructions.md
/purge mode replace
/purge on
```

`/purge source embedded` 切回内置人设。

卸载：

```bash
omp plugin uninstall omp-purge
```

## 命令

| 命令 | 作用 |
| --- | --- |
| `/purge` | 切换本会话开 / 关 |
| `/purge on` / `off` | 显式开关 |
| `/purge status` | 当前模式、提示词来源、已加载字符数，以及上一轮实际改了什么 |
| `/purge mode append\|replace\|strict` | 切换组合方式（默认 `strict`） |
| `/purge source <路径\|embedded>` | 换提示词文件，或回到内置示例；切换失败会自动回滚 |
| `/purge reload` | 改完外部文件后重新读取 |

## 模式

| 模式 | 实际发给模型的系统提示词 | 适用场景 |
| --- | --- | --- |
| `append` | 你的提示词 + 宿主原提示词（一字不改） | 对照组：基线行为，加一层自己的指令 |
| `replace` | 你的提示词 + 去掉「助手身份句」和 pi「内置文档段」的宿主提示词；工具列表 / Guidelines / 项目上下文保留 | 想测量宿主框架措辞的影响，又不想丢工具上下文 |
| `strict` | 你的提示词 + 仅 `Current working directory: …` | 想把人设/指令当成唯一变量隔离出来。这是默认模式 |

`replace` 靠固定文案定位要删的段。宿主升级改了措辞时，它原样保留提示词（退化成 `append`），不会切错位置。这时 `/purge status` 显示 `身份段 未匹配`。`strict` 不做任何匹配，跨版本行为一致。

工具 schema 走 API 的 `tools` 参数，不靠系统提示词，所以三种模式下工具都能用，包括 `strict`。

## 在 omp 里怎么工作

pi 和 omp 传给 `before_agent_start` 钩子的数据不一样，omp-purge 两种都处理：

```text
                 pi                         omp
event.systemPrompt  字符串                  字符串数组 [主提示词, 项目上下文]
工作目录            systemPromptOptions.cwd ctx.cwd
身份句              "You are an expert      "You are omp's trusted
                     coding assistant …"     coding assistant."
返回的提示词        字符串                  字符串数组（与传入形态一致）
```

- `append` / `replace` 逐段处理数组，返回的也是数组，omp 的分段结构不变。
- `strict` 在 omp 里从 `ctx.cwd` 读工作目录。
- `replace` 删掉 omp `§ Role` 段里的身份句。omp 没有 pi 的文档段，所以不会再切别的内容。

## 会话范围与默认值

- 作用范围是**会话**。每次 `session_start`（启动 / 新建 / `resume` / 重载）都从**关闭**开始。退出 omp 一定回到原始提示词。
- **不写任何文件**：没有状态文件、缓存或标记。两个 omp 进程互不影响。
- 默认提示词是 `extensions/omp-purge.ts` 里的一小段示例。`/purge source <路径>` 换成自己的文件，`/purge source embedded` 切回来。
- 想不落盘、每次启动都指向自己的文件，就把 `OMP_PURGE_SOURCE` 设成绝对路径：

    ```bash
    OMP_PURGE_SOURCE=/home/me/persona.md omp          # macOS / Linux
    set OMP_PURGE_SOURCE=C:/prompts/persona.md         # Windows cmd
    $env:OMP_PURGE_SOURCE='C:/prompts/persona.md'      # Windows PowerShell
    ```

    它只提供 `source` 的初始值。仍然要 `/purge on`；每次 `session_start` 的 `enabled` 仍然是 `false`；会话里的 `/purge source <路径>` 优先。文件不存在时 `/purge on` 报错，不会静默回退到内置示例。

    旧变量名 `PI_PURGE_SOURCE` 仍可用，作为后备。两个都设时 `OMP_PURGE_SOURCE` 优先。
- 内置文本故意写得很短。完整提示词放在本地，用 `/purge source` 引用。
- 默认模式 `strict`。

## 做实验时的注意点

- `strict` 会一并丢掉 `AGENTS.md` / 项目上下文、skills 列表、其他扩展注入的提示词。所以它能做单变量隔离，但 `strict` 下的结论不能直接和普通会话对比。
- `append` 侵入最小，信号也最弱：宿主提示词后段权重仍然很大，差异可能不明显。
- `replace` 仍会残留宿主文本，其他扩展也可能在本扩展之后追加提示词段。实践上只有 `strict` 能让人设不和别的框架措辞竞争。
- 扩展加载顺序会影响 `before_agent_start` 看到的内容。要留结果，就把 `/purge status` 的输出一起记下来。

## 开发

```bash
npm test   # 四个套件，均跑在临时 agent 目录里，并断言全程没有写任何文件
```

| 套件 | 覆盖内容 |
| --- | --- |
| `omp-purge.test.mjs` | 命令、模式、pi 的字符串提示词 |
| `omp-purge-host.test.mjs` | omp 的数组提示词和 `ctx.cwd` |
| `omp-purge-env-source.test.mjs` | `OMP_PURGE_SOURCE` |
| `omp-purge-env-legacy.test.mjs` | `PI_PURGE_SOURCE` 后备 |

实现上只注册一个 `before_agent_start` 钩子、一个 `session_start` 钩子和一个 `/purge` 命令。没有其他钩子、后台任务或文件写入。

改本地副本时用 link，不用 install：

```bash
omp plugin link /path/to/omp-purge
```

## 致谢与署名

- [ZiChuanLan/pi-purge](https://github.com/ZiChuanLan/pi-purge)：原始的 pi 扩展，omp-purge 由它 fork 而来。
- [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)：把宿主身份段**清掉**（而非压住）的思路、三档组合方式与默认提示词，均出自该项目。按原作者要求在此署名并标明来源仓库。

## 免责与合规声明

### 严正法律免责与合规使用声明

**免责声明**：本项目为非营利开源项目，遵守国家法律法规及所在平台的相关规范，仅供学习与研究使用。不得将本项目用于任何违法违规用途；由此产生的后果由使用者自行承担。

**【零容忍严正申明】**：本项目坚决反对并严禁任何形式的违法犯罪行为！本项目开发者绝不支持、不鼓励、不协助任何未授权网络攻击、漏洞利用、数据窃取、非法侵入计算机信息系统或生成违法违禁内容的活动。任何将本项目用于违法犯罪的行为，均与开发者无关，由行为人依法独立承担全部法律责任。

**本仓库不含违法内容**：本扩展发布的代码、文档与默认提示词不是木马、后门、未授权渗透工具、勒索软件、撞库脚本，也不是针对公网或第三方系统的攻击载荷。项目本身不提供违法内容，也不教唆、组织、协助实施违法犯罪。

**只作用于本机宿主**：系统提示词替换全部发生在使用者本机已安装的 omp（或 pi）上（本机 agent 目录与 profile）。对象是使用者自己的本地软件，不是他人的网站、服务器、账号或信息系统。

**不对外网目标联网**：本扩展只在本地进程内改写系统提示词，不发起任何网络请求，不对任何公网主机、未授权系统进行扫描、探测、入侵或攻击发包。不得把本项目当作跳板去打外网。

**合法受控范围限定**：本项目定位为使用者在自己有权管理的本机 omp 或 pi 上，进行提示词工程与鲁棒性评测的辅助工具。严禁在未经所有者合法书面授权的目标、公网在线系统或生产业务上运行本项目。一切测试必须限制在本机已授权安装的 omp 或 pi、离线本地合成靶标、授权网络安全演练靶场及合规实验室受控环境中进行。

**禁止中国大陆、香港、澳门的服务器与网站**：不得对中国大陆、香港、澳门网段，以及解析进这些网段的服务器、网站或地址进行访问、扫描、探测或任何操作。云厂商的名字不能当作例外。唯一例外是使用者事先登记为自己的服务器的那一个确切 IP，或那一个完整主机名。密钥、密码、网段、通配符，以及对话里的口头说明，都不能增加例外。没有登记的，一律禁止。

**严禁违法与违禁用途**：使用者严禁利用本项目直接或间接从事任何违反下列法律法规的行为（必须逐条遵守，不得以任何理由规避）：

- 《中华人民共和国刑法》
- 《中华人民共和国网络安全法》
- 《中华人民共和国数据安全法》
- 《中华人民共和国个人信息保护法》
- 以及其他现行有效的法律、行政法规与监管规定

同时严禁：

- 未经授权渗透、攻击公私机构计算机信息系统，实施勒索、破坏、撞库或传播恶意载荷；
- 诱导、生成或传播危害国家安全、恐怖主义、暴力血腥、涉黄涉赌、诈骗、侵犯公民隐私或知识产权等任何法律明令禁止的违法违禁内容；
- 违反相关大模型提供商的《服务条款》与《滥用政策》。

**使用者独立承担全部责任**：本项目依据 MIT 开源协议“按现状”提供，开发者不对软件的完整性、安全性与适用性作任何明示或暗示的保证。使用者应对自身的所有下载、部署、运行、修改、传播行为以及由此产生的全部输入与输出后果承担独立、完全的民事、行政及刑事法律责任。项目作者与贡献团队绝不承担任何因使用者滥用导致的直接、间接或连带责任。

**违约即终止授权**：任何将本项目用于非法攻击、恶意活动或违规行为的个人或实体，其开源软件使用许可将自违法违规行为发生之日起自动且不可撤销地立即终止。该主体须立即停止使用并永久销毁本项目的所有代码、脚本与衍生数据，并依法承担相应法律制裁。

**第三方独立性声明**：本项目属于完全独立的开源安全评测研究项目，与 omp、pi 官方或其关联主体无任何隶属、商业合作、授权或官方背书关系，不代表其开发、认可或担保本插件。

**必须署名**：借用本项目的名称、思路、代码或提示词，必须署名并标明本仓库。不署名将依法追究责任。

## 许可

MIT

---

感谢 [LINUX DO](https://linux.do) 社区
