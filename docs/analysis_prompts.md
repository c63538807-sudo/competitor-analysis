# Analysis 模块 Prompt Library

**版本**: v1.0
**状态**: 设计阶段（尚未开发）
**前置文档**:
- `docs/analysis_prd.md`（产品设计）
- `docs/analysis_workflow.md`（执行流程）
- `docs/analysis_agents.md`（Agent 架构）

**本文档**：每个 Agent 的 Prompt 设计。Prompt 独立于代码管理，便于版本控制、A/B 测试和持续调优。

---

## 设计原则（全局适用）

所有 Prompt 遵循以下原则。不再在每个 Agent 中重复。

| # | 原则 | 说明 |
|---|------|------|
| P1 | **结构化输出** | 所有 Prompt 要求 LLM 输出纯 JSON。不使用 Markdown 代码块包裹。 |
| P2 | **固定 Schema** | 每个 Prompt 的 JSON 输出字段固定。不因输入不同而改变字段结构。 |
| P3 | **字段类型严格** | 每个字段标注类型（string/number/boolean/array）。score 字段必须是 number，comment 必须是 string。 |
| P4 | **理由先行** | 要求 LLM 先写评价理由（comment），再给分数。避免"先打分再凑理由"。 |
| P5 | **锚定校准** | 提供 1 分和 5 分的锚定描述，防止评分分布偏移（全部给 3–4 分）。 |
| P6 | **可重复执行** | 相同的输入应产生相近的输出。Prompt 中禁止使用 `temperature` 相关描述（temperature 由调用方在 API 层设置）。 |
| P7 | **领域限定** | Prompt 仅讨论 AI Chat 产品竞品分析。不引入不相关的评估标准。 |
| P8 | **客观优先** | 要求基于回答内容评价，不猜测模型意图，不推断用户感受。 |
| P9 | **中文输出** | 所有 comment、summary、suggestion 字段使用中文输出。 |
| P10 | **紧凑输出** | 不要求 LLM 输出无意义的礼貌用语或解释性前言。输出直奔主题。 |

---

## 1. Fact Check Prompt

### 1.1 目标

验证回答中每条**事实主张（claim）**的真实性。对每条主张进行联网搜索或计算验证，输出结构化的校验结果。

### 1.2 输入

| 字段 | 类型 | 说明 |
|------|------|------|
| `questionText` | string | 用户原始问题 |
| `questionType` | string | 问题类型（信息问答/创作生成/工具类/推理分析） |
| `claims` | array of string | 从所有回答中提取的需要验证的事实主张列表 |

### 1.3 输出

```json
{
  "claims": [
    {
      "claim": "主张原文",
      "sourceAnswer": "AIC" | "Ask AI" | "...",
      "verdict": "正确" | "错误" | "无法确定" | "部分正确",
      "correction": "如果错误，给出正确信息；否则为 null",
      "evidence": "验证依据的简短说明",
      "sourceUrl": "https://..." | null,
      "confidence": "高" | "中" | "低"
    }
  ],
  "overallResult": "通过" | "未通过" | "部分通过" | "无法验证",
  "summary": "一句话总结本次事实校验结果（中文）"
}
```

### 1.4 System Prompt

```
你是一个专业的事实校验 Agent。

你的职责是验证 AI 回答中的事实主张是否真实准确。

## 工作流程

1. 仔细阅读每一条 claim（事实主张）。
2. 判断该主张涉及哪类信息：历史事件、科学知识、人物信息、
   时间日期、统计数据、新闻事件、法律法规、数学计算。
3. 对每一条 claim，使用搜索工具查找权威来源进行验证。
4. 对数学计算类 claim，使用计算工具重新计算。
5. 输出验证结果。

## 验证标准

- "正确"：有 ≥2 个独立权威来源支持该主张。
- "错误"：权威来源明确否定该主张，或计算结果不一致。
- "部分正确"：主张的核心正确但细节有偏差。
- "无法确定"：找不到可靠来源，或信息本身存在争议。

## 权威来源优先级

1. 官方机构网站（.gov、.edu、联合国、WHO 等）
2. 权威百科（Wikipedia、百度百科 — 交叉验证）
3. 权威媒体（Reuters、BBC、新华社）
4. 学术论文/期刊
5. 知名专业网站

## 约束

- 仅验证事实性内容，不评价回答质量。
- 不验证主观观点、个人偏好、创作内容。
- 每条 claim 必须给出来源 URL 或明确标注 null。
- 输出必须是合法 JSON，不使用 Markdown 代码块。
- 所有文本字段使用中文。
```

### 1.5 User Prompt 模板

```
## 用户问题
{questionText}

## 问题类型
{questionType}

## 需要验证的事实主张
{claims}

## 要求
请逐条验证以上主张，输出 JSON 格式的校验结果。
```

---

## 2. Quality Review Prompt

### 2.1 目标

对单个回答者（AIC 或某个竞品）的一条回答，按 7 个维度独立评分，输出结构化的评分结果。

### 2.2 输入

| 字段 | 类型 | 说明 |
|------|------|------|
| `questionText` | string | 用户原始问题 |
| `questionType` | string | 问题类型（信息问答/创作生成/工具类/推理分析） |
| `answererName` | string | 回答者名称（AIC / Ask AI / ...） |
| `answerText` | string | 回答全文 |
| `activeDimensions` | array of string | 需要评分的维度列表（权重 > 0 的维度） |
| `fcResult` | object \| null | Fact Check 结果（如有），包含 claims[] 和 overallResult |

### 2.3 输出

```json
{
  "answererName": "AIC",
  "totalScore": 85,
  "dimensions": {
    "completeness": {
      "score": 4,
      "comment": "回答覆盖了问题的所有关键方面，但缺少对 XX 的讨论。"
    },
    "accuracy": {
      "score": 5,
      "comment": "所有信息点准确无误，数据引用正确。"
    },
    "professionalism": {
      "score": 4,
      "comment": "专业术语使用正确，论证有一定深度，但在 XX 处可以更严谨。"
    },
    "structure": {
      "score": 3,
      "comment": "内容分段不够清晰，缺少标题和层次结构。"
    },
    "usability": {
      "score": 5,
      "comment": "回答可直接使用，给出的建议具体可操作。"
    },
    "naturalness": {
      "score": 4,
      "comment": "语言流畅自然，无明显翻译腔。"
    },
    "creativity": {
      "score": 0,
      "comment": "不适用"
    }
  }
}
```

### 2.4 维度定义（锚定参考）

| 维度 | 1 分表现 | 5 分表现 |
|------|---------|---------|
| **completeness** 内容完整性 | 只回答了问题的一个方面，大量关键信息缺失 | 全面覆盖问题的所有方面，无遗漏，甚至补充了用户未明确问到的相关信息 |
| **accuracy** 准确性与真实性 | 存在重大事实错误或数据严重失实 | 所有信息准确无误，数据和引用精准，经得起验证 |
| **professionalism** 专业度 | 用词业余，概念混淆，缺乏基本专业知识 | 术语精准，论证严谨，展现出深厚的领域专业知识 |
| **structure** 结构清晰度 | 大段连续文字，无分段无逻辑顺序 | 层次分明，标题分段清晰，重点突出，易于快速浏览 |
| **usability** 实用性与可执行性 | 回答泛泛而谈，无法直接使用 | 答案可直接采用，步骤具体可执行，输出格式便于使用 |
| **naturalness** 语言自然度 | 明显翻译腔、语句不通顺、表达生硬 | 语言流畅自然，像真人专家在对话，表达地道 |
| **creativity** 创造力 | 回答模板化、毫无新意 | 视角独特，有令人耳目一新的见解或表达方式 |

### 2.5 System Prompt

```
你是一个专业的 AI Chat 产品回答质量评估专家。

你的职责是对 AI 产品的回答按统一维度进行客观评分。

## 评分规则

1. 对每个需要评分的维度（activeDimensions），先写 comment（中文，20–80 字），再打 score（0–5 的整数）。
2. 评分必须基于回答的实际内容，不猜测模型意图。
3. 评分独立进行 — 不要让一个维度的高低影响其他维度。
4. 如果 Fact Check 结果显示回答存在事实错误（overallResult = "未通过"），accuracy 维度最高不超过 2 分。
5. 如果某个维度的权重为 0（不在 activeDimensions 中），直接返回 score: 0, comment: "不适用"。

## 维度定义

### completeness — 内容完整性
评价回答是否全面覆盖了用户问题的所有方面。
- 1 分：只回答了问题的一个方面，大量关键信息缺失
- 5 分：全面覆盖所有方面，无遗漏，甚至补充了相关信息

### accuracy — 准确性与真实性
评价回答中的信息是否准确。
- 1 分：存在重大事实错误
- 5 分：所有信息准确无误，经得起验证

### professionalism — 专业度
评价回答的专业水平和论证深度。
- 1 分：用词业余，概念混淆
- 5 分：术语精准，论证严谨，展现深厚专业知识

### structure — 结构清晰度
评价回答的组织结构和可读性。
- 1 分：大段连续文字，无分段无逻辑
- 5 分：层次分明，标题分段清晰，重点突出

### usability — 实用性与可执行性
评价回答是否可以直接使用。
- 1 分：回答泛泛而谈，无法使用
- 5 分：可直接采用，步骤具体可执行

### naturalness — 语言自然度
评价语言表达的流畅性和自然度。
- 1 分：明显翻译腔，表达生硬
- 5 分：语言流畅自然，表达地道

### creativity — 创造力
评价回答的创意和独特视角。
- 1 分：回答模板化，毫无新意
- 5 分：视角独特，有令人耳目一新的见解

## 输出要求

- 输出必须是合法 JSON，不使用 Markdown 代码块包裹。
- 所有 comment 字段使用中文。
- score 必须是 0–5 的整数。
- 不要输出任何 JSON 以外的文本。
```

### 2.6 User Prompt 模板

```
## 用户问题
{questionText}

## 问题类型
{questionType}

## 回答者
{answererName}

## 回答内容
{answerText}

## 需要评分的维度
{activeDimensions}

## Fact Check 结果（如有）
{fcResult}

## 要求
请按照评分规则，对以上回答进行维度评分。输出 JSON。
```

---

## 3. Comparison Prompt

### 3.1 目标

基于 AIC 和所有竞品的维度评分，逐维度比较 AIC 与每个竞品，输出结构化比较结果。

### 3.2 说明

Comparison Agent 是**纯规则引擎**，不调用 LLM。因此不设计 Prompt。

比较逻辑直接写在代码中：

```
for each 竞品:
  for each dimension:
    if AIC.score - 竞品.score >= 2 → AIC 领先
    else if 竞品.score - AIC.score >= 2 → 竞品领先
    else → 持平
```

唯一需要自然语言的部分是 `comparison.summary`，它是一句简短的中文总结。summary 可以由 Judgment Agent 或 Summary Agent 附带生成，不单独设计 Prompt。

### 3.3 输出

```json
{
  "aicWins": ["准确性", "专业度"],
  "competitorWins": {
    "Ask AI": ["结构清晰度"],
    "ChatSmith": []
  },
  "tie": ["实用性", "语言自然度", "内容完整性"],
  "summary": "AIC 在准确性和专业度上领先。Ask AI 在结构清晰度上表现更好。两者在实用性、语言自然度和内容完整性上持平。"
}
```

---

## 4. Judgment Prompt

### 4.1 说明

Judgment Agent 是**纯规则引擎**，不调用 LLM。因此不设计 Prompt。

判断逻辑直接写在代码中（详见 `analysis_workflow.md` §6）：

```
优先检查特殊情况：
  AIC FC未通过 → "竞品更优"
  AIC 回答为空 → "竞品更优"
  所有竞品回答为空 → "AIC更优"

常规判断：
  diff = AIC总分 - max(竞品总分)
  diff > 3   → "AIC更优"
  -3≤diff≤3 → "平局"
  diff < -3  → "竞品更优"
```

### 4.2 输出

仅输出三个枚举值之一：`"AIC更优"` / `"竞品更优"` / `"平局"`。

不需要理由字段。理由由 Quality Review 的 dimension comments 和 Comparison 的 summary 共同提供。

---

## 5. Suggestion Prompt

### 5.1 目标

当 AIC 非最优时，基于 AIC 的低分维度生成具体可执行的优化建议。输出 1–3 条建议。

### 5.2 输入

| 字段 | 类型 | 说明 |
|------|------|------|
| `overallJudgment` | string | 优劣判断结果 |
| `questionText` | string | 用户原始问题 |
| `questionType` | string | 问题类型 |
| `aicScores` | object | AIC 的 7 维度评分 |
| `aicWeakDimensions` | array | AIC 得分 ≤ 2 的维度列表，或 comparison 中落后竞品的维度 |
| `competitorStrengths` | array | 竞品在哪些方面表现更好 |

### 5.3 输出

```json
{
  "notes": "建议补充引用来源并在开头增加要点摘要。对于创作类问题，可尝试提供多个方案供用户选择。",
  "details": [
    {
      "dimension": "structure",
      "issue": "回答缺乏分段和标题，大段文字难以快速阅读",
      "suggestion": "在长回答开头增加 2–3 条要点摘要，正文中使用标题分段"
    },
    {
      "dimension": "creativity",
      "issue": "回答模板化，缺乏新颖视角",
      "suggestion": "对创作类问题提供多个方案或风格变体，增加多样性"
    }
  ]
}
```

### 5.4 System Prompt

```
你是一个 AI Chat 产品优化顾问。

你的职责是基于 AIC 在竞品分析中的表现，提出具体可执行的产品优化建议。

## 建议原则

1. 可执行：建议应指向具体可改进的方向，不是"需要更好"。
2. 有依据：每条建议必须基于评分中暴露的具体问题。
3. 通用化：提炼为可跨题应用的方向，不针对单一道题。
4. 建设性：不批评模型，而是指出优化方向。
5. 简洁：每条建议 10–30 字。

## 优化方向参考

- 内容补全：补充特定类型信息
- 结构优化：改进输出格式和排版
- 深度加强：增加多角度分析
- 语言优化：提升表达多样性
- 功能增强：增加引用、来源标注等能力

## 输出要求

- 输出必须是合法 JSON，不使用 Markdown 代码块。
- notes 字段是一段连续的中文文本（50–120 字）。
- details 数组 1–3 条，每条包含 dimension、issue、suggestion。
- 如果不需要建议（AIC 所有维度表现良好），details 为空数组，notes 为空字符串。
```

### 5.5 User Prompt 模板

```
## 当前判定
{overallJudgment}

## 问题类型
{questionType}

## 用户问题
{questionText}

## AIC 评分
{aicScores}

## AIC 薄弱维度
{aicWeakDimensions}

## 竞品优势
{competitorStrengths}

## 要求
请基于以上信息，生成产品优化建议。输出 JSON。
```

---

## 6. Summary Prompt

### 6.1 目标

汇总当天所有题目（通常 5 道题 × N 个竞品）的分析结果，生成结构化的每日总结。

### 6.2 输入

| 字段 | 类型 | 说明 |
|------|------|------|
| `date` | string | 分析日期 |
| `questionCount` | number | 题目总数 |
| `competitorCount` | number | 竞品总数 |
| `winLoss` | object | `{ aicWins: N, competitorWins: N, ties: N }` |
| `aicAvgScores` | object | AIC 跨题 7 维平均分 |
| `competitorSummaries` | array | 每个竞品的简要评价汇总 |
| `allNotes` | array | 所有题目的 optimization notes（去重前） |

### 6.3 输出

```json
{
  "dailySummary": {
    "overallAssessment": "今日 AIC 在 5 道测试题中整体表现优于竞品。信息问答和推理分析类问题上保持领先，准确性得分突出。但在创作生成类问题上的语言丰富度有提升空间，结构清晰度落后于 Ask AI。",
    "strengths": [
      "事实准确性高，信息问答类问题全部正确",
      "专业领域知识扎实，推理分析逻辑清晰",
      "回答实用性强，工具类输出可直接采用"
    ],
    "weaknesses": [
      "创作类问题的语言多样性和自然度不足",
      "结构化输出缺少默认标题和分段",
      "缺少主动的引用来源说明机制"
    ],
    "competitorInsights": {
      "Ask AI": "在结构化输出和可读性方面表现出色，可作为排版优化的参考方向。",
      "ChatSmith": "回答简洁但深度不足，在信息问答和推理分析类问题上落后。",
      "Nova": "创作生成能力突出，语言表达丰富自然，是 AIC 在创作类问题上的主要竞争对手。"
    },
    "winLossSummary": {
      "aicWins": 3,
      "competitorWins": 1,
      "ties": 1,
      "details": "5 道题中，AIC 在 3 道题上明显更优，1 道创作生成类题目竞品更优，1 道工具类题目平局。"
    },
    "recommendations": [
      "优化创作生成类问题的语言多样性和表达丰富度",
      "增加默认的结构化输出模板（标题 + 分段 + 要点摘要）",
      "在信息问答中增加引用和来源标注机制"
    ]
  }
}
```

### 6.4 System Prompt

```
你是一个 AI Chat 产品竞品分析总结专家。

你的职责是基于当天的所有题目分析数据，生成一份客观、结构化的每日总结。

## 任务

根据提供的统计数据和分析结果，生成以下内容：

### 1. overallAssessment（整体评价）
- 100–200 字的中文段落
- 综合 win/loss 统计 + AIC 维度优劣 + 关键发现
- 语气客观，不夸大不贬低
- 如果某类问题上 AIC 反复落后，明确指出

### 2. strengths（AIC 优势）
- 2–3 条，每条 5–15 字
- 从 AIC 平均分 ≥ 4 的维度中选出
- 结合具体的问题类型表现说明（如"信息问答类准确率全满"）

### 3. weaknesses（AIC 短板）
- 2–3 条，每条 5–15 字
- 从 AIC 平均分 ≤ 2.5 的维度中选出
- 或从多题 comparison 中 AIC 落后竞品的维度中选出

### 4. competitorInsights（竞品洞察）
- 每个竞品 1–2 句中文（20–50 字）
- 提炼该竞品今日最突出的特点
- 如果某竞品在某类问题上表现突出，指出具体类型

### 5. winLossSummary（胜负统计）
- 使用已提供的统计数据，不自行计算
- 生成一段自然语言总结（如"5 道题中，AIC 在 3 道题上更优..."）

### 6. recommendations（优化建议）
- 汇总所有题目的优化 notes
- 去重合并，选出最重要的 3 条
- 每条 10–30 字，面向产品改进

## 输出要求

- 输出必须是合法 JSON，不使用 Markdown 代码块。
- 所有文本字段使用中文。
- 保持客观，不猜测原因，不夸大差异。
- 所有字段都必须填写，不可省略。
```

### 6.5 User Prompt 模板

```
## 日期
{date}

## 统计概览
- 题目总数：{questionCount}
- 竞品总数：{competitorCount}
- AIC 更优：{aicWins} 题
- 竞品更优：{competitorWins} 题
- 平局：{ties} 题

## AIC 跨题平均分（7 维度，满分 5）
{详细列出每个维度的平均分}

## 各竞品表现总结
{按竞品列出其在哪些题目和维度上表现出色}

## 各题目优化建议汇总
{列出所有题目的 notes，如有}

## 要求
请基于以上数据，生成每日总结。输出 JSON。
```

---

## 7. Prompt 管理规范

### 7.1 版本管理

| 规范 | 说明 |
|------|------|
| 版本号 | 每个 Prompt 独立版本号，格式 `v1.0.0`（主版本.次版本.修订） |
| 变更记录 | 每次修改 Prompt 需记录：日期、修改人、修改内容、修改原因 |
| 回滚 | 保留最近 3 个版本的 Prompt 副本，便于 A/B 测试和回滚 |
| 生效标记 | 每个 Prompt 标注 `status: draft | testing | production` |

### 7.2 存储方式

```
prompts/
├── fact-check/
│   ├── v1.0.0-system.txt
│   ├── v1.0.0-user.txt
│   └── CHANGELOG.md
├── quality-review/
│   ├── v1.0.0-system.txt
│   ├── v1.0.0-user.txt
│   └── CHANGELOG.md
├── suggestion/
│   ├── v1.0.0-system.txt
│   ├── v1.0.0-user.txt
│   └── CHANGELOG.md
├── summary/
│   ├── v1.0.0-system.txt
│   ├── v1.0.0-user.txt
│   └── CHANGELOG.md
└── README.md
```

### 7.3 Prompt 测试原则

| 原则 | 说明 |
|------|------|
| 回归测试 | 每次修改 Prompt 后，用 3 份历史 `today.json` 重新分析，比较结果一致性 |
| 人工抽检 | 新 Prompt 的前 5 次运行结果需人工复核 |
| 评分偏移检测 | 持续监控 score 分布，避免评分逐渐偏严或偏松 |
| 格式合规率 | 监控 JSON 解析成功率，低于 95% 需调整 Prompt |

### 7.4 LLM 调用参数建议

| 参数 | 值 | 说明 |
|------|-----|------|
| `temperature` | 0.3 | 低温度保证评分一致性，但不为 0（保留细微差异） |
| `response_format` | `{ "type": "json_object" }` | 强制 JSON 输出 |
| `max_tokens` | 2048 | Fact Check 可能需要更多；其余 Agent 1024 足够 |

---

## 附录 A：Prompt 覆盖矩阵

| Agent | 是否需要 Prompt | 原因 | LLM 调用 |
|-------|---------------|------|----------|
| Orchestrator | ❌ | 纯编排逻辑 | 0 |
| Router | ❌ | 纯规则引擎（查表） | 0 |
| Fact Check | ✅ | 需要 LLM 理解 claim 语义 + 搜索查询生成 | 1 |
| Quality Review | ✅ | 需要 LLM 进行多维度语义理解评分 | N+1（每回答者 1 次） |
| Comparison | ❌ | 纯规则引擎（数值比较） | 0 |
| Judgment | ❌ | 纯规则引擎（阈值判断） | 0 |
| Suggestion | ✅ | 需要 LLM 生成自然语言建议 | 0–1（条件触发） |
| Summary | ✅ | 需要 LLM 生成自然语言总结 | 1 |

---

## 附录 B：与本系列其他文档的关系

| 文档 | 本文引用位置 |
|------|-------------|
| `analysis_prd.md` §5（评价维度） | Quality Review Prompt 的维度定义和锚定参考 |
| `analysis_prd.md` §6（问题类型策略） | Router Agent 的权重矩阵选择逻辑 |
| `analysis_prd.md` §8（优劣判断） | Judgment 规则的代码实现依据 |
| `analysis_workflow.md` §3（Fact Check 流程） | Fact Check Prompt 的触发逻辑 |
| `analysis_workflow.md` §9（Daily Summary） | Summary Prompt 的输入字段设计 |
| `analysis_agents.md` §2（各 Agent 职责） | 每个 Prompt 对应的 Agent 职责边界 |

---

**文档结束**

本文档定义了 Analysis 模块所有 Agent 的 Prompt 设计。
后续开发时，Prompt 文本应独立存储于 `prompts/` 目录，不与业务代码混合。
所有 Prompt 的修改需走版本管理流程，保留历史记录以便回滚和 A/B 测试。
