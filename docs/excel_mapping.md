# Excel Mapping

本文档描述项目中两个标准 Excel 模板的字段映射、语义以及自动填充规则。

## 1. 目标

- 统一 `templates/` 中的两个模板字段含义
- 明确自动生成时应写入哪些内容
- 指定每个模板与内部数据结构的对应关系

## 2. 模板一：AIC Chat效果竞品对比.xlsx

### 2.1 目标

该模板用于保存每日 5 个测试问题的最终比较结果，重点记录 AIC 与竞品的整体表现、截图、评价与优劣结论。

### 2.2 Sheet

- `Sheet1`

### 2.3 列头与语义

| 列 | 字段名 | 语义 | 填写规则 |
|---|---|---|---|
| A | 日期 | 当天测试日期 | 每一行填同一个日期，例如 `2026/4/23` |
| B | 问题类型 | 问题所属类别 | 取值例如：信息问答、创作生成、工具类、推理分析 |
| C | 指向功能 | 该问题对应产品能力方向 | 例如 `知识问答`、`AI写作`、`AI翻译`、`推理分析` |
| D | 用户问题 | 用户原始问题文本 | 今日测试问题内容 |
| E | AIC 表现 | AIC 的测试截图 | 该列用于放 AIC 测试截图，非回答文本 |
| F | AIC 表现评价 | AIC 的定性表现评价 | 针对该问题生成 AIC 的表现描述 |
| G | 竞品1 | 竞品1 名称 | 例如 `ask ai` |
| H | (blank) | 竞品1 测试截图 | 用于放竞品1截图 |
| I | 竞品2 | 竞品2 名称 | 例如 `chatsmith` |
| J | (blank) | 竞品2 测试截图 | 用于放竞品2截图 |
| K | 竞品3 | 竞品3 名称 | 例如 `chaton` |
| L | (blank) | 竞品3 测试截图 | 用于放竞品3截图 |
| M | 竞品表现评价 | 竞品整体表现评价 | 一段聚合评价，覆盖所有竞品回答的优劣和特点 |
| N | 优劣判断 | AIC 与所有竞品的总体结论 | 只能填写：`AIC更优`、`平局`、`竞品更优` |
| O | 备注/优化建议 | 仅在结果平局或竞品更优时填写 | 说明可改进点、优化建议；若 AIC 更优则留空 |

### 2.4 备注

- 模板中的空白列位于每个 `竞品N` 之后，实际表示该竞品的截图列。
- `竞品表现评价` 是整体竞品表现的一段聚合评价，不是单独为某一个竞品。
- `优劣判断` 只需对 AIC 与整体竞品做结论，不需要写具体是哪一个竞品更优。

### 2.5 数据填充范围

- 该模板应填充 5 行问题数据，对应 5 个测试问题。
- 自动生成结果可直接写入第 3 行及以下，或根据模板样式覆盖提示行。

## 3. 模板二：竞品分析具体问答.xlsx

### 3.1 目标

该模板用于记录每个问题下 AIC 与竞品的具体回答内容，以及竞品的基础元信息（免费次数、使用模型）。

### 3.2 Sheet

- `Sheet1`

### 3.3 列头与语义

| 列 | 字段名 | 语义 | 填写规则 |
|---|---|---|---|
| A | 问题 | 用户问题文本 | 今日测试问题 |
| B | 问题类型（信息问答类、创作生成类、工具类、推理分析类） | 问题分类 | 与模板一中的 `问题类型` 等价 |
| C | AIC | AIC 的回答内容 | 纯文本回答，不填截图 |
| D | 竞品1名字 | 竞品1 的回答内容 | 竞品1 的回答文本 |
| E | 竞品2名字 | 竞品2 的回答内容 | 竞品2 的回答文本 |
| F | 竞品3名字 | 竞品3 的回答内容 | 竞品3 的回答文本 |

### 3.4 竞品元信息行

该模板还包含两行全局竞品信息：

- `免费次数` 行：记录每个竞品的当天免费次数 | AIC 不填（模板显示 `不用填`）
- `使用模型` 行：记录每个竞品当天使用的模型 | AIC 不填（模板显示 `不用填`）

由于这些信息是竞品级别元信息，因此不需要按问题重复填写。

### 3.5 备注

- 该模板支持 3 个竞品，名称由列头 `竞品1名字`、`竞品2名字`、`竞品3名字` 表示。
- 该模板不包含 `日期` 与 `指向功能` 字段。
- `问题类型` 与模板一中的 `问题类型` 保持等价，二者可共享同一枚举值集合。

## 4. 内部数据结构建议

建议的内部 JSON 结构如下：

```json
{
  "date": "2026-04-23",
  "questions": [
    {
      "questionIndex": 1,
      "question": "用户问题文本",
      "questionType": "信息问答",
      "targetFunction": "知识问答",
      "aic": {
        "answer": "AIC 回答文本",
        "screenshot": "path/to/aic_screenshot.png",
        "evaluation": "AIC 表现评价"
      },
      "competitors": [
        {
          "name": "ask ai",
          "answer": "竞品1回答",
          "screenshot": "path/to/competitor1_screenshot.png"
        },
        {
          "name": "chatsmith",
          "answer": "竞品2回答",
          "screenshot": "path/to/competitor2_screenshot.png"
        },
        {
          "name": "chaton",
          "answer": "竞品3回答",
          "screenshot": "path/to/competitor3_screenshot.png"
        }
      ],
      "competitorEvaluation": "竞品表现评价",
      "overallJudgment": "AIC更优",
      "notes": "优化建议"
    }
  ],
  "competitorMeta": [
    {
      "name": "ask ai",
      "freeCount": 5,
      "model": "GPT-5"
    },
    {
      "name": "chatsmith",
      "freeCount": 3,
      "model": "标准模型"
    },
    {
      "name": "chaton",
      "freeCount": 2,
      "model": "默认模型"
    }
  ]
}
```

## 5. 对应关系总结

### 5.1 模板一：AIC Chat效果竞品对比.xlsx

- `日期` → `date`
- `问题类型` → `questionType`
- `指向功能` → `targetFunction`
- `用户问题` → `question`
- `AIC 表现` → `aic.screenshot`
- `AIC 表现评价` → `aic.evaluation`
- `竞品1` / 空列 → `competitors[0].name` / `competitors[0].screenshot`
- `竞品2` / 空列 → `competitors[1].name` / `competitors[1].screenshot`
- `竞品3` / 空列 → `competitors[2].name` / `competitors[2].screenshot`
- `竞品表现评价` → `competitorEvaluation`
- `优劣判断` → `overallJudgment`
- `备注/优化建议` → `notes`

### 5.2 模板二：竞品分析具体问答.xlsx

- `问题` → `question`
- `问题类型（信息问答类、创作生成类、工具类、推理分析类）` → `questionType`
- `AIC` → `aic.answer`
- `竞品1名字` → `competitors[0].answer`
- `竞品2名字` → `competitors[1].answer`
- `竞品3名字` → `competitors[2].answer`
- `免费次数` 行 → `competitorMeta[*].freeCount`
- `使用模型` 行 → `competitorMeta[*].model`

## 6. 重要约束

- `AIC 表现` 仅用于截图，不写文本回答。
- `竞品表现评价` 仅写一段综合竞品评价，不拆分到每个竞品。
- `优劣判断` 只能使用 `AIC更优`、`平局`、`竞品更优`。
- `备注/优化建议` 在 `AIC更优` 时不填写。
- `竞品分析具体问答.xlsx` 中 AIC 不填写 `免费次数` 与 `使用模型`。
- 竞品数量应统一为 3 个。

## 7. 额外注意事项

- `AIC Chat效果竞品对比.xlsx` 的竞品截图列头是隐式列，应按列位置解析为截图列。
- `竞品分析具体问答.xlsx` 的 `免费次数` 和 `使用模型` 是全局竞品信息，非问题级字段。
- 若模板列顺序变更，自动化逻辑应优先按列标题而非列索引匹配。
