# Collector 手机端页面结构草图

本文件用 Markdown/ASCII 草图描述 Collector 手机端主要页面结构。设计以单手操作为目标，减少页面跳转，按竞品完成问题并连续录入。

---

## 1. 首页（Home）

```
+----------------------------------------+
| Today's Benchmark                      |
| Date: 2026-07-03                       |
|                                        |
| Progress                               |
| ████████░░                             |
| 40%                                    |
|                                        |
| Completed: 2 / 5 Competitors            |
|                                        |
| [Session Status]                       |
|  - AIC       : Completed               |
|  - Ask AI    : In Progress             |
|  - ChatSmith : Not Started             |
|  - ChatOn    : Skipped                 |
|  - Nova      : Not Started             |
|                                        |
| Continue                               |
| Ask AI - Question 3 / 5                |
|                                        |
| [Select Competitors]                   |
| [Export today.json]                   |
+----------------------------------------+
```

### 说明

- 首页增加整体 Progress Bar，让用户一眼看到当天采集进度。
- 保留每个竞品状态：未开始 / 进行中 / 已完成 / 跳过。
- Continue 区块显示恢复位置，直接告诉用户当前竞品与题号。
- 入口保持简洁：继续当前采集、调整竞品、导出 Session。

---

## 2. 竞品选择页（Competitor Selection）

```
+----------------------------------------+
| Confirm Competitors                    |
| Today's Session                        |
|                                        |
| 1. AIC          [✓]                   |
| 2. Ask AI       [✓]                   |
| 3. ChatSmith    [✓]                   |
| 4. ChatOn       [ ]                   |
| 5. Nova        [✓]                   |
|                                        |
| [Add Competitor]                       |
| [Reorder Competitors]                  |
|                                        |
| [Save & Start Session]                |
+----------------------------------------+
```

### 说明

- 允许用户根据当天实际情况确认和调整竞品列表。
- 竞品顺序应保持不变，按采集顺序先后完成。
- 支持新增、删除、重新排序，但页面尽量保持简单。

---

## 3. 竞品 Question Card 页（Question Card）

```
+----------------------------------------+
| Competitor: Ask AI                     |
| Status: In Progress                    |
| Questions: 3 / 5 completed             |
|                                        |
| Question 3 / 5                          |
| Type: Tool                             |
| "这一题的完整问题文本，突出显示在页面顶部。" |
|                                        |
| ────────────────────────────────────── |
| Answer (必填)                          |
| [大文本输入区..........................]
|                                        |
| ────────────────────────────────────── |
| Screenshot (必填)                      |
| [Upload / attach image]                |
| [Upload successful] ✅                 |
| [View Screenshot]                      |
|                                        |
| Status: ✅ 回答已填写   ✅ 截图已上传     |
|                                        |
| ← Previous      Next →                |
|                                        |
| [Complete Competitor]                  |
| [Skip Competitor]  [Save & Exit]       |
+----------------------------------------+
```

### 说明

- 每次只聚焦一题，整个页面围绕当前 Question Card 展开。
- 顶部同时突出显示题号、问题类型和问题正文，帮助用户快速理解当前任务。
- Answer 与 Screenshot 均为必填项，避免漏填。
- 上传成功后显示「上传成功」状态，并提供 `View Screenshot` 预览按钮。
- 页面下方显示当前题目的完成状态，用户返回时可快速确认是否遗漏。
- Previous/Next 控件保持题目导航，避免页面跳转过多。

---

## 4. 竞品完成区（Competitor Completion）

```
+----------------------------------------+
| Competitor: Ask AI                     |
| Status: In Progress                    |
| Questions: 5 / 5 completed             |
|                                        |
| Question 5 / 5                          |
| Type: Reasoning                        |
| "最后一题问题文本..."                  |
|                                        |
| ────────────────────────────────────── |
| Answer (必填)                          |
| [大文本输入区..........................]
|                                        |
| ────────────────────────────────────── |
|
| Screenshot (必填)                      |
| [Upload / attach image]                |
| [Upload successful] ✅                 |
| [View Screenshot]                      |
|                                        |
| Status: ✅ 回答已填写   ✅ 截图已上传     |
|                                        |
| Model Used:                            |
| [文本输入框.........................]   |
|                                        |
| Free Count:                            |
| [数字输入框........................]   |
|                                        |
| Notes (optional):                      |
| [可选备注输入区......................]   |
|                                        |
| [Complete Competitor]                  |
| [Skip Competitor]  [Save & Exit]       |
+----------------------------------------+
```

### 说明

- 不再配置独立的 Metadata Page。
- 在最后一题完成后，当前 Question Card 页面底部继续展示竞品元信息录入字段。
- 用户可在同一个连续流程内完成回答、截图和竞品元信息，减少页面跳转。
- 填写完 `Model Used`、`Free Count`，可直接点击 `Complete Competitor`。
- 这保持了一个竞品一次完成的工作流。

---

## 5. 导出页（Export Page)

```
+----------------------------------------+
| Export Session                         |
| Today's Benchmark Session              |
|                                        |
| Competitors: 5                         |
| Completed: 5 / 5                       |
|                                        |
| Export file: today.json                |
|                                        |
| [Export JSON]                          |
|                                        |
| After export:                          |
| - Sync to PC manually                  |
| - Upload to cloud / transfer tool      |
+----------------------------------------+
```

### 说明

- 仅当所有竞品录入完成或状态允许导出时，才执行导出。
- 手动导出 `today.json`，不自动触发。
- 导出页提示用户后续同步到电脑的下一步。

---

## 6. 自动保存与中断恢复提示

```
+----------------------------------------+
| Auto-Saving...                         |
| Last saved: 10s ago                    |
|                                        |
| Continue                               |
| Ask AI - Question 3 / 5                |
|                                        |
| Session restored: Ask AI Q3            |
+----------------------------------------+
```

### 说明

- 页面应始终显示自动保存状态提示。
- 退出后重新进入时，自动恢复到上次保存的 Session、竞品、问题位置。
- Continue 区块显示恢复位置，用户可直接回到当前题目。
- 如果已标记 `Skip` 的竞品存在，恢复后仍显示其 Skip 状态。

---

## 7. 单手操作设计要点

- 页面结构简洁，信息垂直排列。
- 主要按钮放在屏幕底部，方便拇指触达。
- 每题只显示当前 Question Card，不做长表单堆叠。
- 进度信息、题型、正文、回答和截图在同一屏幕内可快速完成。
- 保持一个竞品一次完成，避免多页面跳转。
- 自动保存与中断恢复机制贯穿整个流程。
- 不增加任何分析能力，仅聚焦竞品测试数据采集。

---

## 8. 关键页面关系

- 首页 → 竞品选择页 → 竞品 Question Card 页 → 导出页
- 竞品 Question Card 页完成最后一题后在同页继续填写元信息
- 完成当前竞品后进入下一个竞品 Question Card
- 所有竞品完成后进入导出页
- 导出后同步到电脑，构成 Collector 到 Analysis 的闭环

---

## UX Principles

1. One Competitor, One Session 一个竞品一次完成，不在多个竞品之间来回切换。
2. One Question, One Screen 每个页面只处理一个问题，降低认知负担。
3. Auto Save Everywhere 所有输入自动保存，不需要用户点击保存。
4. Thumb-Friendly 所有主要操作位于屏幕底部，适合单手操作。
5. Fast In, Fast Out 用户应在最少点击次数内完成当天测试。
