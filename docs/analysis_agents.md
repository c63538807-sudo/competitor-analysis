# Analysis 模块 Agent 架构设计文档

**版本**: v1.0
**状态**: 设计阶段（尚未开发）
**前置文档**:
- `docs/analysis_prd.md`（产品设计 — 做什么）
- `docs/analysis_workflow.md`（执行流程 — 怎么做）
**本文档**：Agent 架构（谁来做 — 如何分工协作）

---

## 设计原则

1. **单一职责**：每个 Agent 只负责一种分析能力，不跨界。
2. **松耦合**：Agent 之间通过标准化的数据对象通信，不直接依赖彼此内部实现。
3. **可替换**：任何一个 Agent 可以独立替换或升级，不影响其他 Agent。
4. **可扩展**：新增 Agent 只需插入 Pipeline，不改动现有代码。
5. **优雅降级**：任一步骤失败时，Pipeline 不崩溃，标注错误后继续。

---

## 1. 整体 Agent 架构

```
                         ┌──────────────────────┐
                         │     today.json        │
                         │   (Collector 输出)     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │                      │
                         │   Orchestrator Agent  │
                         │   (Pipeline 编排器)    │
                         │                      │
                         │   职责:                │
                         │   - 读取 today.json   │
                         │   - 调度各 Agent       │
                         │   - 组装最终输出       │
                         │   - 错误恢复           │
                         │                      │
                         └──────────┬───────────┘
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │                                             │
          │         Question Loop (循环编排)              │
          │                                             │
          │   for each question in questions:           │
          │                                             │
          │   ┌─────────────────────────────────────┐  │
          │   │  Step A: Router Agent               │  │
          │   │  分析 questionType                  │  │
          │   │  决定后续策略                        │  │
          │   │  → 权重矩阵选择                      │  │
          │   │  → Fact Check 是否需要               │  │
          │   └──────────────┬──────────────────────┘  │
          │                  │                         │
          │                  ▼                         │
          │   ┌─────────────────────────────────────┐  │
          │   │  Step B: Fact Check Agent           │  │
          │   │  (条件触发 — 仅需要时)               │  │
          │   │  联网验证事实性内容                   │  │
          │   └──────────────┬──────────────────────┘  │
          │                  │                         │
          │                  ▼                         │
          │   ┌─────────────────────────────────────┐  │
          │   │  Step C: Quality Review Agent       │  │
          │   │  对 AIC + 每个竞品                    │  │
          │   │  7维度独立评分                        │  │
          │   └──────────────┬──────────────────────┘  │
          │                  │                         │
          │                  ▼                         │
          │   ┌─────────────────────────────────────┐  │
          │   │  Step D: Comparison Agent           │  │
          │   │  AIC vs 各竞品逐维度比较              │  │
          │   └──────────────┬──────────────────────┘  │
          │                  │                         │
          │                  ▼                         │
          │   ┌─────────────────────────────────────┐  │
          │   │  Step E: Judgment Agent             │  │
          │   │  基于规则 + 评分                      │  │
          │   │  输出 AIC更优/竞品更优/平局           │  │
          │   └──────────────┬──────────────────────┘  │
          │                  │                         │
          │                  ▼                         │
          │   ┌─────────────────────────────────────┐  │
          │   │  Step F: Suggestion Agent           │  │
          │   │  (条件触发 — 非 AIC更优 时)          │  │
          │   │  生成优化方向                         │  │
          │   └──────────────┬──────────────────────┘  │
          │                  │                         │
          │   └─ 保存本题结果 ─┘                       │
          │                                             │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │  Summary Agent        │
                    │  跨题汇总              │
                    │  → 统计 win/loss      │
                    │  → 维度平均分          │
                    │  → 竞品洞察            │
                    │  → 整体评价            │
                    │  → 优化建议 TOP 3     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Orchestrator        │
                    │  组装 + 校验 + 输出    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  analysis_result.json │
                    └──────────────────────┘
```

### Agent 调用顺序（固定 Pipeline）

```
Orchestrator → Question Loop:
  Router → Fact Check? → Quality Review → Comparison → Judgment → Suggestion?
→ Summary → Orchestrator → 输出
```

---

## 2. 每个 Agent 的职责

### 2.1 Orchestrator Agent（编排器）

| 维度 | 说明 |
|------|------|
| **Input** | `today.json` 文件路径或内容字符串 |
| **Output** | `analysis_result.json`（写入文件） |
| **Responsibility** | (a) 解析 `today.json`，校验结构完整性；(b) 驱动 Question Loop，逐一调度下游 Agent；(c) 收集所有题目分析结果；(d) 调用 Summary Agent；(e) 组装最终输出对象；(f) 执行输出校验；(g) 写入文件 |
| **Out of Scope** | 不执行任何具体的分析逻辑。不评分。不比较。不生成建议。不联网搜索。 |

### 2.2 Router Agent（策略路由器）

| 维度 | 说明 |
|------|------|
| **Input** | 单个 Question 对象（含 `questionType`、`question` 文本） |
| **Output** | 策略决策对象：`{ questionType, weightMatrix, needsFactCheck, fcType }` |
| **Responsibility** | (a) 根据 `questionType` 选择合适的 7 维权重矩阵；(b) 判断是否需要 Fact Check 及校验类型（强制/部分/跳过）；(c) 识别问题中的特殊标记（如含数字、日期、人名等需额外校验的信号） |
| **Out of Scope** | 不执行任何分析。不评分。不搜索。 |

### 2.3 Fact Check Agent（事实校验）

| 维度 | 说明 |
|------|------|
| **Input** | 问题文本 + AIC 回答 + 所有竞品回答 + Router 决策（`fcType`） |
| **Output** | `fcResult` 对象：`{ required, result, issues[], sources[], confidence, summary }` |
| **Responsibility** | (a) 根据 `fcType` 决定校验深度；(b) 从回答中提取可验证的**事实主张（claims）**；(c) 对每条主张进行联网搜索验证（调用 Web Search 工具）；(d) 数学计算验证（调用 Calculator 工具）；(e) 时间/日期类验证；(f) 交叉验证（≥2 来源）；(g) 输出每个主张的 verdict + source + confidence |
| **Out of Scope** | 不评分。不比较竞品。不判断回答质量。不处理创作类问题的事实校验（直接返回"不适用"）。 |
| **External Tools** | ✅ Web Search、✅ Calculator |

### 2.4 Quality Review Agent（质量评分）

| 维度 | 说明 |
|------|------|
| **Input** | 问题 + 回答者名称 + 回答文本 + 问题类型权重矩阵 + fcResult（如有） |
| **Output** | `qualityScores` 对象：`{ totalScore, dimensions: { completeness, accuracy, professionalism, structure, usability, naturalness, creativity } }` |
| **Responsibility** | (a) 对每个回答者（AIC + 每个竞品）独立评分；(b) 按 7 个维度逐一评估；(c) 对每个维度先写 comment 理由再打 1–5 分；(d) 权重=0 的维度自动返回 `{ score: 0, comment: "不适用" }`；(e) 若 fcResult 有事实错误，Accuracy 维度自动 ≤ 2 分；(f) 计算加权总分 |
| **Out of Scope** | 不比较竞品。不做 Fact Check。不判断优劣。不生成建议。 |
| **External Tools** | ❌ 不调用外部工具。仅使用 LLM 能力。 |

### 2.5 Comparison Agent（竞品比较）

| 维度 | 说明 |
|------|------|
| **Input** | AIC 的 `qualityScores` + 每个竞品的 `qualityScores` + 权重矩阵 |
| **Output** | `comparison` 对象：`{ aicWins[], competitorWins: { 竞品名: [] }, tie[], summary }` |
| **Responsibility** | (a) 逐维度比较 AIC vs 每个竞品；(b) 分差 ≥ 2 判定为领先；(c) 分差 ≤ 1 判定为持平；(d) 权重=0 维度自动归入 tie；(e) 生成 1–2 句自然语言比较总结 |
| **Out of Scope** | 不评分。不判断最终优劣。不生成建议。不做 Fact Check。 |
| **External Tools** | ❌ 纯规则引擎，不调用 LLM 或外部工具。 |

### 2.6 Judgment Agent（优劣判断）

| 维度 | 说明 |
|------|------|
| **Input** | AIC `totalScore` + 所有竞品 `totalScore` + `fcResult` + `comparison` |
| **Output** | `overallJudgment`：`"AIC更优"` / `"竞品更优"` / `"平局"` + 简短理由 |
| **Responsibility** | (a) 按优先级检查特殊情况（AIC FC未通过、AIC回答为空等）；(b) 计算分差 = AIC总分 − max(竞品总分)；(c) 按阈值规则判定（diff > 3 → AIC更优；-3 ≤ diff ≤ 3 → 平局；diff < -3 → 竞品更优）；(d) 输出判定结论 |
| **Out of Scope** | 不评分。不比较细节。不生成建议。 |
| **External Tools** | ❌ 纯规则引擎。 |

### 2.7 Suggestion Agent（优化建议）

| 维度 | 说明 |
|------|------|
| **Input** | `overallJudgment` + AIC `qualityScores` + `comparison` |
| **Output** | `notes`：建议文本或空字符串 |
| **Responsibility** | (a) 判断是否需要生成建议（仅 `平局` 或 `竞品更优` 时生成）；(b) 识别 AIC 得分 ≤ 2 的维度或 comparison 中 AIC 落后的维度；(c) 基于低分维度生成 1–3 条具体可执行的优化方向；(d) 优先选择高权重低分维度 |
| **Out of Scope** | 不评分。不比较。不判断优劣。AIC更优时不生成任何建议。 |
| **External Tools** | ✅ 可使用 LLM（建议生成需要自然语言能力）。 |

### 2.8 Summary Agent（每日汇总）

| 维度 | 说明 |
|------|------|
| **Input** | 所有题目的完整分析结果 + `competitorMeta` |
| **Output** | `dailySummary` 对象：`{ overallAssessment, strengths[], weaknesses[], competitorInsights, winLossSummary, recommendations[] }` |
| **Responsibility** | (a) 统计 win/loss/tie 计数；(b) 计算 AIC 7 维跨题平均分；(c) 提炼 AIC 的优势能力和当前短板；(d) 为每个竞品生成 1–2 句洞察；(e) 汇总所有题目的 `notes`，去重提取 TOP 3 优化建议；(f) 综合以上生成 100–200 字整体评价 |
| **Out of Scope** | 不评分。不比较单题。不搜索。不判断单题优劣。 |
| **External Tools** | ✅ 可使用 LLM（生成自然语言总结）。 |

---

## 3. Agent 间的数据流

```
today.json
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Orchestrator                                                │
│   解析 → { date, questions[], competitorMeta[] }            │
│   传递给 Question Loop                                       │
└─────────────────────────────────────────────────────────────┘
    │
    │  对每道题:
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Router                                                      │
│   Input:  question { questionIndex, questionType,           │
│            question, aic, competitors[] }                   │
│   Output: strategy { questionType, weightMatrix,            │
│            needsFactCheck: true/false/"partial",            │
│            fcType: "mandatory"/"partial"/"skip" }           │
│                                                             │
│   传递给 Fact Check & Quality Review                         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Fact Check Agent (条件触发)                                   │
│   Input:  strategy + question + aic.answer                  │
│           + competitors[].answer                             │
│   Output: fcResult { required, result, issues[],            │
│            sources[], confidence, summary }                  │
│                                                             │
│   传递给 Quality Review & Judgment                           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Quality Review Agent                                         │
│   Input:  question + aic.answer + competitors[].answer      │
│           + strategy.weightMatrix + fcResult                 │
│                                                             │
│   Process: 对 AIC 评分 → 对每个竞品评分                       │
│                                                             │
│   Output: qualityScores {                                   │
│     aic: { totalScore, dimensions },                        │
│     competitors: { "竞品名": { totalScore, dimensions } }   │
│   }                                                         │
│                                                             │
│   传递给 Comparison & Judgment                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Comparison Agent                                             │
│   Input:  qualityScores + strategy.weightMatrix             │
│   Output: comparison { aicWins[], competitorWins, tie[],    │
│            summary }                                         │
│                                                             │
│   传递给 Judgment                                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Judgment Agent                                               │
│   Input:  qualityScores + comparison + fcResult             │
│   Output: overallJudgment: "AIC更优"|"竞品更优"|"平局"       │
│                                                             │
│   传递给 Suggestion                                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Suggestion Agent (条件触发)                                   │
│   Input:  overallJudgment + qualityScores.aic + comparison  │
│   Output: notes: string | ""                                │
│                                                             │
│   本题结果保存到 results[]                                    │
└─────────────────────────────────────────────────────────────┘
    │
    │  所有题完成后:
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Summary Agent                                                │
│   Input:  results[] (所有题的分析结果) + competitorMeta      │
│   Output: dailySummary { overallAssessment, strengths[],    │
│            weaknesses[], competitorInsights,                │
│            winLossSummary, recommendations[] }               │
│                                                             │
│   传递给 Orchestrator 组装                                     │
└─────────────────────────────────────────────────────────────┘
```

### 数据流串联图

```
Router ──strategy──▶ Fact Check ──fcResult──▶ Quality Review
                                                  │
                                                  │ qualityScores
                                                  ▼
                               Judgment ◀── Comparison
                                  │              ▲
                                  │              │
                                  ▼         qualityScores
                              Suggestion         │
                                  │              │
                                  ▼              │
                              notes          (来自 Quality Review)
```

---

## 4. 外部能力调用权限

### 4.1 能力矩阵

| Agent | Web Search | Calculator | OCR | LLM | 规则引擎 |
|-------|-----------|------------|-----|-----|---------|
| Orchestrator | ❌ | ❌ | ❌ | ❌ | ✅ |
| Router | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fact Check | ✅ | ✅ | ❌ | ✅ | ✅ |
| Quality Review | ❌ | ❌ | ❌ | ✅ | ❌ |
| Comparison | ❌ | ❌ | ❌ | ❌ | ✅ |
| Judgment | ❌ | ❌ | ❌ | ❌ | ✅ |
| Suggestion | ❌ | ❌ | ❌ | ✅ | ❌ |
| Summary | ❌ | ❌ | ❌ | ✅ | ✅ |

### 4.2 外部能力详细说明

**Web Search（联网搜索）**
- **调用者**：仅 Fact Check Agent
- **用途**：验证回答中的事实主张（claim）
- **调用方式**：发送搜索查询 → 获取 top N 结果 → 提取摘要 → 交叉验证
- **约束**：每条 claim 至少搜索 1 次。关键 claim 搜索 ≥2 次获取多来源。

**Calculator（计算器）**
- **调用者**：仅 Fact Check Agent
- **用途**：验证回答中的数学计算、时间跨度、数据换算
- **调用方式**：提取算术表达式 → 执行计算 → 比较结果
- **约束**：仅用于纯数值验证，不用于复杂推理。

**LLM（大语言模型）**
- **调用者**：Quality Review / Suggestion / Summary
- **用途**：自然语言理解、维度评分、建议生成、总结撰写
- **调用方式**：构造结构化 Prompt → 调用 LLM API → 解析 JSON 输出
- **约束**：所有 LLM 调用需带 `response_format: json` 或 tool-use 确保结构化输出。

**OCR（光学字符识别）**
- **调用者**：**暂无**（未来可分配给 Fact Check Agent 或新增的 Screenshot Agent）
- **用途**：识别截图中包含的回答文本或补充信息
- **约定**：当前版本不启用 OCR。Screenshot 仅作为报告中的图片附件，不参与分析。

### 4.3 能力调用原则

1. **最小权限**：Agent 只拥有完成自身职责所需的最小能力集。
2. **显式声明**：每个 Agent 的外部能力调用在配置中显式声明，不隐式调用。
3. **可审计**：每次外部调用（搜索 URL、LLM 请求、计算结果）记录在分析日志中。
4. **超时控制**：每次外部调用有 30s 超时。超时后降级处理。

---

## 5. 错误处理

### 5.1 错误处理总原则

| 原则 | 说明 |
|------|------|
| **不崩溃** | 任何单个 Agent 失败不导致整个 Pipeline 崩溃 |
| **标注错误** | 失败后在该题目的 `analysis.error` 中记录错误信息 |
| **继续执行** | 标注后继续下一题或下一步，不阻塞后续流程 |
| **降级输出** | 尽量输出部分结果，不因一个失败丢弃全部数据 |
| **日志记录** | 所有异常写入日志，供事后排查 |

### 5.2 各场景处理

#### Fact Check 相关

| 场景 | 处理 |
|------|------|
| 联网搜索超时（30s） | 该 claim 标记为 `"无法验证"`，confidence = `"低"`，继续下一个 claim |
| 搜索结果无相关信息 | claim 标记为 `"无法确定"`，confidence = `"低"` |
| 只找到 1 个来源 | 仍可验证，但 confidence 降为 `"中"` |
| AIC 回答为空 | Fact Check 跳过（无内容可校验），`fcResult.result = "不适用"` |
| 所有回答都为空 | 直接跳过 Fact Check 步骤，不浪费搜索调用 |
| Web Search API 不可用 | 终止 Fact Check。`fcResult.result = "无法验证（网络不可用）"`。**不要阻塞后续评分**。 |

#### Quality Review 相关

| 场景 | 处理 |
|------|------|
| LLM 调用返回非 JSON | 重试 1 次。仍失败 → 该回答者评分标记 `analysis.error`，继续下一个回答者 |
| LLM 调用超时 | 同上。重试 1 次，失败则标记错误继续 |
| 某竞品回答为空 | 该竞品所有维度 score = 1，comment = `"竞品未提供回答"` |
| AIC 回答为空 | 特殊情况，由 Judgment Agent 最终处理。评分仍执行但 score 全为 1 |

#### Comparison / Judgment 相关

| 场景 | 处理 |
|------|------|
| 某回答者评分缺失（因 LLM 失败） | 该回答者不参与比较和判断 |
| 只有 AIC 评分，所有竞品评分缺失 | `overallJudgment = "AIC更优"`（唯一有效回答），但加注释说明 |
| 所有评分都缺失 | `overallJudgment = "无法判断"`，写入 `analysis.error` |

#### Suggestion 相关

| 场景 | 处理 |
|------|------|
| LLM 调用失败 | `notes = ""` 留空，不阻塞输出 |
| 无法识别低分维度 | `notes = ""` 留空 |

#### Summary 相关

| 场景 | 处理 |
|------|------|
| LLM 调用失败 | `dailySummary` 用纯统计数据填充（win/loss 计数 + 平均分），自然语言字段填 `"N/A"` |
| 单题数据不完整 | 该题不参与跨题统计（如维度平均分），但 win/loss 仍计入 |
| 所有题都分析失败 | 输出 `dailySummary` 但所有字段填 `"数据不足，无法汇总"` |

#### Orchestrator 相关

| 场景 | 处理 |
|------|------|
| `today.json` 文件不存在 | 直接报错退出，不启动 Pipeline |
| JSON 格式错误 | 直接报错退出，输出具体错误位置 |
| 写入文件权限不足 | 报错退出，输出文件路径和权限提示 |
| 内存不足 | 逐题写入（流式），不一次性加载所有结果 |

---

## 6. 可扩展性

### 6.1 扩展架构

```
                          Orchestrator
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌────────────┐      ┌────────────┐      ┌────────────┐
   │ 核心 Agent  │      │ 可选 Agent  │      │ 未来 Agent  │
   │ (必执行)    │      │ (条件触发)   │      │ (可插拔)    │
   │            │      │            │      │            │
   │ Router     │      │ Fact Check │      │ SEO        │
   │ Quality    │      │ Suggestion │      │ Multi-Lang │
   │ Comparison │      │            │      │ Image QA   │
   │ Judgment   │      │            │      │ Trend      │
   │ Summary    │      │            │      │ ...        │
   └────────────┘      └────────────┘      └────────────┘
```

### 6.2 新增 Agent 的方法

**步骤 1：定义接口**

每个 Agent 实现统一接口：

```
Agent {
  name: string;           // Agent 唯一标识
  version: string;        // Agent 版本号
  required: boolean;      // 是否必须执行
  trigger: (context) => boolean;  // 条件触发判断
  execute: (input) => Output;     // 执行逻辑
}
```

**步骤 2：插入 Pipeline**

在 Orchestrator 的 Agent 注册表中添加新 Agent，指定其在 Pipeline 中的位置（插入点）。

**步骤 3：定义输入输出**

新 Agent 的 Input 类型只引用已有的标准数据类型，不创建新的跨 Agent 依赖。

**步骤 4：不影响现有 Agent**

现有 Agent 不感知新 Agent 的存在。新 Agent 从 Pipeline 上下文读取数据，不修改已有 Agent 的输出。

### 6.3 未来 Agent 规划

| Agent | 触发时机 | 输入 | 输出 | 依赖 |
|-------|---------|------|------|------|
| **SEO Analysis Agent** | 创作生成类问题 | 问题 + AIC回答 + 竞品回答 | SEO 评分（关键词覆盖、标题优化等） | Quality Review 的 score |
| **Multi-Language Agent** | 回答含多语言 | 回答文本 | 语言质量评估（翻译准确性、文化适配） | 无 |
| **Image Quality Agent** | 回答含截图 | 截图文件 | 截图清晰度、信息可读性评估 | OCR（未来） |
| **Trend Analysis Agent** | 播放所有历史 analysis_result | 多天 analysis_result | 趋势报告（能力变化曲线、竞品改进速度） | History 数据库 |
| **Bias Detection Agent** | 所有问题 | 回答文本 | 偏见检测报告（政治、性别、文化偏见） | 无 |
| **Citation Quality Agent** | 信息问答类 | 回答 + fcResult.sources | 引用质量评估（来源权威性、时效性） | Fact Check |
| **Safety Agent** | 所有问题 | 回答文本 | 安全风险标签（有害内容、越狱风险） | 无 |

### 6.4 版本兼容

- Agent 版本号独立管理。升级单个 Agent 不影响 Pipeline 的其他部分。
- `analysis_result.json` 中的 `analysisVersion` 记录整个分析引擎的版本。
- 每个 Agent 在输出中记录自己的版本号，便于追踪分析结果由哪个版本的 Agent 生成。
- 新增维度时，旧版 `analysis_result.json` 仍可被 Report 模块读取（缺失字段填默认值）。

---

## 附录 A：Agent 调用次数估算

每天分析 5 道题 × N 个竞品（通常 3 个）的情况下：

| Agent | 每题调用次数 | 每天总调用 | 说明 |
|-------|-------------|-----------|------|
| Router | 1 | 5 | 每道题 1 次 |
| Fact Check | 0–1 | 0–5 | 仅 Information/Tool 类触发 |
| Quality Review | 1 + N | 5 × 4 = 20 | AIC + 3 个竞品，每个 1 次 LLM 调用 |
| Comparison | 1 | 5 | 纯规则引擎，无外部调用 |
| Judgment | 1 | 5 | 纯规则引擎 |
| Suggestion | 0–1 | 0–5 | 仅非 AIC更优时触发 |
| Summary | 1 | 1 | 跨题汇总 |
| **LLM 调用总计** | — | **21–26** | Quality Review (20) + Suggestion (0–5) + Summary (1) |
| **Web Search 总计** | — | **0–15** | 每道 Information 题约 3 次搜索 |

---

## 附录 B：与 Workflow 文档的对应关系

| `analysis_workflow.md` 步骤 | 对应 Agent |
|-----------------------------|-----------|
| Step 1: 读取 & 解析 | Orchestrator |
| Step 2.1: 读取回答 | Router |
| Step 2.2: Fact Check | Fact Check Agent |
| Step 2.3: Quality Review | Quality Review Agent |
| Step 2.4: Comparison | Comparison Agent |
| Step 2.5: Winner Decision | Judgment Agent |
| Step 2.6: Suggestion | Suggestion Agent |
| Step 2.7: 保存 | Orchestrator |
| Step 3: Daily Summary | Summary Agent |
| Step 4: 输出 | Orchestrator |

---

**文档结束**

本文档定义了 Analysis 模块的多 Agent 协作架构。
后续开发时，每个 Agent 按照本文档定义的接口、职责、数据流和错误处理规范独立实现。
