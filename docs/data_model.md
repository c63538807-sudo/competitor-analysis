# 数据模型规范

## 1. 总体原则

- JSON 是整个系统唯一的数据交换格式。
- Collector 输出 JSON，Analysis 和 Report 仅消费 JSON。
- 数据模型必须支持动态数量的竞品，不依赖固定 `2` 个或 `3` 个竞品。
- 该文档定义 `Collector` 输出的标准 JSON 结构和 `Analysis/Report` 消费字段。
- 所有字段均带：字段名、类型、来源、是否必填、用途、对应 Excel 字段。
- Excel 字段引用请参见 `docs/excel_mapping.md`。

## 2. 顶层结构

```json
{
  "date": "2026-04-23",
  "questions": [ ... ],
  "competitorMeta": [ ... ]
}
```

### 2.1 `date`

- 字段名：`date`
- 类型：`string`
- 来源：Collector
- 是否必填：是
- 用途：标记本次测试日期，Reports 和历史数据归档需要该字段
- 对应 Excel 字段：`AIC Chat效果竞品对比.xlsx` 的 `日期`

### 2.2 `questions`

- 字段名：`questions`
- 类型：`array` of `Question`
- 来源：Collector
- 是否必填：是，至少包含 1 个元素
- 用途：保存当天所有测试问题及其相关回答、评价和结论
- 对应 Excel 字段：两个模板都与问题相关字段对应，详细见各子字段映射

### 2.3 `competitorMeta`

- 字段名：`competitorMeta`
- 类型：`array` of `CompetitorMeta`
- 来源：Collector
- 是否必填：否，但建议提供
- 用途：记录每个竞品的全局元信息，如免费次数和使用模型
- 对应 Excel 字段：`竞品分析具体问答.xlsx` 的 `免费次数` 和 `使用模型` 行

## 3. Question 对象

每个 `Question` 对象包含具体问题、AIC 与竞品回答、评价与结论。

```json
{
  "questionIndex": 1,
  "question": "用户问题文本",
  "questionType": "信息问答",
  "targetFunction": "知识问答",
  "aic": { ... },
  "competitors": [ ... ],
  "competitorEvaluation": "竞品表现评价",
  "overallJudgment": "AIC更优",
  "notes": "优化建议"
}
```

### 3.1 `questionIndex`

- 字段名：`questionIndex`
- 类型：`integer`
- 来源：Collector
- 是否必填：是
- 用途：保持问题顺序，关联两个模板的第几题
- 对应 Excel 字段：隐式地对应模板中的行位置

### 3.2 `question`

- 字段名：`question`
- 类型：`string`
- 来源：Collector
- 是否必填：是
- 用途：用户真实提问文本，Analysis 需要该问题进行回答质量判断；Report 直接输出问题内容
- 对应 Excel 字段：
  - `AIC Chat效果竞品对比.xlsx` 的 `用户问题`
  - `竞品分析具体问答.xlsx` 的 `问题`

### 3.3 `questionType`

- 字段名：`questionType`
- 类型：`string`
- 来源：Collector
- 是否必填：是
- 用途：问题分类，用于统计、分析与报告分类
- 对应 Excel 字段：
  - `AIC Chat效果竞品对比.xlsx` 的 `问题类型`
  - `竞品分析具体问答.xlsx` 的 `问题类型（信息问答类、创作生成类、工具类、推理分析类）`

### 3.4 `targetFunction`

- 字段名：`targetFunction`
- 类型：`string`
- 来源：Collector
- 是否必填：是
- 用途：描述问题指向的产品功能或能力方向，便于产品优化定位
- 对应 Excel 字段：`AIC Chat效果竞品对比.xlsx` 的 `指向功能`

### 3.5 `aic`

- 字段名：`aic`
- 类型：`object`
- 来源：Collector
- 是否必填：是
- 用途：保存 AIC 在该问题上的回答、截图和表现评价
- 对应 Excel 字段：
  - `AIC Chat效果竞品对比.xlsx` 的 `AIC 表现`、`AIC 表现评价`
  - `竞品分析具体问答.xlsx` 的 `AIC`

#### 3.5.1 `aic.answer`

- 字段名：`aic.answer`
- 类型：`string`
- 来源：Collector
- 是否必填：是
- 用途：AIC 的文本回答，用于分析与报告展示
- 对应 Excel 字段：`竞品分析具体问答.xlsx` 的 `AIC`

#### 3.5.2 `aic.screenshot`

- 字段名：`aic.screenshot`
- 类型：`string`
- 来源：Collector
- 是否必填：否，若有截图则填写路径或 URL
- 用途：保存 AIC 测试截图，供最终报告或 Excel 填充使用
- 对应 Excel 字段：`AIC Chat效果竞品对比.xlsx` 的 `AIC 表现`

#### 3.5.3 `aic.evaluation`

- 字段名：`aic.evaluation`
- 类型：`string`
- 来源：Collector 或 Analysis
- 是否必填：是
- 用途：AIC 的定性表现评价，用于报告总结与 Excel 填写
- 对应 Excel 字段：`AIC Chat效果竞品对比.xlsx` 的 `AIC 表现评价`

### 3.6 `competitors`

- 字段名：`competitors`
- 类型：`array` of `CompetitorAnswer`
- 来源：Collector
- 是否必填：是，可包含 0 个或多个元素，但建议至少 1 个
- 用途：保存所有竞品的名称、回答和截图，支持动态竞品数量
- 对应 Excel 字段：
  - `AIC Chat效果竞品对比.xlsx` 的 `竞品N` + 隐式截图列
  - `竞品分析具体问答.xlsx` 的 `竞品N名字`

#### 3.6.x `CompetitorAnswer` 对象

```json
{
  "name": "ask ai",
  "answer": "竞品回答",
  "screenshot": "path/to/competitor_screenshot.png"
}
```

##### `competitors[].name`

- 字段名：`name`
- 类型：`string`
- 来源：Collector
- 是否必填：是
- 用途：标识竞品名称，表头/填表时必须对应
- 对应 Excel 字段：
  - `AIC Chat效果竞品对比.xlsx` 的 `竞品N`
  - `竞品分析具体问答.xlsx` 的 `竞品N名字`

##### `competitors[].answer`

- 字段名：`answer`
- 类型：`string`
- 来源：Collector
- 是否必填：是
- 用途：竞品文本回答内容，供分析和报告使用
- 对应 Excel 字段：`竞品分析具体问答.xlsx` 的 `竞品N名字`

##### `competitors[].screenshot`

- 字段名：`screenshot`
- 类型：`string`
- 来源：Collector
- 是否必填：否，若有截图则填写路径或 URL
- 用途：保存竞品测试截图，供最终报告或 Excel 填充使用
- 对应 Excel 字段：`AIC Chat效果竞品对比.xlsx` 的隐式竞品截图列

### 3.7 `competitorEvaluation`

- 字段名：`competitorEvaluation`
- 类型：`string`
- 来源：Analysis
- 是否必填：是
- 用途：一段整体竞品表现评价，覆盖所有竞品回答的优劣和特点
- 对应 Excel 字段：`AIC Chat效果竞品对比.xlsx` 的 `竞品表现评价`

### 3.8 `overallJudgment`

- 字段名：`overallJudgment`
- 类型：`string`
- 来源：Analysis
- 是否必填：是
- 用途：AIC 与所有竞品的总体结论，用于 Excel 填写与总结
- 对应 Excel 字段：`AIC Chat效果竞品对比.xlsx` 的 `优劣判断`

### 3.9 `notes`

- 字段名：`notes`
- 类型：`string`
- 来源：Analysis
- 是否必填：否
- 用途：当结果为 `平局` 或 `竞品更优` 时，写入优化建议或改进说明
- 对应 Excel 字段：`AIC Chat效果竞品对比.xlsx` 的 `备注/优化建议`

## 4. CompetitorMeta 对象

该对象记录竞品级别的全局元信息。

```json
{
  "name": "ask ai",
  "freeCount": 5,
  "model": "GPT-5"
}
```

### 4.1 `name`

- 字段名：`name`
- 类型：`string`
- 来源：Collector
- 是否必填：是
- 用途：标识竞品，关联问题回答与元信息
- 对应 Excel 字段：`
  竞品分析具体问答.xlsx` 的 `竞品N名字`（隐式关联）

### 4.2 `freeCount`

- 字段名：`freeCount`
- 类型：`integer`
- 来源：Collector
- 是否必填：否
- 用途：记录该竞品当天的免费次数，用于评估竞品使用成本
- 对应 Excel 字段：`竞品分析具体问答.xlsx` 的 `免费次数` 行

### 4.3 `model`

- 字段名：`model`
- 类型：`string`
- 来源：Collector
- 是否必填：否
- 用途：记录该竞品当天使用的模型版本或类型
- 对应 Excel 字段：`竞品分析具体问答.xlsx` 的 `使用模型` 行

## 5. 额外字段约定

### 5.1 `metadata`（可选）

- 字段名：`metadata`
- 类型：`object`
- 来源：Collector
- 是否必填：否
- 用途：在不改变核心模型的前提下，保存额外的系统或环境信息，例如 `source`、`generatedAt`、`collectedBy` 等
- 对应 Excel 字段：无直接对应

## 6. 动态竞品支持说明

- `competitors` 和 `competitorMeta` 均为数组，支持任意数量的竞品。
- 不应在数据模型中硬编码 `competitor1`、`competitor2`、`competitor3` 等字段名。
- Collector 生成 JSON 时，若存在 N 个竞品，则 `competitors.length === N`，`competitorMeta.length === N`。
- Analysis/Report 消费端应遍历 `competitors` 数组进行处理，而不是依赖固定索引。

## 7. 规范说明

- Collector 负责将原始测试数据、截图信息与问题分类填入该 JSON 模型。
- Analysis 仅消费该 JSON 模型进行质量评价、事实校验、优劣判断与优化建议生成。
- Report 仅消费该 JSON 模型生成最终 Excel 和日报内容。
- 所有模块之间禁止直接读写 Excel，Excel 仅作为最终输出目标。

## 8. 示例数据模型

```json
{
  "date": "2026-04-23",
  "questions": [
    {
      "questionIndex": 1,
      "question": "2025年诺贝尔物理学奖授予了谁？",
      "questionType": "信息问答",
      "targetFunction": "知识问答",
      "aic": {
        "answer": "AIC 的文本回答内容",
        "screenshot": "screenshots/aic_q1.png",
        "evaluation": "AIC 回答结构清晰，信息准确。"
      },
      "competitors": [
        {
          "name": "ask ai",
          "answer": "竞品1 的回答文本",
          "screenshot": "screenshots/ask_ai_q1.png"
        },
        {
          "name": "chatsmith",
          "answer": "竞品2 的回答文本",
          "screenshot": "screenshots/chatsmith_q1.png"
        }
      ],
      "competitorEvaluation": "竞品整体回答偏向简洁，但部分信息不够完整。",
      "overallJudgment": "AIC更优",
      "notes": ""
    }
  ],
  "competitorMeta": [
    {
      "name": "ask ai",
      "freeCount": 3,
      "model": "GPT-5"
    },
    {
      "name": "chatsmith",
      "freeCount": 2,
      "model": "标准模型"
    }
  ]
}
```
