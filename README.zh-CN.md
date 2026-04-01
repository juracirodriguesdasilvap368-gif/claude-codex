# Claude Code 2.1.88 Recovered

[English](./README.md) | 简体中文

这个仓库是一个从 `cli.js.map` 恢复结果整理出来的 Claude Code `2.1.88` 工程，当前被重构为“以源码为主”的 npm 项目，方便做源码研究、本地构建和持续修复。

## 项目概述

这个仓库的目标，是让恢复出来的代码更容易：

- 阅读和研究
- 通过 npm 安装依赖
- 在本地完成构建
- 构建后作为 CLI 运行
- 持续修复和补全

当前仓库已经清理为只保留真正实用的项目文件：

- `src/`
- `scripts/`
- `vendor/`
- `package.json`
- `package-lock.json`
- `README.md`
- `README.zh-CN.md`

像大体积压缩包、重复解压目录、PDF、source map、`dist/` 和 `node_modules/` 这类内容都不会继续纳入版本管理。

## 当前状态

当前项目状态：

- 主要源码树已经恢复并整理完成
- 可以通过 npm 安装依赖
- 可以在本地完成构建
- 可以生成并启动 CLI 入口
- 仓库已经清理为源码优先的结构

当前更适合把它看作一个“研究和恢复用途的重建工程”，而不是与官方上游完全等价的生产级镜像。

## 已具备能力

这个仓库目前已经提供：

- 位于 `src/` 下的恢复版 TypeScript 源码树
- 一套可重复执行的 npm 构建流程
- 位于 `vendor/` 下的本地兼容替代实现
- 位于 `scripts/build.mjs` 中的 Node.js 友好型重建脚本
- 一个更干净、以源码为中心的仓库结构

适合用于：

- 逆向研究和源码阅读
- 命令行为跟踪
- 运行时调试
- 逐步恢复缺失模块
- 试验兼容层和重建方案

## 重要说明

这个仓库不是官方上游源码仓库。

它是基于 sourcemap 恢复结果重建出来的项目。由于 reverse recovery 本身并不完整，当前代码中仍然包含兼容层、自动生成的 shim，以及为了让项目可安装、可构建而保留下来的 stub 替代实现。

这意味着：

- 它适合用于研究、调试和持续恢复工作
- 它不保证与官方发布 bundle 的行为完全一致
- 某些私有集成、原生能力或高级功能，后续仍可能需要手工补全

## 环境要求

- Node.js `>= 18`
- npm `>= 9`

建议先确认环境：

```bash
node -v
npm -v
```

## 快速开始

```bash
npm install
npm run build
node dist/cli.js --help
```

## 安装依赖

在项目根目录执行：

```bash
npm install
```

依赖将根据 [package.json](./package.json) 和 `package-lock.json` 安装。

## 构建项目

执行：

```bash
npm run build
```

构建产物会在本地生成到：

- `dist/cli.js`
- `dist/src/**`
- `dist/vendor/**`

构建流程定义在 [scripts/build.mjs](./scripts/build.mjs)，当前主要负责：

- 将 `src/` 和 `vendor/` 转译为 Node.js 可运行的 ESM 输出
- 将 `bun:*` 导入改写成兼容 Node/npm 的 shim
- 解析 `src/*` 别名导入
- 为未完整恢复的模块生成兼容 stub
- 注入 CLI 启动所需的构建期常量

## 运行方式

直接运行构建后的 CLI：

```bash
node dist/cli.js --help
```

查看版本：

```bash
node dist/cli.js --version
```

也可以通过 npm script 启动：

```bash
npm start -- --help
```

## 安装为本地命令行工具

构建完成后，如果你想把它安装成全局命令：

```bash
npm install -g .
```

安装后可运行：

```bash
claude-recovered --help
```

如果更偏向本地开发联调，也可以使用：

```bash
npm link
```

## 常用命令

```bash
npm install
npm run build
npm run clean
npm start -- --help
node dist/cli.js --version
```

## 项目结构

```text
.
├── package.json
├── package-lock.json
├── scripts/
│   └── build.mjs
├── src/
├── vendor/
├── README.md
└── README.zh-CN.md
```

说明：

- `src/`：恢复出的主要源码树
- `vendor/`：用于替代不可用私有依赖或原生模块的本地兼容实现
- `scripts/build.mjs`：自定义 npm 构建流程
- `dist/`：构建时本地生成，不提交到仓库

## 已验证流程

当前仓库已经验证通过这条基础本地流程：

- `npm install`
- `npm run build`
- `node dist/cli.js --help`
- `node dist/cli.js --version`

## 路线图

这个仓库后续比较值得推进的方向包括：

- 逐步减少 stub，用真实实现替换高价值缺失模块
- 补充核心架构说明，例如 bootstrap、commands、tools 和 UI
- 增加可重复执行的构建校验和 smoke test 脚本
- 标注哪些功能已经可用、哪些部分可用、哪些仍然阻塞
- 如有需要，把档案材料和研究材料拆到单独分支或 release 资源中

## 已知限制

- 某些原始依赖在 npm 上不可用，目前通过本地 shim 替代
- 某些模块无法完整恢复，目前仍会在构建时使用 stub
- “能构建、能启动” 不等于 “与官方 bundle 完全等价”
- 与私有服务、私有协议或原生平台集成相关的能力，后续仍可能需要继续补全

## 问题排查

如果你遇到构建或运行问题，建议按下面顺序排查：

1. 确认 Node.js 版本不低于 18。
2. 清理旧构建产物。
3. 重新安装依赖。
4. 重新构建。
5. 验证 CLI 入口。

常用排查命令：

```bash
npm run clean
npm install
npm run build
node dist/cli.js --help
```

## 后续开发建议

如果你准备继续完善这个恢复工程，通常优先级最高的是：

- 修复启动阶段的运行时报错
- 把自动生成的 stub 逐步替换成真实实现
- 为缺失的私有依赖补上兼容逻辑
- 对照原始 bundle 校验关键命令行为

## 许可证与来源说明

该仓库包含从 sourcemap 恢复整理出的代码。在继续分发或公开发布之前，请仔细确认原始项目的许可证、版权和使用条款。
