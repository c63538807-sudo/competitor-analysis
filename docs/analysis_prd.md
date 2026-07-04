# Analysis 模块产品设计文档

**版本**: v1.0  
**状态**: 设计阶段（尚未开发）  
**输入**: `today.json`（Collector 输出）  
**输出**: `analysis_result.json`（供 Excel Generator 与 Report Generator 消费）

---

## 1. 模块职责

### Analysis 负责

| 职责 | 说明 |
|------|------|
| 读取 `today.json` | 解析 Collector 输出的标准 JSON |
| 事实校验（Fact Check） | 对涉及事实、时间、数据、人物等问题进行联网或计算验证 |
| 回答质量评价 | 按统一维度对每个竞品的每条回答进行评分和定性评价 |
| 竞品横向比较 | 按问题维度比较所有竞品（含 AIC）的回答优劣 |
| 优劣判断 | 对每道题输出 AIC vs 竞品的总体结论 |
| 优化建议生成 | 当 AIC 非最优时，生成可操作的改进方向 |
| 每日总结生成 | 汇总当天的整体表现、优劣势和趋势判断 |
| 输出 `analysis_result.json` | 生成分析结果，保留原始数据，叠加分析字段 |

### Analysis 不负责

| 非职责 | 归属模块 |
|--------|----------|
| 数据采集 | Collector |
| 生成 Excel | Report / Excel Generator |
| 生成日报文本 | Report |
| 历史趋势统计 | History |
| 截图 OCR 识别 | 未来扩展 |
| 修改原始回答 | 禁止 — Analysis 只读原始数据 |
| 修改 Collector 数据模型 | 禁止 — 任何改动应在 Collector 侧完成 |

### 与上下游的关系

```
Collector               Analysis                Report
──────────              ──────────              ──────────
today.json  ──────►  analysis_result.json  ──────►  Excel
                                                  Daily Report
                                                  History Database
```

- **上游 Collector**：提供原始测试数据。Analysis 只读取，不写入 Collector 的存储。
- **下游 Report**：消费 `analysis_result.json`。Analysis 不关心 Excel 格式或日报模板。

---

## 2. 输入：today.json

### 完整结构回顾

```json
{
  "date": "2026-07-05",
  "questions": [
    {
      "questionIndex": 1,
      "question": "用户问题文本",
      "questionType": "信息问答",
      "targetFunction": "知识问答",
      "aic": {
        "answer": "AIC 的回答文本",
        "screenshot": "data:image/...",
        "evaluation": ""
      },
      "competitors": [
        {
          "name": "Ask AI",
          "answer": "竞品回答文本",
          "screenshot": "data:image/..."
        }
      ],
      "competitorEvaluation": "",
      "overallJudgment": "",
      "notes": ""
    }
  ],
  "competitorMeta": [
    {
      "name": "Ask AI",
      "freeCount": 3,
      "model": "GPT-5"
    }
  ]
}
```

### Analysis 读取哪些字段

| 字段路径 | 用途 | 参与分析 |
|----------|------|----------|
| `date` | 日期标记，输出至 Daily Summary | 否（元数据） |
| `questions[].questionIndex` | 问题序号 | 否（排序用） |
| `questions[].question` | 问题文本 | **是** — 理解问题意图、判断答案相关性 |
| `questions[].questionType` | 问题类型 | **是** — 决定评价维度的权重分配 |
| `questions[].targetFunction` | 指向功能 | 否（供 Report 引用） |
| `questions[].aic.answer` | AIC 回答 | **是** — 核心分析对象 |
| `questions[].aic.screenshot` | AIC 截图 | 否（供 Report 引用） |
| `questions[].aic.evaluation` | AIC 评价 | Analysis **写入**此字段 |
| `questions[].competitors[].name` | 竞品名称 | 否（标识用） |
| `questions[].competitors[].answer` | 竞品回答 | **是** — 核心分析对象 |
| `questions[].competitors[].screenshot` | 竞品截图 | 否（供 Report 引用） |
| `questions[].competitorEvaluation` | 竞品整体评价 | Analysis **写入**此字段 |
| `questions[].overallJudgment` | 优劣判断 | Analysis **写入**此字段 |
| `questions[].notes` | 优化建议 | Analysis **写入**此字段 |
| `competitorMeta[].name` | 竞品名 | 否（标识用） |
| `competitorMeta[].model` | 使用模型 | **是** — 基于模型能力调整评价预期 |
| `competitorMeta[].freeCount` | 免费次数 | 否（供 Report 引用） |

---

## 3. 输出：analysis_result.json

### 设计原则

- **叠加而非替换**：保留 `today.json` 的全部字段，在其上叠加分析结果。
- **可追溯**：每条评价附带理由，不是只给分数。
- **供下游消费**：Report 模块可以直接读取 `overallJudgment`、`competitorEvaluation` 等字段填入 Excel。

### 完整结构

```json
{
  "date": "2026-07-05",
  "generatedAt": "2026-07-05T10:30:00Z",
  "analysisVersion": "1.0",

  "questions": [
    {
      "questionIndex": 1,
      "question": "用户问题文本",
      "questionType": "信息问答",
      "targetFunction": "知识问答",

      "aic": {
        "answer": "AIC 的回答文本",
        "screenshot": "data:image/...",
        "evaluation": "回答准确完整，结构清晰，但缺少引用来源。"
      },

      "competitors": [
        {
          "name": "Ask AI",
          "answer": "竞品回答文本",
          "screenshot": "data:image/..."
        }
      ],

      "competitorEvaluation": "Ask AI 在准确性上与 AIC 持平，但结构更清晰。ChatSmith 存在事实错误。",

      "overallJudgment": "AIC更优",
      "notes": "建议补充引用来源并增加结构化分段。",

      "analysis": {
        "factCheck": {
          "required": true,
          "result": "通过",
          "details": "回答中的事实信息经联网验证，与权威来源一致。",
          "sources": [
            { "url": "https://...", "title": "诺贝尔奖官网" }
          ]
        },
        "qualityScores": {
          "aic": {
            "totalScore": 85,
            "dimensions": {
              "completeness": { "score": 4, "comment": "覆盖了所有关键信息点" },
              "accuracy": { "score": 5, "comment": "数据准确，无错误" },
              "professionalism": { "score": 4, "comment": "使用专业术语正确" },
              "structure": { "score": 3, "comment": "缺乏分段和标题" },
              "usability": { "score": 5, "comment": "直接解答用户问题" },
              "naturalness": { "score": 4, "comment": "语言流畅自然" },
              "creativity": { "score": 0, "comment": "信息问答不适用此维度" }
            }
          },
          "competitors": {
            "Ask AI": {
              "totalScore": 82,
              "dimensions": {
                "completeness": { "score": 4, "comment": "..." },
                "accuracy": { "score": 5, "comment": "..." },
                "professionalism": { "score": 3, "comment": "..." },
                "structure": { "score": 5, "comment": "..." },
                "usability": { "score": 4, "comment": "..." },
                "naturalness": { "score": 4, "comment": "..." },
                "creativity": { "score": 0, "comment": "不适用" }
              }
            }
          }
        },
        "comparison": {
          "aicWins": ["准确性", "专业度"],
          "competitorWins": { "Ask AI": ["结构清晰度"] },
          "tie": ["语言自然度", "实用性"],
          "summary": "AIC 在准确性和专业度上领先，但在结构清晰度上落后于 Ask AI。"
        },
        "optimization": {
          "priority": "中",
          "direction": "结构化输出",
          "suggestions": [
            "增加分段标题和小结",
            "在关键数据处引用来源",
            "对于长回答，在开头提供摘要"
          ]
        }
      }
    }
  ],

  "dailySummary": {
    "overallAssessment": "AIC 今日整体表现优于竞品。在信息问答和推理分析类问题上保持领先，但在创作生成类问题上的语言丰富度有提升空间。",
    "strengths": [
      "事实准确性高",
      "专业领域知识扎实",
      "推理逻辑清晰"
    ],
    "weaknesses": [
      "创作类问题的语言多样性不足",
      "结构化输出的默认格式可优化",
      "缺少主动的引用和来源说明"
    ],
    "competitorInsights": {
      "Ask AI": "在结构化输出和可读性方面表现出色。",
      "ChatSmith": "回答简洁但浅显，缺乏深度分析。",
      "Nova": "在创作生成类问题上语言表达能力强。"
    },
    "winLossSummary": {
      "aicWins": 3,
      "competitorWins": 1,
      "ties": 1,
      "details": "5 道题中，AIC 在 3 道题上明显更优，1 道平局，1 道竞品更优（创作生成类）。"
    },
    "recommendations": [
      "加强创作生成类问题的训练数据",
      "优化回答的默认结构模板",
      "在信息问答中增加引用机制"
    ]
  },

  "competitorMeta": [
    { "name": "Ask AI", "freeCount": 3, "model": "GPT-5" }
  ]
}
```

### 输出字段说明

| 顶层字段 | 来源 | 说明 |
|----------|------|------|
| `date` | 原始 | 保持 Collector 输出不变 |
| `generatedAt` | **新增** | 分析完成时间戳 |
| `analysisVersion` | **新增** | 分析引擎版本号，便于未来升级回溯 |
| `questions[].aic.evaluation` | **写入** | AIC 单题评价 |
| `questions[].competitorEvaluation` | **写入** | 所有竞品的综合评价 |
| `questions[].overallJudgment` | **写入** | `AIC更优` / `竞品更优` / `平局` |
| `questions[].notes` | **写入** | 优化建议 |
| `questions[].analysis` | **新增** | 完整分析结果（事实校验 + 评分 + 比较 + 建议） |
| `dailySummary` | **新增** | 每日综合分析总结 |

---

## 4. 分析流程（Pipeline）

```
Step 1: 读取 & 解析
  ↓ 输入: today.json
  ↓ 输出: 结构化 Session 对象

Step 2: 问题分类
  ↓ 输入: 结构化 Session
  ↓ 输出: 每道题标注分析策略（Information / Creation / Tool / Reasoning）

Step 3: 事实校验 (Fact Check)
  ↓ 输入: 问题文本 + 所有回答
  ↓ 输出: 每条回答的事实校验结果（通过 / 未通过 / 不适用）

Step 4: 维度评分 (Quality Review)
  ↓ 输入: 问题 + 回答 + 问题类型 + Fact Check 结果
  ↓ 输出: 每个竞品每条回答的 7 维度评分

Step 5: 竞品比较 (Comparison)
  ↓ 输入: 问题 + 所有竞品的维度评分
  ↓ 输出: 每道题的优劣势对比表

Step 6: 优劣判断 (Judgment)
  ↓ 输入: 比较结果 + 评分 + Fact Check
  ↓ 输出: overallJudgment（AIC更优 / 竞品更优 / 平局）

Step 7: 优化建议 (Optimization)
  ↓ 输入: 优劣判断 + AIC 评分中的低分维度
  ↓ 输出: notes（优化方向，仅在 AIC 非最优时填写）

Step 8: 每日总结 (Daily Summary)
  ↓ 输入: 全部问题的分析结果 + competitorMeta
  ↓ 输出: dailySummary 对象

Step 9: 输出 analysis_result.json
```

### 每步详细说明

**Step 3 — 事实校验**：仅对 Information 类问题强制执行。Creation 类问题默认跳过。Tool 类问题检查结果有效性。Reasoning 类问题检查逻辑自洽性。

**Step 4 — 维度评分**：7 个维度，每个 1–5 分。问题类型决定各维度的权重。

**Step 5 — 竞品比较**：按维度逐个比较 AIC 与每个竞品。输出 AIC 领先的维度、落后的维度、持平的维度。

**Step 6 — 优劣判断**：基于权重总分比较。AIC 总分 > 所有竞品总分 → AIC更优。存在竞品总分 > AIC 总分 → 竞品更优。无明显差异 → 平局。

**Step 7 — 优化建议**：仅在 `overallJudgment = 竞品更优` 或 `平局` 时生成。如果 AIC 更优，`notes` 留空。

---

## 5. 回答质量评价维度

### 七维度评分体系

| 维度 | 英文 | 分值 | 说明 | 适用场景 |
|------|------|------|------|----------|
| 内容完整性 | Completeness | 1–5 | 是否全面回答了问题的所有方面，有无遗漏 | 所有类型 |
| 准确性与真实性 | Accuracy | 1–5 | 信息是否正确，数据是否精准，有无事实错误 | Information、Tool |
| 专业度 | Professionalism | 1–5 | 术语使用是否正确，论证是否严谨，深度是否足够 | 所有类型 |
| 结构清晰度 | Structure | 1–5 | 回答是否分段清晰、层次分明、易于阅读 | 所有类型 |
| 实用性与可执行性 | Usability | 1–5 | 回答是否可直接使用，建议是否具体可操作 | Tool、Creation |
| 语言自然度 | Naturalness | 1–5 | 语言是否流畅自然，有无翻译腔或生硬表达 | Creation、所有类型 |
| 创造力 | Creativity | 1–5 | 回答是否有创意、灵感、独特的视角或表达 | Creation、Reasoning |

### 评分标准

| 分数 | 含义 |
|------|------|
| 5 | 优秀 — 明显超出预期，可作为标杆 |
| 4 | 良好 — 满足要求，有亮点 |
| 3 | 一般 — 基本合格，无明显缺陷也无突出亮点 |
| 2 | 较差 — 存在明显不足 |
| 1 | 很差 — 严重不完整或有重大错误 |
| 0 | 不适用 — 此维度不适用当前问题类型 |

### 计分规则

每个问题类型有独立的维度权重矩阵（见第 6 节）。

总分 = Σ(维度得分 × 权重) × 20 / 权重总和

（满分 100 分）

---

## 6. 不同问题类型的分析策略

### 6.1 Information（信息问答类）

**特点**：用户寻求事实、数据、知识。答案需要准确、完整、权威。

**权重矩阵**：

| 维度 | 权重 | 理由 |
|------|------|------|
| Accuracy | ×3 | 信息准确性是第一优先级 |
| Completeness | ×3 | 不能遗漏关键信息 |
| Professionalism | ×2 | 专业领域术语和深度 |
| Structure | ×2 | 复杂信息需要清晰组织 |
| Usability | ×1 | 回答直接可用 |
| Naturalness | ×1 | 基本流畅即可 |
| Creativity | ×0 | 不适用 |

**Fact Check**：**强制**。必须联网验证关键事实、时间、数据、人物。

### 6.2 Creation（创作生成类）

**特点**：用户需要生成文字、创意内容。答案需要语言质量、创造力、实用性。

**权重矩阵**：

| 维度 | 权重 | 理由 |
|------|------|------|
| Creativity | ×3 | 创作类核心需求 |
| Naturalness | ×3 | 语言表达质量直接影响输出 |
| Usability | ×2 | 生成内容是否可直接使用 |
| Structure | ×2 | 内容组织清晰 |
| Completeness | ×1 | 覆盖需求但不必过度 |
| Professionalism | ×1 | 风格匹配即可 |
| Accuracy | ×0 | 创作不涉及事实准确 |

**Fact Check**：**不适用**。创作内容无客观事实可校验。

### 6.3 Tool（工具类）

**特点**：用户需要执行具体任务：翻译、总结、格式转换、计算等。答案需要准确、可用、高效。

**权重矩阵**：

| 维度 | 权重 | 理由 |
|------|------|------|
| Usability | ×3 | 工具类输出需要直接可用 |
| Accuracy | ×3 | 翻译准确、计算正确、总结到位 |
| Completeness | ×2 | 完整覆盖输入内容 |
| Structure | ×1 | 格式清晰 |
| Naturalness | ×1 | 输出流畅 |
| Professionalism | ×1 | 术语正确 |
| Creativity | ×0 | 不适用 |

**Fact Check**：**部分适用**。翻译类检查关键词准确性；计算类验证结果；总结类检查是否遗漏关键信息。

### 6.4 Reasoning（推理分析类）

**特点**：用户需要逻辑分析、原因推断、决策建议。答案需要逻辑严谨、论证充分、有洞察力。

**权重矩阵**：

| 维度 | 权重 | 理由 |
|------|------|------|
| Professionalism | ×3 | 逻辑推理的严谨性和深度 |
| Completeness | ×2 | 分析是否覆盖所有角度 |
| Structure | ×2 | 论证层次是否清晰 |
| Creativity | ×2 | 是否有独特视角或洞察 |
| Usability | ×2 | 结论是否可指导行动 |
| Accuracy | ×1 | 引用的前提和假设是否合理 |
| Naturalness | ×1 | 表达清晰即可 |

**Fact Check**：**部分适用**。检查前提假设是否合理，不要求唯一正确答案。关注逻辑自洽性而非事实正确性。

---

## 7. 事实校验（Fact Check）

### 7.1 校验触发条件

| 条件 | 是否校验 | 校验方式 |
|------|----------|----------|
| Information 类问题 | **强制** | 联网搜索 + 权威来源对比 |
| 回答中包含具体时间 | **强制** | 计算验证（距今多久、星期几等） |
| 回答中包含数字/数据 | **强制** | 联网验证数据准确性 |
| 回答中包含人名/地名 | **强制** | 验证拼写和对应关系 |
| 回答中包含数学计算 | **强制** | 重新计算验证 |
| 回答中包含法律/医疗建议 | **强制** | 交叉验证，标注风险 |
| Creation 类问题 | **不校验** | 创作内容无客观标准 |
| Tool 类翻译 | **部分** | 检查关键术语翻译准确性 |
| Tool 类总结 | **部分** | 检查是否遗漏原文关键信息 |
| Reasoning 类 | **部分** | 检查前提假设，不验证结论 |
| 竞品回答与 AIC 回答完全一致 | **标记** | 可能是抄袭或相同模型 |

### 7.2 Fact Check 输出

```
{
  "required": true / false / "partial",
  "result": "通过" / "未通过" / "无法验证" / "不适用",
  "confidence": "高" / "中" / "低",
  "details": "人类可读的校验说明",
  "issues": [
    {
      "claim": "回答中的具体主张",
      "verdict": "正确" / "错误" / "无法确定",
      "source": "https://..." // 验证来源
    }
  ],
  "sources": [
    { "url": "https://...", "title": "来源标题", "type": "权威网站" / "百科" / "学术" / "新闻" }
  ]
}
```

### 7.3 校验原则

1. **不依赖模型记忆**：所有事实性信息必须联网搜索验证，不使用 LLM 训练数据的记忆。
2. **多来源交叉验证**：关键事实至少 2 个独立来源确认。
3. **标注置信度**：无法找到权威来源时，标注"无法验证"而非强行判断。
4. **时效性优先**：优先使用最近的信息来源。
5. **保留校验痕迹**：保留所有搜索来源 URL，供人工复核。

---

## 8. 优劣判断（Win / Loss / Tie）

### 8.1 判断规则

优劣判断基于每道题 AIC 与所有竞品的**加权总分**比较。

```
AIC 总分 vs 所有竞品中的最高总分：

  AIC 总分 > 最高竞品总分 + 阈值    → AIC更优
  AIC 总分 ≈ 最高竞品总分（差值≤阈值）→ 平局
  最高竞品总分 > AIC 总分 + 阈值    → 竞品更优
```

**阈值设定**：3 分（满分 100）。小于 3 分视为无明显差异。

### 8.2 特殊情况

| 情况 | 处理方式 |
|------|----------|
| 多个竞品表现不同 | 与最优竞品比较，在 `competitorEvaluation` 中逐一说明 |
| 某竞品 Fact Check 未通过 | 直接标注"竞品更优"不适用该竞品，总分以事实错误扣分 |
| AIC Fact Check 未通过 | 自动判定"竞品更优"，无需后续比较 |
| 所有回答都差 | 仍按规则判断，但在 Daily Summary 中说明整体质量 |
| 某竞品未回答（空文本） | 该竞品不计入比较，标注"无回答" |

### 8.3 输出值

`overallJudgment` 字段**仅允许**以下三个值：

```
"AIC更优"
"竞品更优"
"平局"
```

> 注意：不需要指出具体是哪个竞品更优。日报关注的是 AIC 是否领先整体竞品。

### 8.4 每日汇总统计

在 Daily Summary 中统计：

```
winLossSummary: {
  aicWins:   3,   // AIC 更优的题数
  competitorWins: 1,   // 竞品更优的题数
  ties:      1    // 平局的题数
}
```

---

## 9. 优化建议（Optimization Notes）

### 9.1 生成条件

| 条件 | `notes` 是否填写 |
|------|-------------------|
| `overallJudgment = "AIC更优"` | **留空** |
| `overallJudgment = "平局"` | **填写** — 说明如何拉开差距 |
| `overallJudgment = "竞品更优"` | **填写** — 说明如何追赶 |

### 9.2 建议原则

1. **可执行**：建议应指向具体可改进的方向，而非"需要更好"。
2. **有针对性**：基于 AIC 得分最低的 1–2 个维度，指出具体问题。
3. **通用化**：避免针对单道题的建议，提炼为可跨题应用的方向。
4. **建设性**：不说"AIC 不好"，而说"AIC 可补充……"。
5. **不重复**：多条建议应覆盖不同维度。

### 9.3 建议分类

| 类别 | 示例 |
|------|------|
| 内容补全 | "需要补充数据来源和引用" |
| 结构优化 | "建议增加标题分段和要点总结" |
| 语言优化 | "可提升表达的多样性和自然度" |
| 深度加强 | "建议增加案例分析或多方视角" |
| 准确性提升 | "涉及时间类问题需要更加精确" |
| 功能完善 | "对于工具类请求，建议输出可直接使用的格式" |

---

## 10. 每日总结（Daily Summary）

### 10.1 内容结构

```json
{
  "dailySummary": {
    "overallAssessment": "一段 100–200 字的整体评价",
    "strengths": ["优势能力 1", "优势能力 2", "..."],
    "weaknesses": ["当前短板 1", "当前短板 2", "..."],
    "competitorInsights": {
      "竞品名": "该竞品今日表现的简要评价"
    },
    "winLossSummary": {
      "aicWins": 3,
      "competitorWins": 1,
      "ties": 1,
      "details": "5 道题中，AIC 在 3 道题上明显更优..."
    },
    "recommendations": [
      "优化方向 1",
      "优化方向 2"
    ]
  }
}
```

### 10.2 生成规则

| 字段 | 生成方式 |
|------|----------|
| `overallAssessment` | 基于 win/loss 统计 + 整体质量水平，生成客观总结 |
| `strengths` | 从 AIC 得分最高的维度中提取，重复出现的能力优先 |
| `weaknesses` | 从 AIC 得分最低的维度中提取，多题共性问题优先 |
| `competitorInsights` | 每个竞品提炼其最突出的特点（正面或负面） |
| `winLossSummary` | 纯统计数据，无主观加工 |
| `recommendations` | 汇总各题 `notes` 中的共性建议，去重后输出最重要的 3 条 |

---

## 11. 模块拆分（代码结构建议）

```
analysis/
├── index.ts                  # 主入口，编排 Pipeline
├── pipeline.ts               # Pipeline 执行引擎（步骤编排）
│
├── fact-check/
│   ├── index.ts              # Fact Check 模块入口
│   ├── triggers.ts           # 判断是否需要校验 + 校验类型
│   ├── web-search.ts         # 联网搜索（调用搜索 API 或 LLM tool-use）
│   ├── math-verify.ts        # 数学计算验证
│   ├── time-verify.ts        # 时间/日期类验证
│   └── sources.ts            # 来源管理与可信度评估
│
├── quality-review/
│   ├── index.ts              # 评分模块入口
│   ├── dimensions.ts         # 7 维度定义 + 评分标准
│   ├── scorer.ts             # 评分执行（调用 LLM 进行维度评分）
│   ├── weights.ts            # 不同问题类型的权重矩阵
│   └── calculator.ts         # 加权总分计算
│
├── comparison/
│   ├── index.ts              # 竞品比较模块入口
│   ├── comparator.ts         # 按维度横向比较 AIC vs 每个竞品
│   └── diff-report.ts        # 生成差异报告（AIC 领先/落后/持平）
│
├── judgment/
│   ├── index.ts              # 优劣判断模块入口
│   ├── rules.ts              # 判断规则定义（含阈值）
│   └── decision.ts           # 执行判断 + 处理特殊情况
│
├── optimization/
│   ├── index.ts              # 优化建议模块入口
│   ├── triggers.ts           # 判断是否需要生成建议
│   └── suggestions.ts        # 基于低分维度生成优化方向
│
├── summary/
│   ├── index.ts              # 每日总结模块入口
│   ├── stats.ts              # 统计分析（win/loss 计数、平均分）
│   ├── insights.ts           # 竞品洞察提炼
│   └── report.ts             # 生成 dailySummary 对象
│
├── types.ts                  # Analysis 模块专用类型定义
├── constants.ts              # 阈值、权重、评分标准等常量
└── utils.ts                  # 通用工具函数
```

### 模块职责速查

| 模块 | 职责 |
|------|------|
| `pipeline` | 编排 8 个步骤的顺序执行，处理步骤间数据传递 |
| `fact-check` | 联网验证、计算验证、时间验证，输出校验结果 |
| `quality-review` | 7 维度评分，加权计算总分 |
| `comparison` | 逐维度比较 AIC 与竞品，识别优劣势 |
| `judgment` | 基于规则输出 AIC更优 / 竞品更优 / 平局 |
| `optimization` | 当 AIC 非最优时生成优化方向 |
| `summary` | 汇总当日所有分析，生成 Daily Summary |

---

## 12. 后续开发路线

### Phase 1：核心分析引擎（基础 Pipeline）

**目标**：跑通从 `today.json` 到 `analysis_result.json` 的完整流程。

- 实现 Pipeline 编排框架
- 实现维度评分模块（7 维度 × 问题类型权重）
- 实现比较模块 + 优劣判断规则
- 输出基本 `analysis_result.json`
- **暂不实现** Fact Check（用占位/模拟数据）
- **暂不实现** Daily Summary（用简单统计替代）

**可验证**：输入一份真实 `today.json`，手动检查每个评价是否合理。

### Phase 2：Fact Check 集成

**目标**：事实校验成为真正的自动化能力。

- 实现联网搜索模块
- 实现数学/时间验证
- 将 Fact Check 结果集成到评分中（事实错误自动扣分）
- 优化评分 Prompt 使其考虑 Fact Check 结果

**可验证**：选择 Information 类问题，验证回答中的事实性内容能否被正确检出。

### Phase 3：优化建议 + 每日总结

**目标**：输出完整可用的 `analysis_result.json`。

- 实现优化建议模块（基于低分维度）
- 实现 Daily Summary（统计分析 + 洞察提炼）
- 全链路集成测试
- 与 Collector 输出格式最终对齐

**可验证**：走完完整流程（Collector 导出 → Analysis 分析 → 人工检查结果的合理性和一致性）。

### Phase 4：持续优化

- Prompt 调优（基于人工复核反馈迭代评分 Prompt）
- 评分一致性校准（多轮测试确保评分标准一致）
- 新增评价维度（根据实际使用需求）
- 性能优化（并行分析多个问题/竞品）

---

## 附录 A：与 Collector 的接口约定

| Collector 输出 | Analysis 消费 | 说明 |
|---------------|---------------|------|
| `today.json` | `analysis_result.json` | Analysis 读取 Collector 输出，叠加分析字段后输出新文件 |
| Collector 不修改 | Analysis 只读 | Analysis 绝不修改 Collector 的存储 |
| JSON 格式 | JSON 格式 | 统一 JSON，不引入其他格式 |

## 附录 B：与 Report 的接口约定

| Analysis 输出 | Report 消费 | 说明 |
|---------------|-------------|------|
| `questions[].overallJudgment` | 填 Excel 优劣判断列 | 三选一值 |
| `questions[].aic.evaluation` | 填 Excel AIC 表现评价列 | 定性的文本评价 |
| `questions[].competitorEvaluation` | 填 Excel 竞品表现评价列 | 聚合评价 |
| `questions[].notes` | 填 Excel 备注/优化建议列 | 条件填写 |
| `dailySummary` | 日报生成 | 结构化的总结数据 |
| `questions[].analysis.qualityScores` | 趋势分析（History） | 历史数据沉淀用 |

## 附录 C：评分 Prompt 设计原则（供 Phase 1 实现参考）

评分 Prompt 应遵循：

1. **结构化输出**：要求 LLM 返回 JSON 格式的评分，而非自由文本。
2. **维度独立**：每个维度独立评分，避免 halo effect（一个维度好导致其他维度也高分）。
3. **锚定参考**：提供 1 分和 5 分的示例，帮助模型校准。
4. **理由先行**：先写每个维度的评分理由，再打分数。
5. **多轮一致性**：使用固定的评分 Prompt 模板，确保不同题目的评分标准一致。
6. **Fact Check 优先**：评分前先注入 Fact Check 结果，确保评分考虑了事实准确性。

---

**文档结束**

本文档定义了 Analysis 模块的完整产品设计。
后续开发应严格遵循本 PRD 的接口约定和模块边界。
