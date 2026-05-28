---
name: websearch
description: "网页搜索与精确内容检索技能，支持三种模式：search（搜索）、fetch（抓取指定URL）、full（搜索+抓取正文）"
license: Proprietary.
---

# 网页搜索与精确内容检索

## 三种使用模式

### 1. search — 搜索网页（默认模式）
返回搜索结果列表，包含标题、URL、摘要。
```bash
python .claude/skills/websearch/scripts/search.py --mode search --query "Cocos Creator 2.4 文档"
```

### 2. fetch — 精确抓取指定 URL 的正文内容
给定一个 URL，直接抓取页面并提取纯文本正文。
```bash
python .claude/skills/websearch/scripts/search.py --mode fetch --url "https://docs.cocos.com/creator/2.4/manual/zh/"
```

### 3. full — 搜索 + 自动抓取排名靠前的结果（推荐）
先搜索关键词，再自动抓取排名前 N 条结果的网页正文，一步到位获取精确内容。
```bash
python .claude/skills/websearch/scripts/search.py --mode full --query "Cocos Creator 2.4" --fetch-top 2
```

## 参数说明

| 参数 | 简写 | 作用 | 默认值 |
|------|------|------|--------|
| --mode | -m | 模式：search / fetch / full | search |
| --query | -q | 搜索关键词 | 必填（search/full 模式） |
| --url | -u | 要抓取的 URL | 必填（fetch 模式） |
| --freshness | -f | 时间过滤：oneDay/oneWeek/oneMonth/oneYear/noLimit | noLimit |
| --count | -c | 搜索结果数量 (1-10) | 10 |
| --fetch-top | -t | full 模式下抓取前几条结果的正文 (1-3) | 1 |
| --max-chars | | 单页最大提取字符数 | 8000 |
