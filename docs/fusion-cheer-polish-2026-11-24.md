# 副职模块与欢呼打磨验收

基于d06094c，仅修改绘制、会话级表现控制和验证代码。四个主职业的32格高阶原型、其他副职配置、最多两类副职显示优先级、UI流程和所有玩法文件保持不变。

## 实际修改文件

| 文件 | 改动 |
|---|---|
| public/legion-pixel/high-tier-fusion-parts.png | 独立2×2透明图集，神话／棱彩火焰核心与完整成对腰刃 |
| src/highTierArt.js | 专用模块只读配置、较宽占位、安全绘制挂点；资源失败回退旧模块 |
| src/spriteAtlas.js | 新图集2列4帧加载，原图集不变 |
| src/articulatedSprites.js | 仅salute姿态加强双臂和武器抬起，至多2逻辑像素的绘制起伏 |
| src/battlefieldPresentation.js | 真实主将／镜像／阵亡排除，单次欢呼包络、肩旁少量像素短线 |
| src/presentationScene.js | 真实军团ID去重、源主将标记，跳过／减少动态／关闭后取消迟到阶段，防止重播 |
| src/highTierArt.test.js、src/articulatedSprites.test.js | 部件映射、旧模块回退、不改主模型、专用欢呼运动学和普通姿态回归 |
| src/battlefieldPresentation.test.js、src/presentationScene.test.js | 主将排除、候补、一次触发、取消、原时长、命中与姓名几何、完整快照和RNG |
| scripts/check-high-tier-ui.mjs | 新图集实际加载、灰度矩阵、真实欢呼时间采样、五尺寸投影、候补／减少动态与十二波浏览器路线 |
| scripts/build-legion-demo.mjs | 内联新增模块图集到离线HTML |
| public/legion-pixel/HIGH_TIER_FUSION_ART.md、PROMPTS.md | 图集布局、来源及完整生成提示词 |
| README.md、本文件 | 本轮范围、复测命令、证据及限制 |

没有改动engine、combat、forge、professionFusion、quality、formation、gameSave等玩法／存档文件，也没有改动drawUnit与pickUnit。人物世界坐标和命中盒不变；起伏是绘制关节偏移。

## 美术与欢呼

焰术师改为短粗法器承托的整体火焰核心，减少细丝与内部纹理。刺客使用一整件V形双腰刃，护手与刃面加宽，中央保留透明负空间。两档均使用新素材，低阶和其他八个主职业保持原外观。牧师、盾卫、长弓副职继续用原图与原配置。

神话／棱彩的正式结果才会产生欢呼；主将由揭晓卡与原位模型呈现，其他场上真实成员按原100–300毫秒错峰致意。完整窗口仍为1000毫秒，同波后续仍为420毫秒。只有一段抬臂与落臂，不循环，不新建游戏计时器；动作由现有外置表现时钟采样，真实战斗动作继续优先。

种子4第三波神话是本波首次，使用完整欢呼。第五波此前已经有牧师神话升阶，随后棱彩使用真实短版；450毫秒时短欢呼应已结束，验收不能为了截图改成完整版本。

## 验证命令

```bash
npm test
npm run build
node scripts/verify-builds.mjs
node scripts/verify-presentation.mjs
LEGION_HIGH_TIER_SCENARIOS=art,ui,route LEGION_TEST_URL=http://127.0.0.1:5187/ node scripts/check-high-tier-ui.mjs
node scripts/build-legion-demo.mjs
```

浏览器入口可在另一终端运行 `npm run dev -- --host 127.0.0.1 --port 5187`。脚本使用隔离Chrome资料；美术矩阵为只读渲染样本，不注入成品兵到实际游戏。route从正常新局经正式操作和真实战斗计时推进，fixtures均由合法操作重放生成。

## 证据位置

- output/high-tier-polish-baseline/：d06094c打磨前46份PNG／JSON及SHA256清单。
- output/high-tier-normal-tiers.png及-grayscale.png：原战场52像素品质对比。
- output/high-tier-module-matrix-5.png、-6.png及-grayscale.png：四主职×五副职的40格正常／灰度对比。
- output/high-tier-polish-comparison-{5,6}.png及-grayscale.png：与d06094c的火器／腰刃前后对照，左旧右新。
- output/high-tier-mythic-1366x900-actual-cheer.png、high-tier-mythic-390x844-actual-cheer.png：真实完整欢呼。
- output/high-tier-reserve-mythic-phone-reduced.png：候补升阶和系统减少动态效果。
- output/presentation-journey-main-12-wave-victory.png：十二波主路线真实胜利。
- output/high-tier-ui-verification.json：图集、时序、投影、快照及完整浏览器路线结果。

## 已完成的自动检查

- 原277项保留，新增9项，本地286/286通过、0失败、0跳过。
- 生产构建139模块成功；包含新增图集的单文件离线版34.8MiB生成成功。
- verify-builds三路线真实规则重放不变：种子4胜利12波／城门100／金币119／击退164；种子1胜利12波／城门83／金币186／击退164；种子3失败11波／城门0／金币216／击退144。
- verify-presentation重新生成合法同品质融合夹具，神话为第三波第33操作，棱彩为第五波第66操作。
- 与保存的d06094c基线逐像素比较：14张主模型／原动作／既有合法融合图板零差异；两档彩色和灰度矩阵的牧师／盾卫／长弓列零差异，只有火器／腰刃列改变。
- 指定art,ui,route组合最终同次exit0：art 6460毫秒，UI 16473毫秒，完整真实战斗路线119656毫秒；浏览器异常列表为空。
- 五尺寸1366×900、390×844、360×740、844×390、768×1024，共10个神话／棱彩案例的展开、收起与复原投影检查通过，卡片与真实姓名／模型重叠面积为零。
- 桌面和390手机端使用实际requestAnimationFrame观察100／300／450／600／1000／1100毫秒阶段。主将所有采样不做salute；完整欢呼在1000毫秒结束，棱彩真实短版在450毫秒采样已归零。没有为截图重设时钟或制造欢呼。
- 活跃中点击跳过、正式收卡后重开工坊、减少动态、正常候补四名真实成员及减少动态候补均通过，完整保存快照和RNG不变。武器尖与自身／邻兵的姓名、血条保持间隙。
- 同次浏览器正常新局到十二波胜利，城门100、金币119、击退164，与d06094c一致。

另有 `output/high-tier-{mythic,prismatic}-{1366x900,390x844}-cheer-{100,300,450,600,1000}ms.png` 保存实际Canvas时间片。棱彩300毫秒图显示真实短版，450毫秒及之后应静止。完整DOM截图保留既有actual-cheer文件名；不要把棱彩450毫秒图解释成正在欢呼。

## 人工视觉边界

四个主职业在52像素及灰度下保留各自轮廓；火焰核心和腰刃经过加粗，占用更多身侧／腰侧面积，但不替换主武器。大披风与厚甲的背景仍会让双腰刃内侧局部融入衣装，因此以外露双刃及中央负空间辨认；52像素下不能要求读出护手的细雕。手机将整个军团缩放到更小屏幕，细节会继续减少，欢呼优先靠双臂和武器抬举辨识。

其余八个基础职业与旧六种独立融合外观保持回退；没有批量推广新模型。最多两类可见副职的规则不变，超过两类的完整兼修仍以原属性／职业记录为准。
