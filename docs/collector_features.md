# Collector 功能范围

## 概述

本文件定义 Collector 的功能范围。Collector 只负责数据采集，不负责分析。所有功能以 Competitor Session 工作为中心，优先保证手机端的简洁可用性。

## 功能列表

### 1. Today's Questions 导入

- Feature Name: Today's Questions Import
- Purpose: 将 Prompt 网站筛选出的当天测试问题导入 Collector，创建当天的 `Today's Benchmark Session`。
- User Interaction: 用户手动导入 `Today's Questions` 数据，或者在未来支持自动同步时触发导入。
- Input: `Today's Questions` 列表，包含问题文本、问题类型、指向功能等字段。
- Output: 创建或更新 `Today's Benchmark Session`，包含 `date`、Questions、竞品列表。
- MVP 优先级: Must

### 2. Benchmark Session 管理

- Feature Name: Competitor Session Management
- Purpose: 以当天的 `Today's Benchmark Session` 为单位组织所有采集工作。
- User Interaction: 用户打开 Collector 时确认或切换当前 Session，查看 Session 基本信息。
- Input: 已创建的 Session 元数据，包括 `date`、Today's Questions、竞品列表、状态。
- Output: 当前 Session 状态、采集进度、竞品顺序。
- MVP 优先级: Must

### 3. 竞品列表确认与调整

- Feature Name: Competitor List Confirmation
- Purpose: 确认当天实际测试的竞品，允许根据实际情况调整竞品排序或增删竞品。
- User Interaction: 用户在 Session 创建后确认竞品列表，并能够在开始采集前修改列表。
- Input: 初始竞品清单、用户修改的竞品名单和顺序。
- Output: 最终采集竞品列表和顺序，更新 Session。
- MVP 优先级: Must

### 4. 首页整体进度展示

- Feature Name: Overall Session Progress
- Purpose: 让用户一眼看清当天 Session 的整体完成度和各竞品状态。
- User Interaction: 用户打开 Collector 首页时查看整体进度和每个竞品状态。
- Input: 当前 Session 的竞品完成情况、已录入问题数量、跳过/异常状态。
- Output: `Completed: X / Y Competitors`，每个竞品的状态标签。
- MVP 优先级: Must

### 5. 按竞品录入问题与截图

- Feature Name: Competitor Question Entry
- Purpose: 以竞品为单位逐个录入当天问题的回答文本和截图。
- User Interaction: 用户选择一个竞品，依次完成该竞品所有问题的回答和截图上传。
- Input: 当前竞品、问题列表、回答文本、截图文件或引用路径。
- Output: 当前竞品问题记录保存到 Session，更新问题完成状态。
- MVP 优先级: Must

### 6. 问题级自动保存

- Feature Name: Automatic Question Save
- Purpose: 每录入一个问题后即时保存数据，避免用户重复输入或数据丢失。
- User Interaction: 用户输入内容后无需手动保存，系统自动保存当前问题数据。
- Input: 当前问题的回答、截图、状态更新。
- Output: 实时保存到当前 Session。
- MVP 优先级: Must

### 7. 竞品元信息补录

- Feature Name: Competitor Metadata Entry
- Purpose: 在当前竞品所有问题完成后，补录该竞品的模型和免费次数信息。
- User Interaction: 在完成竞品问题录入后，用户填写该竞品的 `使用模型` 和 `免费次数`。
- Input: 竞品名称、使用模型、免费次数。
- Output: 将竞品元信息保存到当前竞品的 Session 数据中。
- MVP 优先级: Must

### 8. 竞品状态标记

- Feature Name: Competitor Status Tracking
- Purpose: 标记竞品状态为未开始、进行中、已完成、跳过等，以便整体进度管理。
- User Interaction: 系统根据录入进度自动更新状态，用户可在异常情况下手动标记 `Skip` 或 `稍后继续`。
- Input: 问题完成情况、元信息填写状态、异常操作。
- Output: 更新当前竞品状态，反映在 Session 进度中。
- MVP 优先级: Must

### 9. 异常跳过与恢复

- Feature Name: Competitor Skip and Resume
- Purpose: 允许测试人员在竞品测试出现网络问题、免费次数限制、App 崩溃等情况下跳过当前竞品，并在后续继续补录。
- User Interaction: 用户选择 `Skip` 或 `稍后继续`，系统记录异常原因和未完成状态。
- Input: 异常类型、跳过原因、当前竞品进度。
- Output: 竞品状态更新为跳过/待补录，保存当前未完成数据供后续继续。
- MVP 优先级: Should

### 10. Session 数据恢复

- Feature Name: Session Resume
- Purpose: 支持用户中断后再次打开 Collector 时恢复到上次未完成位置。
- User Interaction: 用户重新打开 Collector，系统自动恢复到当前 Session 的最后保存状态。
- Input: 当前 Session 存档、竞品状态、问题完成情况、截图记录。
- Output: 恢复当前竞品/问题位置、当前 Session 进度。
- MVP 优先级: Must

### 11. 导出 JSON

- Feature Name: Export Session JSON
- Purpose: 将当天 Session 数据导出为标准 JSON 文件，供 Analysis 消费。
- User Interaction: 用户在所有竞品录入完成后手动触发导出。
- Input: 当前 Session 的完整数据结构。
- Output: `today.json` 文件，符合 `docs/data_model.md` 定义。
- MVP 优先级: Must

### 12. 同步到电脑

- Feature Name: Sync JSON to PC
- Purpose: 将导出的 `today.json` 同步到电脑端，供 Analysis 模块读取。
- User Interaction: 用户手动传输 `today.json` 到电脑，例如通过文件传输、云盘。
- Input: 导出的 `today.json` 文件。
- Output: 电脑端可访问的 `today.json`。
- MVP 优先级: Should

### 13. 日志与状态提示

- Feature Name: Operation Feedback
- Purpose: 在关键步骤提供状态提示，确保用户明确当前采集进度和操作结果。
- User Interaction: 用户在每个阶段看到采集进度、保存状态、导出结果、异常提示等。
- Input: Session 状态更新、自动保存结果、导出完成信息、异常事件。
- Output: 实时反馈信息和提示文本。
- MVP 优先级: Must

### 14. 竞品顺序保留

- Feature Name: Competitor Order Persistence
- Purpose: 保证用户设置的竞品顺序在整个 Session 内保持一致。
- User Interaction: 用户确认竞品顺序后，Collector 在整个采集过程中保持该顺序。
- Input: 最终确认的竞品列表顺序。
- Output: 保存的竞品顺序，用于后续采集与进度展示。
- MVP 优先级: Must

### 15. 竞品级别检查报告

- Feature Name: Session Completion Summary
- Purpose: 在 Session 结束前提供整体完成状态检查，提示是否存在遗漏项。
- User Interaction: 用户在全部竞品录入完成前查看整体检查结果。
- Input: 当前 Session 中各竞品的完成情况和未完成项。
- Output: 汇总的竞品完成状态与遗漏提示。
- MVP 优先级: Should

### 16. 竞品数量动态支持

- Feature Name: Dynamic Competitor Support
- Purpose: 支持当天竞品数量可变，而不是固定 2 个或 3 个。
- User Interaction: 用户在竞品列表确认时输入或选择任意数量的竞品。
- Input: 当前 Session 的竞品列表。
- Output: Session 支持可变数量竞品的录入与导出。
- MVP 优先级: Must

### 17. 竞品级截图必填校验

- Feature Name: Screenshot Required Validation
- Purpose: 确保每个问题都必须上传截图，采集数据完整。
- User Interaction: 用户在录入问题回答时必须同时上传截图，否则无法完成该问题。
- Input: 问题回答文本、截图文件或引用路径。
- Output: 校验结果、提示用户补充截图。
- MVP 优先级: Must

### 18. 竞品问题进度提示

- Feature Name: Question Progress Indicator
- Purpose: 显示当前竞品内已完成问题数量与剩余问题数量。
- User Interaction: 用户在竞品录入页面查看当前竞品问题的完成进度。
- Input: 当前竞品问题完成状态。
- Output: 已完成/总问题数指示。
- MVP 优先级: Must

### 19. 日志导出验证

- Feature Name: Export Validity Check
- Purpose: 在导出前校验 Session 是否完整，避免生成不符合规范的 `today.json`。
- User Interaction: 用户触发导出时，系统检查是否满足导出条件。
- Input: Session 数据完整性、问题回答与截图、元信息状态、竞品状态。
- Output: 导出许可或错误提示。
- MVP 优先级: Must

### 20. 竞品跳过记录历史

- Feature Name: Skip History Record
- Purpose: 记录发生 Skip 时的竞品状态与原因，供后续恢复和复查。
- User Interaction: 用户选择跳过某个竞品并填写原因。
- Input: 跳过原因、当前竞品已完成情况。
- Output: 保存该竞品的 Skip 状态与说明。
- MVP 优先级: Should

## MVP Scope

### 必须实现的功能

- Today's Questions 导入
- Benchmark Session 管理
- 竞品列表确认与调整
- 首页整体进度展示
- 按竞品录入问题与截图
- 问题级自动保存
- 竞品元信息补录
- 竞品状态标记
- Session 数据恢复
- 导出 JSON
- 竞品数量动态支持
- 竞品级截图必填校验
- 竞品问题进度提示
- 日志导出验证
- 竞品顺序保留
- Operation Feedback

### 应当实现的功能

- 异常跳过与恢复
- 同步到电脑
- 竞品级别检查报告
- Skip History Record

### 暂不实现的功能

- 分析功能
- OCR 自动识别
- 云同步
- 自动获取 Today's Questions
- 自动生成 Excel
- 自动分析与评分
- 任何与 Analysis 或 Report 相关的输出
