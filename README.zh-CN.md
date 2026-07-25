# codex-session-renamer

[English](README.md) | [中文](README.zh-CN.md)

[![测试](https://github.com/RuntianLee/codex-session-renamer/actions/workflows/test.yml/badge.svg)](https://github.com/RuntianLee/codex-session-renamer/actions/workflows/test.yml)
[![许可证：MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

手动重新总结并重命名所有 Codex 根会话，统一生成 `YYYY-MM-DD｜核心内容总结`，不再直接拿首条消息充当标题。

> **免责声明。** 本项目由 AI 编程智能体协助完成，并已在作者本机测试。全量执行会修改所有 Codex 根会话标题，且没有内置回滚功能。安装前请先阅读 Skill 和脚本，并自行承担使用风险。

## 它能做什么

| 能力 | 行为 |
| --- | --- |
| 语义化标题 | 根据主要目标、实际结果或最终结论命名，不直接复制首条消息。 |
| 创建日期 | 在每个标题前加入会话创建日期。 |
| 手动全量执行 | 重新总结所有 Codex 根会话，包括已经带日期和已经归档的会话。 |
| 按会话选择语言 | 默认让每个标题跟随对应会话的主要用户语言。 |
| 显式指定语言 | `language=<language>` 可强制所有标题、进度信息和最终报告使用同一种语言。 |
| 本地上下文提取 | 每批读取 20 个会话的最近目标和最终结果。 |
| 范围保护 | 排除 ChatGPT 对话和子代理会话。 |
| 不创建自动化 | 永远不会创建或更新定时任务，每次执行都必须由你手动触发。 |

## 命名与语言规则

标题格式：

```text
YYYY-MM-DD｜核心内容总结
```

未指定语言时：

- 每个标题使用对应会话自己的主要用户语言；
- 进度信息和最终报告使用当前触发 Skill 的对话语言；
- 如果某个会话语言不明确，则依次回退到当前标题语言、触发会话语言。

显式指定语言时：

```text
language=English
language=zh-CN
language=ja
```

指定语言会同时作用于所有新标题和所有用户可见输出。项目名、产品名、代码标识符和通用技术术语会在合适时保留原文。

## 环境要求

- 带有本地会话管理工具的 OpenAI Codex 桌面版。
- 本地存在 `~/.codex/state_5.sqlite` 会话目录。
- Node.js 20 或更高版本。
- `sqlite3` 已加入 `PATH`。
- 已在 macOS 上测试；其他系统只有在 Codex 存储结构和依赖一致时才可能正常工作。

## 安装

```bash
git clone https://github.com/RuntianLee/codex-session-renamer.git
cd codex-session-renamer
./setup.sh
```

安装器会把 Skill 复制到：

```text
${CODEX_HOME:-~/.codex}/skills/codex-session-renamer
```

如果目标目录已经存在，`setup.sh` 会先把旧版本移动到带时间戳的备份目录，再安装新版本。

## 使用方法

### 自动判断语言

新建一个 Codex 会话并输入：

```text
使用 $codex-session-renamer 手动全量重新总结并重命名所有 Codex 根会话。
```

每个标题会使用它自己会话的语言；进度信息和报告则使用当前会话语言。

### 强制使用同一种语言

```text
使用 $codex-session-renamer language=English 手动全量重新总结并重命名所有 Codex 根会话。
```

可将 `English` 换成语言名称或 BCP-47 标签，例如 `zh-CN`、`ja`。

> **重要：** 该 Skill 每次都会执行全量重命名，不提供增量模式、定时模式、dry-run 或自动标题备份。

## 工作原理

1. Skill 先向 Codex 获取最近 50 个任务的高质量摘要。
2. `scripts/collect-session-contexts.mjs` 读取本地根会话目录，每批返回 20 个会话。
3. 对每个会话提取当前标题、最近两条有效用户目标和最终助手结果。
4. Codex 判断所需语言并生成简洁的核心内容标题。
5. 通过 Codex 官方 `set_thread_title` 工具改名，不直接写标题数据库。
6. 对归档任务，先临时解除归档，完成重命名后恢复原归档状态。
7. 持续处理，直到所有根会话都完成检查。

上下文收集脚本只读取本地元数据和 rollout 文件，不会写入 Codex 数据库或会话文件。

## 安全与隐私

| 范围 | 保证 |
| --- | --- |
| 会话内容 | 只在本地读取，用于提取精简的命名上下文。 |
| 数据库 | 收集脚本仅通过 `sqlite3` 查询读取 Codex SQLite 目录。 |
| 重命名 | 使用 Codex 官方会话工具，不直接更新标题数据库。 |
| 归档任务 | 重命名后恢复原来的归档状态。 |
| 排除范围 | 永不选择 ChatGPT 对话和子代理会话。 |
| 自动化 | Skill 明确禁止创建或更新自动化任务。 |
| 删除操作 | 永不删除会话、消息、记忆或项目文件。 |

## 运行测试

```bash
node --test tests/collect-session-contexts.test.mjs
```

测试只使用临时 SQLite 数据库和 rollout 夹具，绝不会读取或修改真实 Codex 会话数据。

如需在不触碰真实 Codex 目录的情况下测试安装和卸载：

```bash
TMP_CODEX_HOME="$(mktemp -d)"
CODEX_HOME="$TMP_CODEX_HOME" ./setup.sh
CODEX_HOME="$TMP_CODEX_HOME" ./uninstall.sh
```

GitHub Actions 会在每次 push 和 pull request 时运行同一套测试。

## 项目结构

```text
.
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   └── collect-session-contexts.mjs
├── tests/
│   └── collect-session-contexts.test.mjs
├── setup.sh
├── uninstall.sh
├── README.md
└── README.zh-CN.md
```

## 已知限制

- 标题质量取决于每个会话中可用的有效上下文。
- 收集脚本依赖 Codex 当前的本地 SQLite 结构和 rollout 格式；未来 Codex 更新后可能需要调整。
- 创建日期目前统一按 `Asia/Tokyo` 时区格式化。
- 全量执行会重新总结所有根会话，因此可能消耗较多 token。
- 没有内置标题历史或自动回滚。

## 卸载

在克隆的仓库目录中运行：

```bash
./uninstall.sh
```

卸载脚本只删除已经安装的 `codex-session-renamer` Skill 目录，不会恢复已经改过的会话标题，也不会删除 `setup.sh` 创建的时间戳备份。

## 相关项目

[codex-disk-guard](https://github.com/RuntianLee/codex-disk-guard) 用于在 macOS 上监测和控制 Codex 的高频日志写盘，同时不触碰会话和记忆数据。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
