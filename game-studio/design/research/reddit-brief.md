# Reddit 调研任务书：星图卡组

给在本机浏览器里运行的 Claude 使用（Claude 桌面版内置浏览器，或 Claude in Chrome）。
把这份文件交给 Claude，说「按 `game-studio/design/research/reddit-brief.md` 做调研」即可。

## 背景

我们在评估一款单人 roguelike 卡组构筑游戏，暂名「星图卡组」（Starchart）：

- 整局共用一片公开的星空，玩家连接星星组成星座来出招；连线会保留，
  构筑就是往星空里加星、移动星星、改连线。
- 计分类似 Balatro 的连锁：线段交叉、闭环、一笔画成都有加成，计算过程全部可见。
- 主打「不靠运气」：随机只在每局的星图布局上，不在抽牌。
- 题材用中国传统星官（三垣、二十八宿、四象），中英法三语同步首发。

已知相近作品：Starglyphs（星座一笔画解谜）、Pluto（手势施法卡组构筑，2026 年 3 月上 Steam）、
Erin and the Otherworld（itch.io 上画星座的卡组构筑）、Stellar Witch、Balatro、Slay the Spire 2、
Backpack Battles、Monster Train。

## 要回答的问题

1. 卡组构筑玩家对「运气太重」的抱怨有多普遍？他们怎么看「完全信息、靠规划取胜」的设计？
2. 玩家对上面这些相近作品，尤其是画线、画星座、手势施法这类机制，有什么评价？喜欢什么，吐槽什么？
3. 欧美玩家对中国神话或中国传统天文题材的游戏有没有兴趣？有没有常见顾虑（看不懂、文化隔阂）？
4. 玩家对卡组构筑的下一步有什么期待？哪些套路已经腻了？
5. 空间摆放或场面持续存在的构筑游戏（Backpack Battles、Monster Train 等），玩家最喜欢和最讨厌的点是什么？

## 去哪里搜

版块：r/roguelites、r/roguelikes、r/slaythespire、r/balatro、r/gamedesign、r/gameideas、
r/IndieDev、r/IndieGaming、r/patientgamers、r/BackpackBattles、r/MonsterTrain。
没有的版块就跳过。

搜索词（可以在 Google 用 `site:reddit.com` 加关键词，也可以用 Reddit 站内搜索，按 Top 加 All time 排序）：

- `Starglyphs`、`Pluto deckbuilder`、`Erin and the Otherworld`
- `deckbuilder too much RNG`、`deckbuilder luck vs skill`、`perfect information roguelike`
- `constellation game`、`draw spells game`、`gesture spell casting`
- `Chinese mythology game`、`Chinese astronomy game`、`wuxia roguelike`
- `deckbuilder fatigue`、`tired of deckbuilders`、`what do you want in a deckbuilder`
- `spatial deckbuilder`、`board state deckbuilder`

## 规则

- 只读。不发帖、不评论、不投票、不私信、不加入版块，也不修改任何账号设置。
- 每个问题读 5 到 10 个高互动帖子（赞数或评论数多的优先），总数不超过 50 个。
- 只记录真正读到的内容。不要编造帖子、数字或引用；没找到就写「没找到」。
- 引用原话时保留英文原文，再附中文翻译。

## 输出

把结果写到 `game-studio/design/research/reddit-findings.md`，结构如下：

1. 一段总结：最重要的 5 个发现，以及它们对「星图卡组」设计的影响。
2. 按上面 5 个问题分节。每节包括：
   - 结论（2 到 4 句）
   - 证据表：帖子标题、链接、版块、日期、赞数或评论数、关键原话（英文加中文）
3. 「意外发现」：调研中看到的、不在问题清单里但值得注意的点。
4. 「设计建议」：根据证据，建议保留、修改或放弃的设计点。
