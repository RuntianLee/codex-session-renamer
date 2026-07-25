# codex-session-renamer

[English](README.md) | [中文](README.zh-CN.md)

手动重新总结并重命名所有 Codex 根会话，统一生成 `YYYY-MM-DD｜核心内容总结`，根据会话的真实目标和结果命名，不再直接复制首条消息。

> **免责声明。** 全量执行会修改所有 Codex 根会话标题，且没有内置回滚功能。使用前请先阅读 [SKILL.md](SKILL.md)。

## 它能做什么

| 能力 | 行为 |
| --- | --- |
| 语义化标题 | 根据主要目标、实际结果或最终结论生成标题。 |
| 创建日期 | 在每个标题前加入对应会话的创建日期。 |
| 手动全量执行 | 重命名所有 Codex 根会话，包括已经带日期和已经归档的会话。 |
| 按会话选择语言 | 默认让每个标题跟随对应会话的主要用户语言。 |
| 显式指定语言 | `language=<language>` 可强制所有标题和用户可见输出使用同一种语言。 |
| 范围保护 | 排除 ChatGPT 对话和子代理会话。 |
| 不创建自动化 | 只有你明确调用 Skill 时才会执行。 |

## 命名与语言规则

标题格式：

```text
YYYY-MM-DD｜核心内容总结
```

未指定语言时：

- 每个标题使用对应会话自己的主要用户语言；
- 进度信息和最终报告使用当前触发 Skill 的对话语言；
- 如果会话语言不明确，则依次回退到当前标题语言、触发会话语言。

显式指定语言时：

```text
language=English
language=zh-CN
language=ja
```

指定语言会同时作用于所有新标题和所有用户可见输出。项目名、产品名、代码标识符和通用技术术语会在合适时保留原文。

## 环境要求

- OpenAI Codex，并且可以使用本地会话管理工具。
- 本地存在 `~/.codex/state_5.sqlite` 会话目录。
- Node.js 20 或更高版本。
- `sqlite3` 已加入 `PATH`。
- 已在 macOS 上测试。

## 告诉 Codex 安装

直接告诉 Codex：

```text
请从 https://github.com/RuntianLee/codex-session-renamer 仓库根目录安装 codex-session-renamer Skill。
```

Codex 会使用内置的 Skill Installer，把 Skill 安装到 `$CODEX_HOME/skills`。安装完成后，下一轮对话即可使用。

## 使用方法

### 自动判断语言

```text
使用 $codex-session-renamer 手动全量重新总结并重命名所有 Codex 根会话。
```

### 强制使用同一种语言

```text
使用 $codex-session-renamer language=English 手动全量重新总结并重命名所有 Codex 根会话。
```

可将 `English` 换成语言名称或 BCP-47 标签，例如 `zh-CN`、`ja`。

> **重要：** 该 Skill 每次都会执行全量重命名，不提供增量模式、定时模式、dry-run 或自动标题备份。

## 工作原理

1. 获取最近 50 个 Codex 任务的精简摘要。
2. 每批读取 20 个根会话的元数据和本地精简上下文。
3. 提取每个会话的当前标题、最近有效用户目标和最终结果。
4. 判断所需语言并生成简洁的核心内容标题。
5. 通过 Codex 官方会话工具完成重命名。
6. 对归档任务临时解除归档，重命名后恢复原归档状态。
7. 持续处理，直到所有根会话都完成检查。

收集脚本只读取本地元数据和 rollout 文件，不会直接写入 Codex 数据库或会话文件。

## 安全与隐私

| 范围 | 保证 |
| --- | --- |
| 会话内容 | 只在本地读取，用于提取精简的命名上下文。 |
| 数据库 | 只查询会话元数据，不直接向 SQLite 写入标题。 |
| 重命名 | 使用 Codex 官方会话工具。 |
| 归档任务 | 重命名后恢复原来的归档状态。 |
| 排除范围 | 永不选择 ChatGPT 对话和子代理会话。 |
| 自动化 | 永不创建或更新定时自动化。 |
| 删除操作 | 永不删除会话、消息、记忆或项目文件。 |

## 仓库内容

```text
.
├── README.md
├── README.zh-CN.md
├── SKILL.md
├── agents/
│   └── openai.yaml
└── scripts/
    └── collect-session-contexts.mjs
```

## 已知限制

- 标题质量取决于每个会话中可用的有效上下文。
- 收集脚本依赖 Codex 当前的本地 SQLite 结构和 rollout 格式。
- 创建日期目前统一按 `Asia/Tokyo` 时区格式化。
- 全量执行会重新总结所有根会话，因此可能消耗较多 token。
- 没有内置标题历史或自动回滚。
