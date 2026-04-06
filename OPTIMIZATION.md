# Claude Codex 优化方案

> 基于对 `src/` 目录（1937 个文件）的完整分析生成，与 sourcemap 提取版本对比已确认 1899/1902 文件一致，35 个文件为原创实现。

---

## 目录

1. [Rust/Go 重写候选](#1-rustgo-重写候选)
2. [启动性能优化](#2-启动性能优化)
3. [Bundle 体积优化](#3-bundle-体积优化)
4. [架构改进](#4-架构改进)
5. [内存优化](#5-内存优化)
6. [Native 模块机会](#6-native-模块机会)
7. [优先级排序](#7-优先级排序)

---

## 1. Rust/Go 重写候选

### 1.1 Diff 引擎 — `utils/diff.ts`

- **现状**: 使用 JS `diff` 库 (`structuredPatch()`)，设置了 5 秒超时 (`DIFF_TIMEOUT_MS`)，需要 workaround 处理 `&` 和 `$` 字符转义 (`escapeForDiff`/`unescapeFromDiff`)
- **问题**: 每次文件编辑都调用，大文件可能触发超时
- **方案**: Rust N-API 模块，使用 `similar` 或 `imara-diff` crate
- **预期提升**: 10-50x 速度提升，消除字符转义 workaround
- **影响**: ⭐⭐⭐ 高
- **复杂度**: 中 — 输入输出定义清晰，可通过 N-API 暴露

### 1.2 Ripgrep 内进程化 — `utils/ripgrep.ts`, `utils/glob.ts`

- **现状**: 通过子进程调用 `rg`，分配 20MB 缓冲区 (`MAX_BUFFER_SIZE`)，解析 stdout 输出
- **问题**: 进程启动开销 + 20MB 缓冲区分配 + stdout 拷贝解析
- **方案**: Rust N-API，使用 ripgrep 的库模式 (`grep-regex` crate)，流式返回结果
- **预期提升**: 消除 spawn 开销，减少内存分配，支持流式
- **影响**: ⭐⭐⭐ 高 — GrepTool 和 GlobTool 是最高频工具
- **复杂度**: 高 — 需处理 abort 信号、超时、EAGAIN 重试

### 1.3 Token 计数 — `services/tokenEstimation.ts`

- **现状**: 调用 Anthropic API 的 `countTokens` 端点（网络请求），或基于字符/词数粗略估算。Bedrock 路径动态导入 `@aws-sdk/client-bedrock-runtime`（~279KB）
- **问题**: 网络延迟，离线不可用
- **方案**: Rust 本地 tokenizer（`tiktoken-rs` crate）
- **预期提升**: 消除网络调用延迟
- **影响**: ⭐⭐ 中 — 驱动 compaction 决策和 budget 追踪
- **复杂度**: 中 — 需精确匹配 Claude 的 tokenizer

### 1.4 ANSI 渲染 — `utils/ansiToPng.ts`

- **现状**: 自定义 bitmap 字体渲染器，直接绘制 RGBA 缓冲区，使用内联 base64 编码的 Fira Code 字体（巨大常量 `FONT_B64`）。替代了之前 2.36MB WASM + ~224ms/帧 的方案
- **问题**: 内联 base64 字体数据膨胀 bundle
- **方案**: Rust N-API 模块，字体数据保留在 native 内存
- **影响**: ⭐⭐ 中 — 主要影响截图/导出功能
- **复杂度**: 中

### 1.5 Hashing — `utils/hash.ts`

- **现状**: 已优化 — Bun 环境使用 `Bun.hash`（wyhash，~100x 快于 SHA-256），Node fallback 使用 `crypto.createHash('sha256')`
- **结论**: 无需优化，已做得很好
- **影响**: ⭐ 低

---

## 2. 启动性能优化

### 2.1 迁移模块懒加载 — `main.tsx` 第 188-199 行

- **现状**: 10+ 个 migration 模块（如 `migrateFennecToOpus`, `migrateSonnet45ToSonnet46`）在启动时无条件 `import`
- **问题**: 这些模块只运行一次，但每次启动都加载
- **方案**: 改为 `dynamic import()` 懒加载
- **预期提升**: 减少 ~50-100ms 启动时间
- **影响**: ⭐⭐⭐ 高
- **复杂度**: 低

### 2.2 OpenTelemetry 延迟加载

- **现状**: `init.ts` 注释标注 "~400KB of OpenTelemetry + protobuf modules" 已延迟。gRPC exporters 进一步延迟（~700KB）
- **结论**: 已做了合理延迟加载
- **可进一步**: 默认仅保留 HTTP exporter，gRPC 按需加载

### 2.3 GrowthBook 特性开关初始化 — `services/analytics/growthbook.ts`

- **现状**: `initializeGrowthBook()` 在启动早期调用
- **建议**: 确保特性标志评估从本地缓存的 bootstrap payload 同步读取，不阻塞网络
- **影响**: ⭐⭐ 中
- **复杂度**: 低

### 2.4 配置加载并行化

- **现状**: `init.ts` 中 MDM 读取 (`startMdmRawRead()`)、密钥链预取 (`startKeychainPrefetch()`)、配置文件读取已做并行
- **结论**: 已优化良好

---

## 3. Bundle 体积优化

### 3.1 重型依赖清理

| 依赖 | 估计大小 | 建议 | 优先级 |
|------|---------|------|--------|
| `sharp` | ~25MB（含 native 二进制） | 已有 `image-processor.node`（macOS CoreGraphics），验证是否覆盖全部场景后移除 | ⭐⭐⭐ 高 |
| `@opentelemetry/*`（14 包）| ~2-4MB | 合并为仅 HTTP exporter，移除 gRPC 和 proto | ⭐⭐ 中 |
| `@aws-sdk/*`（5 包）| ~3-5MB | 已懒加载；可考虑直接用 `@smithy` 精简 | ⭐⭐ 中 |
| `google-auth-library` | ~1.5MB | 仅 Vertex 用，确保懒加载 | ⭐⭐ 中 |
| `highlight.js` + `cli-highlight` | ~1MB | 去重，二者捆绑了重复代码 | ⭐ 低 |
| `marked` | ~300KB | 若仅做简单渲染可替换为更轻量的解析器 | ⭐ 低 |
| `turndown` | ~100KB | HTML→Markdown，确保懒加载 | ⭐ 低 |
| `ajv` | ~400KB | 已用 `zod`，检查 `ajv` 是否可移除 | ⭐ 低 |

### 3.2 内联资源外部化

- **`ansiToPng.ts` 的 `FONT_B64`**: 估计 100KB+ 解码后的 bitmap 字体数据内联在 JS 中
- **建议**: 改为外部二进制资源文件，运行时懒加载
- **影响**: ⭐⭐ 中

### 3.3 Tree-shaking 确认

- `lodash-es` 已使用具体导入（`mapValues`, `pickBy`, `uniqBy`, `memoize`, `last`），可 tree-shake ✅
- 确认 esbuild/Bun bundler 配置已启用 tree-shaking

---

## 4. 架构改进

### 4.1 Context Collapse 热路径优化 — `services/contextCollapse/operations.ts`

- **现状**: `projectView()` 对每个 commit 用 `[...spread]` 创建新数组
  ```ts
  projected = [...projected.slice(0, start), summaryMessage, ...projected.slice(end + 1)]
  ```
- **问题**: O(n×m) 复杂度（n=消息数, m=commit 数），创建大量中间数组
- **方案**: 单次遍历收集输出索引，或使用 `Array.prototype.splice()` 原地修改
- **影响**: ⭐⭐ 中
- **复杂度**: 低

### 4.2 搜索结果流式返回

- **现状**: GrepTool/GlobTool 缓冲全部结果后返回（最大 20MB）
- **方案**: 流式渐进返回搜索结果
- **影响**: ⭐⭐ 中 — 降低峰值内存
- **复杂度**: 中

### 4.3 Compaction 策略合并 — `services/compact/`

- **现状**: 16 个文件，7 种 compaction 策略（regular、micro、snip、time-based、api、cached、reactive），各自维护独立状态
- **方案**: 策略模式统一接口，共享状态管理
- **影响**: ⭐⭐ 中 — 降低复杂度而非运行时性能
- **复杂度**: 高

### 4.4 文件读取缓存淘汰策略 — `utils/fileReadCache.ts`

- **现状**: 使用 Map + FIFO 手动淘汰（`delete(firstKey)`），最大 1000 条
- **方案**: 改用已有的 `LRUCache` 依赖（`FileStateCache` 已在用），提升缓存命中率
- **影响**: ⭐ 低
- **复杂度**: 低 — 简单替换

---

## 5. 内存优化

### 5.1 FileStateCache 多 Agent 内存增长 — `utils/fileStateCache.ts`

- **现状**: LRU 缓存默认 `maxSize: 25MB`，每个 agent/session 各一份
- **问题**: Coordinator 模式下 `25MB × agent数` 可能导致内存膨胀
- **方案**: 进程级共享缓存池，总量限制
- **影响**: ⭐⭐ 中
- **复杂度**: 中

### 5.2 Cleanup 注册表 — `utils/cleanupRegistry.ts`

- **现状**: `runCleanupFunctions()` 使用 `Promise.all()`
- **问题**: 任一 cleanup 函数抛异常会导致其他清理被跳过
- **方案**: 改为 `Promise.allSettled()`
- **影响**: ⭐ 低（可靠性改进）
- **复杂度**: 极低

### 5.3 Session Transcript 增量 Hash — `services/sessionTranscript/sessionTranscript.ts`

- **现状**: `computeSegmentHash()` 将所有 UUID 用 `|` 拼接后 hash
- **问题**: 长会话下线性增长
- **方案**: 增量 hash（上一次 hash + 新条目）
- **影响**: ⭐ 低
- **复杂度**: 低

---

## 6. Native 模块机会

### 6.1 现有 Native 模块

| 模块 | 功能 | 平台 |
|------|------|------|
| `image-processor.node` | 图片缩放/转换（CoreGraphics/ImageIO），剪贴板访问 | macOS，其他平台 fallback 到 sharp |
| `modifiers-napi.node` | 读取键盘修饰键状态（Cmd/Ctrl/Shift） | macOS |
| `url-handler-napi.node` | macOS URL 事件处理（Apple Events） | macOS |
| `audio-capture.node` | 语音采集 | macOS |

### 6.2 新 Native 模块候选

| 候选 | 说明 | 价值 |
|------|------|------|
| **Diff 引擎** | 替代 `diff` npm 包，消除 5 秒超时和字符转义 workaround | ⭐⭐⭐ 最高 |
| **文件监听优化** | 替代 chokidar v5，直接 `inotify`/`kqueue`/`FSEvents` + 批量合并 | ⭐⭐ 中 |
| **PDF 文本提取** | 当前直接发 base64 给 API，本地用 `poppler`/`mupdf` 提取文本可减少 token 消耗 | ⭐⭐ 中 |
| **跨平台图片处理** | 扩展 `image-processor.node` 支持 Linux/Windows，完全移除 sharp | ⭐⭐ 中 |

---

## 7. 优先级排序

### 第一梯队 — 低挂果实（影响高 + 复杂度低）

| # | 方案 | 影响 | 复杂度 | 预计工作量 |
|---|------|------|--------|-----------|
| 1 | 迁移模块懒加载（main.tsx） | 高 | 低 | 1-2 小时 |
| 2 | `Promise.allSettled()` 替换 `Promise.all()` | 低 | 极低 | 10 分钟 |
| 3 | FileReadCache 改用 LRUCache | 低 | 低 | 30 分钟 |
| 4 | Context Collapse 数组操作优化 | 中 | 低 | 1 小时 |

### 第二梯队 — 高价值投资

| # | 方案 | 影响 | 复杂度 | 预计工作量 |
|---|------|------|--------|-----------|
| 5 | Rust N-API Diff 引擎 | 高 | 中 | 1-2 周 |
| 6 | 移除 sharp（验证 + 跨平台方案）| 高 (-25MB) | 中 | 3-5 天 |
| 7 | OpenTelemetry exporter 精简 | 中 (-1-2MB) | 低 | 1 天 |
| 8 | ANSI 字体数据外部化 | 中 | 低 | 半天 |

### 第三梯队 — 深度优化

| # | 方案 | 影响 | 复杂度 | 预计工作量 |
|---|------|------|--------|-----------|
| 9 | 内进程 Ripgrep N-API | 高 | 高 | 2-3 周 |
| 10 | 本地 Token 计数（tiktoken-rs）| 中 | 中 | 1 周 |
| 11 | 文件缓存共享池 | 中 | 中 | 3-5 天 |
| 12 | Compaction 策略模式重构 | 中 | 高 | 1-2 周 |

---

## 附录：代码库概况

| 指标 | 数值 |
|------|------|
| 总文件数 | 1937 |
| 与 sourcemap 一致的文件 | 1899 |
| 有微小差异的文件 | 3（main.tsx, bootstrap/state.ts, utils/json.ts）|
| 原创文件（不在 sourcemap 中）| 35 |
| 占位/空壳实现 | 1 个文件（entrypoints/agentSdkTypes.ts，设计如此）|
