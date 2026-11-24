# 四职业高阶部件图集

资源：`high-tier-parts.png`，887×1774 RGBA，4列×8行。仅用于御前君主、随军牧师、盾卫、长弓手的神话与棱彩绘制；普通至传说及其他职业继续使用原图。没有替换 regalia.png、armory.png 或52张身份牌绘。

使用内置 image_gen 工具生成，参考本项目的 regalia.png 与 armory.png。没有使用API/CLI回退。运行时按格裁取透明边界，部件挂在现有头、背、躯干与手腕节点；原图极低alpha边缘不会参与有效轮廓裁切。

| 行 | 职业与品质 | 0 头饰 | 1 背件 | 2 主手 | 3 肩胸 |
|---|---|---|---|---|---|
| 0 | 君主·神话 | 王权冠 | 分叉鼬领王氅 | 王权长刃 | 统帅肩胸铠 |
| 1 | 君主·棱彩 | 高晶冠 | 多层折面王氅 | 分叉护手晶刃 | 层叠外展肩铠 |
| 2 | 牧师·神话 | 祭冠 | 月形经匣背饰 | 双杯圣器与经书杖 | 礼仪披带 |
| 3 | 牧师·棱彩 | 三叶祭冠 | 三联经匣背饰 | 分枝圣器经书杖 | 多层礼仪披带 |
| 4 | 盾卫·神话 | 宽颊重盔 | 重甲背衣 | 长方塔盾 | 宽板肩胸甲 |
| 5 | 盾卫·棱彩 | 城垛重盔 | 铰接分片背甲 | 双边阶梯塔盾 | 双层建筑式肩甲 |
| 6 | 弓手·神话 | 翎羽兜帽 | 长箭袋与短披尾 | 巨型反曲弓 | 轻型斜肩皮甲 |
| 7 | 弓手·棱彩 | 双翎兜帽 | 双箭袋与分叉披尾 | 双曲弓臂 | 分层轻型肩甲 |

生成提示词（最终采用版本）：

```text
Use case: precise-object-edit. Create a NEW production game-equipment sprite atlas derived from the two reference atlases. Match EXACTLY their finely shaded low-resolution pixel-art style, dark brown/plum one-pixel contours, upper-left light, medieval circus heraldry, 3/4 side view facing right, readable small silhouettes. This is a replacement NEW high-tier PARTS atlas, not a whole illustration, not full characters. Transparent actual alpha background. Final image tall 1:2 proportion, ideally 1024x2048. STRICT REGULAR GRID: FOUR columns and EIGHT equal rows, 32 separated cells, each cell one isolated piece with at least 12% transparent gutter. No labels, no lettering, no frame/gridlines, no shadows outside pieces. Each ROW is an equipment set. FOUR COLUMNS in every row: (1) head ornament crown/hood ONLY, no face/hair; (2) BACK piece cloak/ritual back apparatus/quiver ONLY, no body; (3) MAIN HAND weapon ONLY with continuous grip; (4) shoulder+chest armor or ritual vestment ONLY, no head/arms/legs. Pieces centered, separate, complete.
Row1 MYTHIC SOVEREIGN: tall ivory crescent crenellation crown, long split royal mantle with ermine shoulders and diamond lining, ornate broad sword-sceptre, angular command pauldrons breastplate.
Row2 PRISMATIC SOVEREIGN: more architectural five-prong crown, winged layered brocade command mantle, fork-guard crystalline royal sword-sceptre, projecting segmented layered pauldrons; silhouette and layered material upgrades over row1, not just color.
Row3 MYTHIC CHAPLAIN: soft pointed ceremonial mitre cap, portable crescent reliquary backstand with hanging prayer ribbons and small books (gentle healer, not attack mage), long staff topped by a twin-cup heart reliquary with a small open prayer book suspended near grip, embroidered shoulder stole and rounded ritual vest.
Row4 PRISMATIC CHAPLAIN: three-panel mitre, articulated folding triptych reliquary wings carrying small bells and prayer strips, staff topped by branching three-cup vessel and book, scalloped layered stole/vest.
Row5 MYTHIC SHIELD GUARD: low closed visor helmet with two broad cheekguards, heavy segmented armored back tabard, giant broad rectangular arched-top PAVISE TOWER SHIELD (not sword), very wide slab pauldrons and layered cuirass.
Row6 PRISMATIC SHIELD GUARD: stepped castle visor helmet, interlocking hinged armored backplates, tower shield with flared stepped double side-walls and central raised fortress ridge, offset doubled architectural pauldrons.
Row7 MYTHIC LONGBOW HUNTER: asymmetric feathered hood, slim leather quiver full of long arrows with small trailing split cape, very large elegant recurved longbow with taut visible string and central grip, narrow angled leather shoulder harness breastplate.
Row8 PRISMATIC LONGBOW HUNTER: two-prong feather hood with tiny checkered band, paired angular quiver with long fletched arrows and split cloak tails, elaborate split-limb DOUBLE recurved longbow with visible string and central grip, layered but light asymmetric shoulder harness.
All pieces reuse suit symbols, modest checkered embroidery, small collar bells asymmetry as accents; profession silhouette first. Sovereign/chaplain/shield/hunter must be very different in GRAYSCALE as well as color. Grade5 uses moon-silver ivory muted teal; grade6 crystal-edged ivory muted mauve/rose, a few jewel accents; no huge rainbow glow. Keep the same pixel density and intricate raster shading as references, no vector blocks, no smooth HD paint, no photorealism, no particles/glow halos, no character faces or bodies. Weapons vertical, grip around 65–75% from top except bow grip central. This atlas will be trimmed cell-by-cell and its parts attached to existing animated joints.
```

实际生成尺寸与提词中的目标尺寸不同，装载器按4×8动态网格读取，不依赖绝对像素尺寸。主手君主部件更接近王权长刃，实际使用这一真实造型；没有把它改称不存在的新武器或新技能。
