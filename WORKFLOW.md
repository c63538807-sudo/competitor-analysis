# Competitor Analysis Workflow

## Overview

本文件定义 Competitor Analysis Automation 的完整业务工作流。

所有模块（Collector、Analysis、Report、History）均应遵循本工作流。

开发新的功能时，应保证与 Workflow 保持一致，不改变已有数据流。

---

# Overall Workflow

每日竞品分析流程如下：

```
获取昨日真实用户问题
        │
        ▼
筛选今日测试问题（5题）
        │
        ▼
生成今日测试任务
        │
        ▼
手机端完成竞品测试
        │
        ▼
Collector 录入回答
        │
        ▼
导出标准 JSON
        │
        ▼
Analysis 自动分析
        │
        ▼
自动填写 Excel
        │
        ▼
生成每日总结
        │
        ▼
保存历史数据
```

整个流程中，仅 **问题筛选** 和 **竞品测试** 需要人工参与，其余流程均应逐步实现自动化。

---

# Step 1 获取测试问题

数据来源：

Prompt 网站

```
http://aitest.cocomobi.com/aichat/prompt_html/chat.html
```

查询条件：

- UID：留空
- 环境：正式环境
- APP：iOS AIchat 2025
- 起始时间：昨天
- 终止时间：昨天

读取：

仅分析 **用户输出（User Prompt）**。

---

## 问题筛选规则

每天固定选择：

5 个问题。

要求覆盖不同能力：

- 信息问答
- 创作生成
- 工具类
- 推理分析
- 开放类问题（补充）

筛选原则：

- 来源于真实用户
- 尽量覆盖不同能力
- 避免重复问题
- 不选择图片、生图、VIP 功能
- 优先体现模型能力差异

最终输出：

Today's Questions。

---

# Step 2 初始化测试

根据 Today's Questions 创建当天测试任务。

包括：

- 日期
- 问题类型
- 用户问题
- 待测试竞品

随后开始手机测试。

---

# Step 3 手机端竞品测试

人工在手机端完成测试。

当前测试对象包括：

- AIC
- ask ai
- chatsmith
- chaton
- nova
- （视每天具体测试竞品而定，可继续增加）

每个问题分别获取：

- 回答内容
- 截图（可选）
- 使用模型（可选）
- 免费次数（可选）

---

# Step 4 Collector 数据采集

Collector 负责录入测试数据。

Collector 需要完成：

- 展示今日五个问题
- 保存竞品回答
- 上传截图
- 自动保存
- 导出 JSON

Collector 不负责：

- 分析回答
- 判断优劣
- 修改回答

Collector 输出：

```
today.json
```

---

# Step 5 Analysis

读取：

today.json

进行：

## 回答分析

评价维度：

- 完整性
- 准确性
- 专业程度
- 实用性
- 结构清晰度
- 可读性
- 互动引导能力

---

## 事实校验

若问题涉及：

- 新闻
- 体育
- 时间
- 人物
- 医疗
- 法律
- 数学
- 数据

必须联网验证。

不得直接依赖模型知识。

---

## 自动生成

针对每个问题：

生成：

- AIC 表现评价
- 各竞品评价
- 优劣判断
- 优化建议

---

# Step 6 Report

Analysis 完成后：

读取：

```
templates/
```

中的标准模板：

- AIC Chat效果竞品对比.xlsx
- 竞品分析具体问答.xlsx

保持模板结构不变。

自动填写：

- 用户问题
- 回答
- 表现评价
- 优劣判断
- 优化建议

随后生成：

Chat聊天效果竞品对比每日总结。

所有结果输出至：

```
output/

    YYYY-MM-DD/
```

不得覆盖 templates。

---

# Step 7 History

保存：

- JSON
- Excel
- 每日总结

建立历史数据库。

未来支持：

- 周趋势分析
- 月趋势分析
- 能力变化分析
- Dashboard

---

# Data Flow

整个系统统一采用如下数据流：

```
Prompt Website

        │

Today's Questions

        │

Collector

        │

today.json

        │

Analysis

        │

Analysis Result

        │

Report

        │

Excel

        │

Daily Report

        │

History
```

模块之间不得直接依赖 Excel。

统一通过 JSON 进行数据交换。

Excel 仅作为最终输出。

---

# Input & Output

| 模块 | 输入 | 输出 |
|------|------|------|
| Prompt | 用户聊天记录 | Today's Questions |
| Collector | Today's Questions | today.json |
| Analysis | today.json | Analysis Result |
| Report | Analysis Result + Templates | Excel + Daily Report |
| History | Daily Report | History Database |

---

# Development Roadmap

项目按照以下顺序开发：

✅ README

✅ Workflow

⬜ Excel Mapping

⬜ Collector

⬜ Analysis

⬜ Report

⬜ History

---

# Development Rules

所有开发均应遵循以下规则：

1. 每个模块职责单一。
2. JSON 是唯一的数据交换格式。
3. Excel 仅作为最终输出。
4. 不允许修改 templates 中的模板。
5. 所有生成结果输出至 output。
6. 涉及事实性内容必须联网验证。
7. 所有评价应保持客观、公正、可解释。

---

# Future Vision

后续计划增加：

- Prompt 自动抓取
- OCR 自动识别截图
- 云端同步
- Dashboard
- 历史趋势分析
- 多人协作
- 一键导出日报
- 自动生成测试任务
- 支持更多竞品模型

开发新功能时，应尽量复用现有架构，避免重复实现。