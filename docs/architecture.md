http://127.0.0.1:3000# Collector Architecture

## 1. Architecture Overview

Collector 是一个 Offline First 的 PWA 数据采集工具，其唯一职责是：

- 导入 Today's Questions
- 创建 Today's Benchmark Session
- 采集竞品回答
- 上传截图
- 自动保存
- 导出标准 today.json

Collector 不负责回答分析、Excel 填写、报告生成、历史统计。后续模块在 Collector 之外消费其生成的标准 JSON。

## 2. Technology Stack

| 模块 | 技术 | 说明 |
|------|------|------|
| Framework | Next.js（App Router） | 适合构建 PWA 与单页应用，支持服务端渲染和静态资源管理。 |
| Language | TypeScript | 提供类型安全、可维护性和 IDE 级别静态检查。 |
| UI | React | 组件化界面构建，适配移动端卡片式交互。 |
| Styling | Tailwind CSS | 原子化样式，快速实现移动端布局与响应式设计。 |
| Icons | Lucide React | 轻量图标库，适合统一 UI 风格。 |
| State Management | Zustand | 轻量单一状态存储，适合 Session 驱动应用。 |
| Local Storage | IndexedDB | 支持离线、图片存储、结构化数据和恢复机制。 |
| Export | Browser File API | 直接在客户端生成并下载 `today.json` 文件。 |
| PWA | next-pwa | 提供离线缓存、Add to Home Screen 和 PWA 元数据支持。 |

## 3. Project Structure

```
collector/
├── app/
├── components/
├── store/
├── lib/
├── types/
├── public/
├── docs/
```

- `app/`：Next.js 页面路由和页面级布局。
- `components/`：可复用 UI 组件，如 QuestionCard、ProgressBar、CompetitorList、ScreenshotPreview。
- `store/`：Zustand 状态管理逻辑，保存 Today's Benchmark Session 和 UI 状态。
- `lib/`：业务工具和数据处理函数，例如 JSON 导出、IndexedDB 适配、Session 恢复、校验逻辑。
- `types/`：TypeScript 类型定义，包含 Session、Question、Competitor、Answer、Metadata、ExportPayload 等接口。
- `public/`：静态资源，如 PWA 图标、favicon、静态 JSON 模板。
- `docs/`：Collector 设计与架构文档。

## 4. Page Architecture

Collector MVP 页面结构应保持最少页面跳转，围绕 Session 进行组织：

- `Home`：展示当前 Session 的整体进度、竞品状态和恢复位置。
- `Competitor Selection`：确认当天竞品列表，支持调整顺序与数量。
- `Competitor Session`（Question Card）：按竞品逐题录入回答和截图，包含问题类型、问题文本和完成状态。
- `Export`：生成并下载标准 `today.json`。

每个页面都读取同一个 Session 状态，并将用户操作写回该单一状态源。

## 5. State Management

Collector 只有一个核心状态：Today's Benchmark Session。

所有页面围绕 Session 工作，不拆成多个互相独立的数据源。Session 是单一真实来源（Single Source of Truth）。

Session 组成：

- `date`：当前测试日期。
- `questions`：Today's Questions 列表。
- `competitors`：竞品列表与顺序。
- `answers`：每个问题对应的回答文本与截图引用。
- `screenshots`：每题截图路径或 Blob 引用。
- `metadata`：竞品级别元信息（使用模型、免费次数、可选备注）。
- `progress`：竞品完成状态、当前题号、已完成数量、跳过状态。

该状态应以 TypeScript 接口定义，并由 Zustand 提供保存、更新和订阅能力。

## 6. Data Flow

Today's Questions
↓
Create Session
↓
Question Card
↓
Auto Save（IndexedDB）
↓
Export today.json
↓
Analysis Module

Collector 只负责生成标准 JSON，后续 Analysis 模块读取该 JSON 执行数据分析与报告生成。

## 7. Local Storage Strategy

Collector 使用 IndexedDB 作为本地存储策略，原因如下：

- 支持图片存储：可以保存截图 Blob 或持久化引用，避免将图像写入 LocalStorage。 
- 支持离线：PWA 离线模式下，Session 数据与截图应可在本地读取和恢复。 
- 支持恢复 Session：自动保存当前 Session 进度，用户中断后重新打开时恢复到上次位置。 
- 后续扩展云同步：IndexedDB 为未来与云同步服务对接提供本地缓存层。

不使用 LocalStorage 存储截图，也不使用 LocalStorage 保存复杂 Session 结构。LocalStorage 仅适合小型键值对，不适合图片和大型对象。

## 8. PWA Strategy

第一版 PWA 支持：

- Add to Home Screen：使 Collector 可安装到设备主屏幕。
- Offline：离线读取已保存的 Session 数据与静态资源。
- Auto Cache：使用 next-pwa 缓存页面资源和静态资产。

暂不实现：

- Push Notification
- Background Sync

## 9. Engineering Principles

1. Offline First：应用应在断网情况下继续读取和保存当前 Session。 
2. Single Source of Truth：所有页面共享一个 Session 状态，避免状态分散与数据不一致。 
3. Local First：优先在本地保存和恢复数据，减少对远程服务的依赖。 
4. Component Driven：界面与逻辑按可复用组件组织，便于迭代和测试。 
5. Mobile First：整个架构以移动端体验为核心，页面结构简洁、操作可单手完成。 
6. JSON Standard：Collector 输出标准 JSON，后续模块仅消费该格式。 
7. Keep Collector Simple：Collector 只做数据采集与导出，不引入分析或报告逻辑。

## 10. Future Extension

下列功能属于未来规划，但不属于 Collector MVP：

- OCR：自动识别截图中的文本或回答内容。
- 自动识别回答：通过图像或文本自动提取竞品回答。
- 云同步：将本地 Session 与远程存储同步。
- Dashboard：历史数据可视化与趋势展示。
- History：跨天 Session 存档与查询。
- 自动分析：回答质量自动评估与优劣判断。
- Excel Generator：直接生成 Excel 文件。

这些功能应在 Collector 之外的后续模块或扩展版本中实现。
