# 计分、征募与战场兑现验收 · 2026-11-24

本轮只修改表现与只读事实派生。现有牌型、筹码、倍率、品质概率、军令、金币、商品、敌军、首领、道具、兵种、战斗与存档规则均沿用原版。原有235项测试保留，最终264项全部通过。

## 表现链

`ScoreSequence`继续消费正式结算的scoreTrace，新增显式cinematic模式。普通高牌与对子仍在560–780毫秒内完成；高阶、传说或显著连锁约1.8–2.4秒，依次聚焦选中/改印牌、牌型成立、基础及牌点、真实道具、倍率、最终分、品质、去向与战令。详细计算保留在原有展开明细中。

低阶随机升格在品质阶段前不改变文字、色调、节奏或进度，避免提前泄露结果。新兵在战场上先以中性集结状态展示，到征募阶段再显露真实军装。暂停演示、立即显示、2倍演出、关闭演出及系统减少动态效果均只控制外置表现；演出速度与原有战斗速度使用独立变量。

`presentationFacts`从正式操作前后的快照取出真实新兵、候补、集训接收者与实得经验，以及实际受令士兵。已有成员显示本手前后实得变化，明确包括搭档等本手其他效果；新兵没有可靠的出牌前基底，只展示结算后属性，不反推基础值或制造加成。

## 高于传说的欢呼

传说只强化新兵亮相；全军欢呼要求正式产生神话或棱彩。当前正常随机征募不会凭空越过传说，验收使用合法4+4升神话与5+5升棱彩，也支持实际高品质主将归队。

新兵先亮相，其他真实在阵成员按100–300毫秒错开响应。近战举武器、远程致意、牧师祝福，沿用原有装备与动作。完整欢呼1秒，同波后续420毫秒；没有持续人群音效。候补升品明确留在候补，绘图仍只画实际在阵成员。跳过、关闭与读档不重触发；欢呼次数和时钟不写入游戏模型或存档。

旧品质burst会在新表现下按真实effect ID替换，避免「神话降临」盖住姓名，或候补旧坐标出现幽灵入场。原game.effects保持原样，站位、命中框与战斗动作不改；真实战斗动作优先于致意姿势。

## 真实战场因果

关键反馈只读取combatLedger实际贡献、道具事件、原有止钟计数与明确皇后打断日志。每个战团的首次有效伤害/治疗、首次挡伤、首次圣杯转化采用短反馈，不为每次普通攻击刷屏。反馈保留受过哪些牌型战令，但不把整次攻击称为某一手独占的额外伤害。

战报新增「关键兑现」，从原有历史记录派生征募去向、战团伤疗、吸盾、止钟和圣杯实际伤害。皇后逐次打断仅在本会话捕获明确日志时显示；历史存档没有相关字段时不补造记录。报告的贡献不再相加一次。

## 种子4完整浏览器路线

使用隔离Chrome、开发入口http://127.0.0.1:5187/。实际鼠标从封面选鬼手、标准难度、种子4并结束引导，打出15分高牌、60分对子与268分葫芦，真实计时器完成首战。随后领取补给，购买孪生墨水与记分粉笔，研习对子，用14金币把四张手牌改为♦A。

第二波五张♦A预览与正式结算均为：

```text
(160基础 + 55牌点 + 2粉笔 + 3墨水) × 16倍率 = 3520分
```

实际揭晓传说「黑钢君王 · 御前君主」，计分牌征召属性+70%，真实入阵。王师进军作用于三名实际铁卫。刀卫攻击29→87（+58），盾卫34→92（+58），盾0→85，行动间隔1.16→0.638秒（-0.522秒）。新兵只显示其结算后实际值，未假设其入阵前属性。

同一次浏览器开局继续打完第二波324分同花与16分高牌，再以真实计时器完成第二战。后续选牌、改印、融合、购买、研习和推进使用游戏正式操作接口，每场战斗都由真实计时器跑完，逐动作核对基线预算、牌型和分数。第三波神话、第五波棱彩也在这条完整路线里正式产生。最终十二波胜利，城门100、金币119、击退164，与原基线一致。最终完整浏览器运行约两分钟（包含分段截图）；截图暂停计分演示不暂停模拟时钟。

独立皇后补验使用同种子原路线到第十二波后合法改为散兵阵、后置四兵且本波不出牌，使皇后有机会发动王庭震荡。14.30秒真实开始蓄力，15.20秒实际打断，17.13秒通关、城门56。这是为观察技能而改变操作的独立分支，不能当作主路线战绩变化。

## 验证与证据

- 原235项规则测试未删除或改写，最终264项通过、0失败；生产构建和30.8MiB离线打包成功。
- 演出开启、关闭、跳过与2倍四种模式，以相同动作及tick序列逐步比较完整snapshot与RNG，最终完整snapshot一致，种子4仍12波胜、城门100。
- 深冻结模型的绘图测试验证命中框、位置、原effects和完整战斗快照不变；短提示音可独立取消。
- 浏览器四组journey/sizes/quality/boss全部通过，异常为零。五种尺寸为1366×900、390×844、360×740、844×390、768×1024；各计分阶段布阵几何一致，手牌与按钮可达。
- 另保留11组离线计分回归、20组原部署布局、渐进引导、满血补给、个人战报及实际JSON下载回归。
- 合法神话、棱彩、候补升品快照与独立公共API相同操作逐字段比较；没有直接赋品质、属性、资源或结局。

可复跑命令：

```bash
npm test
npm run build
node scripts/build-legion-demo.mjs
node scripts/verify-builds.mjs
node scripts/verify-presentation.mjs
node scripts/check-scoring-ui.mjs
LEGION_TEST_URL=http://127.0.0.1:5187/ node scripts/check-presentation-ui.mjs
```

新浏览器脚本后半程需要开发入口的正式操作接口。LEGION_UI_SCENARIOS可单跑journey、sizes、quality、boss。皇后补验fixture位于output/presentation-fixtures/queen-pulse.json，附完整合法操作前缀与正常复放验证。

生成证据位于output，未纳入源码仓库：

- presentation-ui-verification.json：四组浏览器验收、五尺寸与异常列表。
- presentation-journey-actions.json：同一次完整浏览器路线的后续操作与各波实际报告。
- presentation-layout-after.json：阶段布局及布阵几何测量。
- presentation-journey-3520-quality.png、presentation-journey-3520-muster.png、presentation-journey-3520-order.png：关键阶段。
- presentation-size-390x844-order.png：手机实际受令属性。
- legion-real-mythic-cheer.png、legion-real-prismatic-cheer.png、legion-real-mythic-reserve-cheer.png：真实欢呼。
- presentation-queen-actual-telegraph.png、presentation-queen-actual-interrupt.png：皇后真实蓄力与打断现场。
- presentation-journey-main-12-wave-victory.png：主路线真实最终胜利。

## 边界与人工确认

没有已知规则或浏览器阻塞问题。短音效的主观响度、欢呼动作辨识度与实体手机滚动手感仍适合人工试玩确认。历史记录缺少逐次皇后打断字段时只显示已有事实，续档不会补演旧入场，也不会猜测缺失的单手因果。五尺寸均可操作，矮横屏需要在原面板内滚动查看完整受令明细。

## 修改文件

共 26 个文件。

- `README.md`
- `docs/presentation-payoffs-2026-11-24.md`
- `scripts/check-presentation-ui.mjs`
- `scripts/check-scoring-ui.mjs`
- `scripts/verify-builds.mjs`
- `scripts/verify-presentation.mjs`
- `src/BattlePayoffs.vue`
- `src/LegionGame.vue`
- `src/OrderRecipients.vue`
- `src/RecruitReveal.vue`
- `src/ScoreSequence.vue`
- `src/WaveReport.vue`
- `src/audio.js`
- `src/battlefield.js`
- `src/battlefieldPresentation.js`
- `src/battlefieldPresentation.test.js`
- `src/battlefieldUnits.js`
- `src/presentation.css`
- `src/presentationEvents.js`
- `src/presentationFacts.js`
- `src/presentationFacts.test.js`
- `src/presentationScene.js`
- `src/presentationScene.test.js`
- `src/presentationViews.js`
- `src/scorePresentation.test.js`
- `src/scoreSequence.js`
