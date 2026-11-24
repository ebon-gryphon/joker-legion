# 小丑军团像素美术素材

这些素材由内置 ImageGen 生成，已复制到当前项目并逐张目视检查。没有使用 CLI/API fallback。

新增四职业神话／棱彩部件图集 `high-tier-parts.png` 的32部件布局、参考原图及完整生成提示词见 [HIGH_TIER_ART.md](HIGH_TIER_ART.md)。原有图集保持不变。

## 旧版点数衣装图集（存档）

`wardrobe.png` 是一张 1280 × 340 的透明像素图，分为 8 列、2 行，每格 160 × 170。前十三格依次为 A、2 至 10、J、Q、K 的空手衣身，末三格是圣杖、反曲弓和蓝金盾。原图按四行四列生成，打包时裁掉透明留白，保留了每套衣装的长宽比例。

旧版曾按点数给士兵换装。当前版本的服装、兵器和坐骑见文末「品质军装与兵器」。

## 图集契约

- 四个阵营角色图集均为 **1774 × 887 RGBA PNG**，透明背景。
- 每张图集固定 **7 列 × 2 行**；没有外部留白。槽位顺序如下。

| 行 | 列 1 | 列 2 | 列 3 | 列 4 | 列 5 | 列 6 | 列 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A | 2 | 3 | 4 | 5 | 6 | 7 |
| 2 | 8 | 9 | 10 | J | Q | K | 空 |

- 每个角色拥有独立头饰、武器、服饰与剪影。普通牌绘使用阵营原画。征兵预览、名册、战场和拖动立绘共用品质军装图集。
- 图片尺寸不能整除 7；裁图坐标需以自然宽度除以 7 计算，不要假定整数单格宽度。
- 角色脚底约在每格高度的 92%～96%；A 的光环、长弓与旗帜接近格顶。可以去掉 1～2 个源像素的边界杂点，不要大幅裁切人物。
- 精灵显示使用 nearest-neighbour，即 Canvas `imageSmoothingEnabled = false` / CSS `image-rendering: pixelated`。

## 文件

| 文件 | 内容 | 尺寸 |
| --- | --- | --- |
| spades.png | 黑钢王庭，蓝钢银甲与铜金饰件，13 名铁卫 | 1774 × 887 |
| hearts.png | 赤誓教团，赤红与象牙白，13 名圣职/医者 | 1774 × 887 |
| clubs.png | 逐日游骑，琥珀皮甲与金羽，13 名游侠 | 1774 × 887 |
| diamonds.png | 星烬秘会，暮紫法袍与星晶，13 名术士 | 1774 × 887 |
| relics.png | 10 枚小丑/遗物图标，透明 5×2 图集 | 1983 × 793 |
| battlefield.png | 深靛蓝夜色石庭，两侧城门与中间空战区，无单位/UI | 2089 × 753 |

遗物顺序为旗帜、赤心、三面戏剧面具、血瓶、双弩 / 宝箱、荆棘圣杯、死亡小丑面具、皇家冠、四色宝石冠。

## 提示词与源文件记录

### spades

生成模式为内置 ImageGen，透明背景。从文字新生成。

源文件：`/Users/Admin/.codex/generated_images/01a1ecf0-53fc-7331-9f33-66b49ee2f599/exec-d7d86899-720e-4843-9a08-a021fe4b28ca.png`

```text
Use case: stylized-concept.
Asset type: production-ready transparent 2D game sprite atlas, one complete army faction sheet for a pixel-art poker tactical auto-battler.
Create EXACTLY THIRTEEN distinct full-body medieval heavy-armour knight characters, distributed in an EXACT regular 7-column by 2-row grid. Whole canvas landscape 1536x768. There is no outer sheet padding. Every grid cell has identical width and height. Sprite centered at the center of its cell with feet at 83% of cell height. Each full body and all equipment fit entirely in its own cell with at least 10% empty margin. Slot 14 (bottom right corner) is COMPLETELY EMPTY transparent. No character can overlap or extend outside its cell.
Style: authentic carefully hand-placed 16-bit tactical RPG pixel art, clean large square pixel clusters, 48x64 logical pixels per character scaled uniformly with nearest-neighbour hard edges. Chibi adult warrior proportions, 3-quarter view, face and body oriented slightly to the RIGHT. Dark ink outline one logical pixel thick, flat limited palette, 3-tone pixel shading, strong readable tiny silhouettes. This is a sprite sheet for an actual game, not a painted concept sheet.
Faction is the Blacksteel Court: steel-blue armour, pale silver highlights, midnight navy shadows, small copper-gold details. No green. Each of the 13 has a genuinely different visible shape, armour/headgear, weapon, cloak or hair.
Read left to right in the TOP row then left to right in BOTTOM row:
1 Ace: mythic champion, horned closed helmet, huge silver glowing greatsword, indigo long cape, gold shoulder wings.
2 rank2: young open-face spear recruit, simple round helmet, tiny round buckler.
3 rank3: short sword guard, angular steel helmet, medium round shield.
4 rank4: mace sentry, square tower shield, flat-topped helm.
5 rank5: long pike bearer, pointed helmet, short blue tabard.
6 rank6: heavy axe fighter, bare brown-bearded face, split shoulder armour.
7 rank7: silver paladin with cross-shaped shield and winged helm.
BOTTOM row:
8 rank8: halberd officer, ridged helmet with blue plume.
9 rank9: two-handed greatsword veteran with broad pauldrons and eye scar.
10 rank10: fortress guardian, enormous rectangular shield, fully enclosed dark helm.
11 Jack: young marshal, silver headband, short officer sword and blue banner.
12 Queen: silver-haired warrior queen, slender crown, ornate spear, royal indigo cape.
13 King: bearded king, gold crown, steel longsword and fur mantle.
14 EMPTY.
Every body should be of comparable ~same overall size, kings/champion can be up to 15% taller. No text, numbers, ranks, suit symbols, label, logo, watermark, cards, borders, drawn grid, pedestal or ground. True alpha transparency, no background, no checkerboard texture. Keep every character separable and centered on its exact cell.
```

### hearts

生成模式为内置 ImageGen，透明背景。以 spades.png 作为像素风格/布局参考；背景图只参考风格。

源文件：`/Users/Admin/.codex/generated_images/01a1ecf0-53fc-7331-9f33-66b49ee2f599/exec-6dfcf6f4-2442-486e-843c-e071c438c215.png`

```text
Use case: stylized-concept. Asset type: production-ready transparent pixel-game sprite atlas.
The attached sprite sheet is a STYLE AND GRID REFERENCE ONLY. Create an entirely new faction, not knights. Keep exactly its 7 columns by 2 rows layout, its pixel-art scale, overall framing and transparent background. EXACTLY THIRTEEN distinct full-body characters in 13 cells, last bottom-right cell completely empty. Landscape canvas 2:1 aspect. No outer padding: divide canvas into7 equal columns and2 equal rows. Each sprite stands centered inside own cell, feet near89%cell height, with 8%horizontal empty safety margins. All weapons/capes must fit inside own cell. No overlap. No gridlines, no boxes, no thin marks along cell edges. Pure alpha transparency, no black fill/checkerboard.
STYLE: refined16-bit tactical RPG sprite art, intentionally chunky square pixels,48x64logical sprite detail scale,crisp unfiltered edges,dark1pixeloutline,limitedpalette3-tone shading. Front3quarter view facing slightly RIGHT. Adult chibi proportion, readable full-body silhouettes, comparablebody sizes. Distinct headgear, hair, tools and garments for EVERYrank, not repeated poses or palette swaps. No text, letters, card ranks, numbers, labels, cards,borders,suit symbols,watermarks.
Slots lefttoright topthenbottom are A,2,3,4,5,6,7 / 8,9,10,J,Q,K,EMPTY. FACTION: Red Oath clergy and battlefield medics. Ivory white robes/armour, crimson capes and hoods, small warmgold ceremonial tools, warm skin. NO blue steel knights. TOPROW1:A mythic flame saint, flamehalo, wing-shaped golden healing staff, flowingcrimsonandivorycloak;2candleacolyte,whitehood,holdingalittlegoldencandle;3bandagemedic,redwhitescarf,medicalcaseandrolledbandages;4bellsmonk,shortredrobe,copperbellstaff;5redmaskedapothecary,bottlebelt,holdingamberhealingpotion;6pilgrimpriest,longwoodstaff,oldbook,ivoryrobe;7thornchalicecleric,thorn-ringedsilverchalice,redrobe goldedges. BOTTOMROW8:whitegoldroundshieldpriest,redhood;9whitefeatherbishop,splitmitre,featheredshouldermantle,carvedcrozier;10crimsonrobedwisemanholdinglargeopenholybook,ivoryrunes;11ceremonymarshal,raisedredcrossbanner,longvestments;12whitehairedsaintqueen,thinfloatinggoldhalo,bothhandsliftinggoldchalice;13elderhighpontiff,triplegoldtiara,crimsongoldstaff,largeivorymantle. 14empty.
```

### clubs

生成模式为内置 ImageGen，透明背景。以 spades.png 作为像素风格/布局参考；背景图只参考风格。

源文件：`/Users/Admin/.codex/generated_images/01a1ecf0-53fc-7331-9f33-66b49ee2f599/exec-a34d5890-e8c7-4d5e-a173-f25b277d5ca3.png`

```text
Use case: stylized-concept. Asset type: production-ready transparent pixel-game sprite atlas.
The attached sprite sheet is a STYLE AND GRID REFERENCE ONLY. Create an entirely new faction, not knights. Keep exactly its 7 columns by 2 rows layout, its pixel-art scale, overall framing and transparent background. EXACTLY THIRTEEN distinct full-body characters in 13 cells, last bottom-right cell completely empty. Landscape canvas 2:1 aspect. No outer padding: divide canvas into7 equal columns and2 equal rows. Each sprite stands centered inside own cell, feet near89%cell height, with 8%horizontal empty safety margins. All weapons/capes must fit inside own cell. No overlap. No gridlines, no boxes, no thin marks along cell edges. Pure alpha transparency, no black fill/checkerboard.
STYLE: refined16-bit tactical RPG sprite art, intentionally chunky square pixels,48x64logical sprite detail scale,crisp unfiltered edges,dark1pixeloutline,limitedpalette3-tone shading. Front3quarter view facing slightly RIGHT. Adult chibi proportion, readable full-body silhouettes, comparablebody sizes. Distinct headgear, hair, tools and garments for EVERYrank, not repeated poses or palette swaps. No text, letters, card ranks, numbers, labels, cards,borders,suit symbols,watermarks.
Slots lefttoright topthenbottom are A,2,3,4,5,6,7 / 8,9,10,J,Q,K,EMPTY. FACTION: Sunward rangers, hunters and archers. Warm amber capes,brownleatherarmour,ochreandgoldfeathers,ivorydetails,warmbrownskin;NOgreen palette. Weapons are bows,crossbows,quivers,notknights. TOPROW1:A mythicalsunhunterking,largesun-wheelgoldbow,tallgoldfeather,longambercloak;2shortbowscout,plainleathercap,shortbowandsmallquiver;3featherhatwoodsman,softoldbrownwidebrimhatwithonepheasantfeather,longbow;4lightcrossbowrider,leatherhalfarmour,smallhandcrossbow;5falconranger,afalconperchedonambershoulder,longochrescarf;6twin-crossbowhunterholdingtwosmallcrossbows,wideboltbelt;7longbowsharpshooter,tiedbacklonghair,bowtallerthanhead,slenderbody. BOTTOMROW8:wolf-peltambusher,greywolf-furshoulders,darkbrownfacescarf,curvedhuntingbow;9goldfeathersniper,slenderbow,goldenfeathercrest,anddecoratedquiver;10sunwardeliteguard,sun-shapedshoulderarmour,heavyrepeatingcrossbow,amberlongcape;11rangermarshal,three-tailfeatherheaddress,raisedgoldbrowneaglebanner;12wildernessqueen,longgold-brownhair,bonecrown,elegantcurvedlongbow;13sunwardlord,antlercrown,thickfurhuntcoat,largegold-inlaidbow. 14empty.
```

### diamonds

生成模式为内置 ImageGen，透明背景。以 spades.png 作为像素风格/布局参考；背景图只参考风格。

源文件：`/Users/Admin/.codex/generated_images/01a1ecf0-53fc-7331-9f33-66b49ee2f599/exec-88a10ed2-a33f-427d-ad71-7e497a0b2dfb.png`

```text
Use case: stylized-concept. Asset type: production-ready transparent pixel-game sprite atlas.
The attached sprite sheet is a STYLE AND GRID REFERENCE ONLY. Create an entirely new faction, not knights. Keep exactly its 7 columns by 2 rows layout, its pixel-art scale, overall framing and transparent background. EXACTLY THIRTEEN distinct full-body characters in 13 cells, last bottom-right cell completely empty. Landscape canvas 2:1 aspect. No outer padding: divide canvas into7 equal columns and2 equal rows. Each sprite stands centered inside own cell, feet near89%cell height, with 8%horizontal empty safety margins. All weapons/capes must fit inside own cell. No overlap. No gridlines, no boxes, no thin marks along cell edges. Pure alpha transparency, no black fill/checkerboard.
STYLE: refined16-bit tactical RPG sprite art, intentionally chunky square pixels,48x64logical sprite detail scale,crisp unfiltered edges,dark1pixeloutline,limitedpalette3-tone shading. Front3quarter view facing slightly RIGHT. Adult chibi proportion, readable full-body silhouettes, comparablebody sizes. Distinct headgear, hair, tools and garments for EVERYrank, not repeated poses or palette swaps. No text, letters, card ranks, numbers, labels, cards,borders,suit symbols,watermarks.
Slots lefttoright topthenbottom are A,2,3,4,5,6,7 / 8,9,10,J,Q,K,EMPTY. FACTION: Star-Ash conclave, arcane sorcerers. Deepvioletrobes,amethystcrystals,coppergoldrunes,midnightnavyshadows,ivory/silverhairaccents. NOgreen. Powerfulmagicalequipmentandsilhouettes,notknights. TOPROW1:A mythicalstarashprophet,floatingorbitalstarhalo,splitamethystcrystalstaff,violetbillowingrobe;2glimmerapprentice,oversizedpointedhat,holdingonesmallpurplecrystal;3stardustnovice,holdingjarofgoldstardust,shortpurplecapewithgoldspots;4crystalclusterhexer,forkedcrystalbranchstaff,jaggedamethystshoulders;5candleflamealchemist,coppergoggles,potionbottles,tinysmelteronbelt;6runepagemage,openfloatinggoldrunesheets,goldenwritingquill;7crescentastrologer,crescentmoonstaff,darkpurplefaceveil,star-wide-sleeves. BOTTOMROW8:mirrorillusionist,silvermirrormask,two-sidedshiningmirrorwand;9twincrystalenforcer,twofloatingcrystalsoverhisshoulders,goldpurplearmouroverrobes;10astrolabegrandmage,holdinglargebrassastrolabe,layeredstar-robetrails;11conclavelanternmarshal,longpoledstarlantern,angularpointedcrown;12duskingstarqueen,purplecrystalcrown,silverwhitehair,orbitalringstaff;13monarchofstars,wideastralcrown,goldembroideredvioletroyalrobes,giantdiamondcrystalstaff. 14empty.
```

### battlefield

生成模式为内置 ImageGen，不透明背景。以 spades.png 作为像素风格/布局参考；背景图只参考风格。

源文件：`/Users/Admin/.codex/generated_images/01a1ecf0-53fc-7331-9f33-66b49ee2f599/exec-d9197f76-1e70-4402-900c-4febe6762f9f.png`

```text
Use case: stylized-concept. Asset type: 2D pixel-art tactical auto-battler battlefield background.
Create a beautifully crafted16-bit pixel-art ruined royal courtyard at midnight, panoramic1000x360composition, about2.78:1 aspect ratio. Reference attached characteratlas ONLY for crisp square-pixel style and palette, DO NOT include any character/sprite/unit fromreference. Environment should match an actual tactical RPG, not a conceptpainting. Hard squarepixel clusters, limitednightpalette, deliberate2-3tone shading,ditheredpixels,NOsmoothgradients or painterlybrushwork.
Camera: frontthreequarter slightly elevated sideview of a broad flat stonebattlefield. Wide empty fighting area fromx12%tox88%, mostly in lower60% ofimage. The ground starts at43%ofimageheight and continues tobottom, made of largemidnightindigo flagstones, subtle worn copperinlay, brokenstones alongfarleft/rightandbottomedges. AtLEFTedgeonly a compactbluishgreyfriendlyfortressgate/castleentrance withsteelbluebanners,amberbraziers;atRIGHTedgeonly a crumblingdarkvioletfortressgate withscarletbanners andfewembertorches. Gatesbothface inward tofield and leavecenterplayableareaentirelyclear. Distantgothiccastlewall,towers,archedwindowsatupperhalfwithdeepindigosky,smallwaxingmoonand sparsepixelstars. Two small raisedcastleflanksframeedges but NOgiantforegroundcolumnsblockingfield. Quiet darkcharcoalbluevioletworld, coppergoldtorchlight, mutedstonehighlights. NO forestgreenbase, nofelt,no cardtable.
No units,nopeople,noUI,no text,noletters,nocardranks,no numbers,nohealthbars,no icons,no grid,no largecenteremblem,nowatermarks. Exactemptyfieldwithrich environmental detail and clear dark negative space forforegroundsoldiers. Opaquebackground.
```

### relics

生成模式为内置 ImageGen，透明背景。以 spades.png 作为像素风格/布局参考；背景图只参考风格。

源文件：`/Users/Admin/.codex/generated_images/01a1ecf0-53fc-7331-9f33-66b49ee2f599/exec-875e3887-afba-4135-ab76-d4b93d3cced3.png`

```text
Use case: stylized-concept. Asset type: production-ready transparent 2D pixel game relic inventory icon atlas.
Create EXACTTEN distinct large pixel-art magicrelicicons in exact5 columns by2 rows regular grid. Wholecanvas landscape2.5:1aspectratio, equal squarecells, no outerpadding, each reliccenteredwithinitscell with15%emptyspace allaround. No overlap,no gridlines or cellboundaries. Attachedimage only references pixelgameartquality, notcharacters: drawITEMS ONLY.
Authentic16-bit RPGinventorypixelart,hard squarepixels,32x32logicalpixeliconsscaledwithoutfiltering,chunkyreadablesilhouettes,dark1pixeloutline,limitedcrisp3tones. Opaqueitems onTRUEALPHAtransparentbackground. Coppergold,steelblue,ivory,amethyst,andcrimsoncolors. No greenbase.
Ordertoplefttoright:
1Blue-steel battlebanner onshortgoldstaff, silver spade-shapedfleur detail;
2Crimson facetedheartcrystal withivorysmallwings;
3Violettriple-facedtheatremask cluster with3clearlyseparatedfaces;
4Glassvialofcrimsonblood,ivorycork,goldchain;
5TwoambercrossbowscrossedinXshape.
Bottomlefttoright:
6Copper-goldtreasurechestwithpurplecrystalandcoins;
7Goldenholy chalice surroundedbycrimsonthornvines;
8Ivorysmilingdeathmask/skullwithsmallvioletjesterhorns;
9Broadroyalcrown,steeldarkbluebase,coppergoldtips,redcentralgem;
10Ornateslendercrownwith4distincttinygemcolorsbluecrimsonamberviolet.
Everyiconfillsmostofitscellanddistinguishableat32px. No cards,nocharacters,nolabels,no text,numbers,ranks,logo,watermark,frames,pedestals,groundshadow,checkerboardtexture. Truealpha. Maintainprecise5x2gridthatcanbedirectlysliced.
```




## 2026-11-18 花色识别强化

用户要求卡牌突出牌花特色。本轮使用内置 ImageGen 的图像编辑模式，将主花色纹章融入原有角色的盾面、胸甲、披风、圣袍、书封与旗帜。黑桃与梅花使用象牙白底的深黑花色；红桃与方块使用象牙白底的红色花色。保留全部 52 位人物身份、姿势、装备和图集格位。原图备份在 `output/legion-suit-art-before/`。

四张最终图集仍为 **1774×887 RGBA PNG，7列×2行，13人，右下空格**。已逐张目视检查。黑桃9号的双手巨剑遮住胸前位置，额外在可见披风面增加黑桃徽记。

### spades 花色编辑

编辑目标：`public/legion-pixel/spades.png`（本轮编辑前版本，见备份）。

生成源文件：`/Users/Admin/.codex/generated_images/01a1ed81-be4c-7463-bfe2-3c4b1636d207/exec-aa6bb79f-c4f6-47d8-b79f-66a3c890f7e3.png`

```text
Use case: precise-object-edit.
Asset type: existing production pixel-art sprite atlas. The attached image is the EDIT TARGET, not a loose style reference.
Keep exactly the same 1774x887 canvas, transparent alpha background, exact 7-column by 2-row grid, all thirteen original character identities, the same left-to-right ordering, poses, faces, weapons, full-body size, cell centers and feet positions. Top row A,2,3,4,5,6,7; bottom row 8,9,10,J,Q,K,EMPTY. Bottom-right cell remains completely empty. No character crosses cell boundaries. Do not add new units, remove units, change the equipment types, change the crop, or draw gridlines/cards/UI/text.
Edit ONLY the faction heraldry and its close decorative accents. Keep the existing polished chunky square-pixel tactical-RPG style, colors, body shading and hard pixel edges. These sprites will be tiny in a poker army game: the actual classic playing-card SUIT must become unmistakeable on EVERY character at a glance. Favor one very large, simple, flat, high-contrast emblem over many tiny intricate motifs. Integrate it into armor, tabards, chest medallions, existing shields and existing banners; no floating labels outside characters. A,J,Q,K should have especially large emblems. Keep faces/hair recognizable and do not cover faces.
FACTION SPADES ♠. Preserve blue-steel/silver/navy knights and copper trims. REPLACE generic crosses, starbursts and unrelated heraldry with bold classic BLACK SPADE PIPS: one solid pointed leaf / inverted heart, with a narrow downward stem and flared foot, unmistakably ♠. Each sprite needs at least one highly visible large BLACK INK SPADE on a pale IVORY/SILVER plate: chest breastplate or tabard patch, shield face where shield exists, and Jack's banner. Large high-contrast spade silhouettes on all existing shields; spade-tipped helmet ornaments only as secondary accents. Do not use cross shapes, diamonds, clubs, four-leaf clovers, hearts or generic pointed gems in place of the correct spade. Do not replace weapons. The spear recruits still have spears, the sword guards swords, queen ornate spear, king sword. The main black spade must remain readable when the full character is displayed only70pixels tall.
```

### clubs 花色编辑

编辑目标：`public/legion-pixel/clubs.png`（本轮编辑前版本，见备份）。

生成源文件：`/Users/Admin/.codex/generated_images/01a1ed81-be4c-7463-bfe2-3c4b1636d207/exec-a580c1bf-1ec9-4c1e-b883-200c0b19f75c.png`

```text
Use case: precise-object-edit.
Asset type: existing production pixel-art sprite atlas. The attached image is the EDIT TARGET, not a loose style reference.
Keep exactly the same 1774x887 canvas, transparent alpha background, exact 7-column by 2-row grid, all thirteen original character identities, the same left-to-right ordering, poses, faces, weapons, full-body size, cell centers and feet positions. Top row A,2,3,4,5,6,7; bottom row 8,9,10,J,Q,K,EMPTY. Bottom-right cell remains completely empty. No character crosses cell boundaries. Do not add new units, remove units, change the equipment types, change the crop, or draw gridlines/cards/UI/text.
Edit ONLY the faction heraldry and its close decorative accents. Keep the existing polished chunky square-pixel tactical-RPG style, colors, body shading and hard pixel edges. These sprites will be tiny in a poker army game: the actual classic playing-card SUIT must become unmistakeable on EVERY character at a glance. Favor one very large, simple, flat, high-contrast emblem over many tiny intricate motifs. Integrate it into armor, tabards, chest medallions, existing shields and existing banners; no floating labels outside characters. A,J,Q,K should have especially large emblems. Keep faces/hair recognizable and do not cover faces.
FACTION CLUBS ♣. Preserve amber/brown leather archers, gold feathers and hunter equipment. REPLACE generic eagles, suns and unrelated decorative crests with bold classic BLACK CLUB PIPS: exactly THREE ROUND LOBES in a triangular arrangement, connected in the center, plus one narrow downward stem with a flared foot, unmistakably ♣. This is the classic black playing-card club symbol, NOT a green four-leaf clover, not a flower, not a pointed spade. Every sprite gets a prominent large pale IVORY chest medallion, shoulder plate or cape-front badge bearing a solid BLACK CLUB with THREE visibly circular lobes and a clear stem. Jack's existing banner shows one enormous black ♣ on a pale ivory field bordered amber. The Ace and King bow ornament and Queen crown may repeat the trefoil silhouette. Keep every original bow/crossbow, the falcon, wolf pelt, antler crown and individual faces. Main suit emblems must be large enough to remain visibly three-lobed at70-pixel character height.
```

### hearts 花色编辑

编辑目标：`public/legion-pixel/hearts.png`（本轮编辑前版本，见备份）。

生成源文件：`/Users/Admin/.codex/generated_images/01a1ed81-be4c-7463-bfe2-3c4b1636d207/exec-369953e3-dafc-4545-aaea-a058b3e8205a.png`

```text
Use case: precise-object-edit.
Asset type: existing production pixel-art sprite atlas. The attached image is the EDIT TARGET, not a loose style reference.
Keep exactly the same 1774x887 canvas, transparent alpha background, exact 7-column by 2-row grid, all thirteen original character identities, the same left-to-right ordering, poses, faces, weapons, full-body size, cell centers and feet positions. Top row A,2,3,4,5,6,7; bottom row 8,9,10,J,Q,K,EMPTY. Bottom-right cell remains completely empty. No character crosses cell boundaries. Do not add new units, remove units, change the equipment types, change the crop, or draw gridlines/cards/UI/text.
Edit ONLY the faction heraldry and its close decorative accents. Keep the existing polished chunky square-pixel tactical-RPG style, colors, body shading and hard pixel edges. These sprites will be tiny in a poker army game: the actual classic playing-card SUIT must become unmistakeable on EVERY character at a glance. Favor one very large, simple, flat, high-contrast emblem over many tiny intricate motifs. Integrate it into armor, tabards, chest medallions, existing shields and existing banners; no floating labels outside characters. A,J,Q,K should have especially large emblems. Keep faces/hair recognizable and do not cover faces.
FACTION HEARTS ♥. Preserve crimson/ivory clergy, healers, tools and holy clothes. REPLACE generic cross/stellar emblems with bold classic RED HEART PIPS: two large rounded top lobes meeting in a center cleft, tapering to one sharp bottom point, unmistakably ♥. Every character needs a simple large vivid RED HEART on a pale IVORY robe-front patch, chest medallion, existing shield face or holy book cover. Replace Jack's red cross banner with a large RED HEART on ivory. Heart-head accents on existing staves can repeat this identity. Keep all original candles, bandages, bell staff, potion, book, chalice, shield, crown and original characters unchanged. No generic cross should dominate anymore; the large heart is the faction identity, visible even at70-pixel character height.
```

### diamonds 花色编辑

编辑目标：`public/legion-pixel/diamonds.png`（本轮编辑前版本，见备份）。

生成源文件：`/Users/Admin/.codex/generated_images/01a1ed81-be4c-7463-bfe2-3c4b1636d207/exec-58f1d145-495d-4bc6-b0b0-5fd4bc1b5881.png`

```text
Use case: precise-object-edit.
Asset type: existing production pixel-art sprite atlas. The attached image is the EDIT TARGET, not a loose style reference.
Keep exactly the same 1774x887 canvas, transparent alpha background, exact 7-column by 2-row grid, all thirteen original character identities, the same left-to-right ordering, poses, faces, weapons, full-body size, cell centers and feet positions. Top row A,2,3,4,5,6,7; bottom row 8,9,10,J,Q,K,EMPTY. Bottom-right cell remains completely empty. No character crosses cell boundaries. Do not add new units, remove units, change the equipment types, change the crop, or draw gridlines/cards/UI/text.
Edit ONLY the faction heraldry and its close decorative accents. Keep the existing polished chunky square-pixel tactical-RPG style, colors, body shading and hard pixel edges. These sprites will be tiny in a poker army game: the actual classic playing-card SUIT must become unmistakeable on EVERY character at a glance. Favor one very large, simple, flat, high-contrast emblem over many tiny intricate motifs. Integrate it into armor, tabards, chest medallions, existing shields and existing banners; no floating labels outside characters. A,J,Q,K should have especially large emblems. Keep faces/hair recognizable and do not cover faces.
FACTION DIAMONDS ♦. Preserve violet/gold sorcerers, violet crystals, hats and equipment. Emphasize the classic playing-card DIAMOND: a clean solid RHOMBUS with exactly four sharp corners, tall vertical axis, unmistakeably ♦. Every character needs a large RED/COPPER-RED DIAMOND on a pale IVORY inset chest plate, robe-front applique, book or visible cloak panel. Gold trim may outline the diamond but center stays solid vivid deep red so the suit is distinct from plain purple crystals. Replace unrelated star/cross medallions with clear diamond pips. Jack's lamp and Queen/King crown may echo diamond silhouette; keep original weapons, floating apparatus, books, mirrors, hair and thirteen identities. Main suit rhombus emblem must stay clear at70-pixel character height.
```

### 黑桃9号披风徽记微调

本轮最终黑桃源文件：`/Users/Admin/.codex/generated_images/01a1ed81-be4c-7463-bfe2-3c4b1636d207/exec-9d35d37a-74b9-42b1-a8f2-7269f12e5342.png`

```text
Use case: precise-object-edit. The attached PNG is the EDIT TARGET. Make ONE SMALL localized correction and preserve everything else pixel-for-pixel as closely as possible.
This is an exact 1774x887 transparent game sprite atlas, 7 columns x2 rows, thirteen original characters, lower-right cell empty. Preserve canvas dimensions, all cell layout, alpha transparency, identities, costumes, faces, poses, body sizes, all weapons, hard pixel-art style and all existing black spade emblems.
TARGET: ONLY the character in BOTTOM ROW, SECOND COLUMN (rank9), the bare-headed brown-haired veteran holding his huge two-handed sword vertically. His existing hands and sword hide his chest. Add a large ivory applique panel on the visible LEFT-side area of his indigo cape, BELOW his left shoulder and to the left of the sword, bearing one prominent solid BLACK SPADE ♠: pointed leaf/inverted heart with downward stem/flared base. This should visually match the ivory patches with black spades on other characters. Make the emblem fill much of the visible cape panel, readable at70-pixel height. Keep his sword and hands completely unchanged. Keep the other12characters and all existing emblems completely unchanged; no additional text, borders, grid, effects or background. Do not modify any other cell.
```

## 六种融合职业

`fusions.png` 使用内置 ImageGen 生成，采用透明背景。交付图集为 768 × 512，三列两行，各帧按不透明轮廓裁边后等比缩放到 256 × 256 的格子，脚底对齐。从左到右，第一行是圣盾骑士、铁棘猎卫、星刃卫士，第二行是林歌医师、绯晶司祭、霜弦游侠。

```text
Use case: stylized-concept
Asset type: a single production transparent pixel art sprite atlas, landscape 3:2, for a polished medieval tactical RPG. Exactly SIX different elite characters placed in six equal square cells on an invisible THREE-COLUMN by TWO-ROW grid. Each sprite is fully contained in only its own cell with at least 8% transparent padding on every side. Only these six figures, isolated on actual alpha; no background, no letters labels text or UI, no gridlines, no badges, no ground shadows. All individual figures full body from helmet/weapon tips to boots, clear friendly readable SNES-era 3/4 front standing pose, turned slightly to right; sober heroic tone, clean black pixel outlines, native pixel clusters, short 4-head-tall proportions, consistent direct soft upper-left light, coherent warm gold highlights, strong distinct silhouettes, hands and gear readable at 64px. Every group of pixels counts. Keep the same head size and character height across each cell, feet along common horizontal baseline at 90% of their cell. Very little tiny noisy detailing.
Top left: a steadfast paladin with ivory steel armor, deep crimson tabard, navy mantle, oversized ivory-and-red protective shield on left and small mace in right. Top middle: an iron thicket warden with angular gunmetal armor, ochre cloth, a helmet with upturned brim and centered, clearly recognizable horizontal wooden crossbow with bronze bow limbs. Top right: a starlight sentinel, indigo knight, silver armor with violet crystals, eye-catching amethyst greatsword raised diagonally upwards.
Bottom left: a forest song healer with sage green feathered cap, pale rose scarf, small wooden harp-bow with distinct golden strings, deer-leaf armor and medic satchel. Bottom middle: a crimson crystal priest with elegant crimson-violet split-robes, tall ruby sceptre, a dramatic pointed bishop headdress, warm face. Bottom right: a frost bow ranger, blue-gray fur and glacial teal hood and scarf, large pale ice crystal recurved bow. No text watermarks gradients glows or atmospheric effects; genuine transparent empty space around every figure.
```

## 敌军与首领图集

`enemies.png` 由内置 ImageGen 参照 `fusions.png` 的造型比例与像素明暗关系生成。透明原图为 1774 × 887，按角色之间的透明间距分别裁出八帧，等比使用最近邻缩放并封装为 1024 × 512 图集。每格 256 × 256，地面角色脚底基线为 244，夜翼悬空。

帧序从左向右。上排为流寇、夜翼、暗弓手、碎盾巨兵，下排为猩红术士、鸣钟使、无冕之王、狂暴的无冕之王。

```text
Use case: game enemy sprite atlas. Generate ONE NEW wide 2:1 landscape transparent pixel art sprite sheet, 4 equally wide columns × 2 equally tall rows, eight distinct full-body sprites. The attached image is only the visual style reference for clean hand-pixelled silhouettes, dark outlines, chibi-fantasy body proportions and small highlight clusters, NOT the layout nor reuse of any character. Art direction of a premium dark fantasy tactical RPG. Every sprite faces screen right in three-quarter profile, strongly readable silhouette at 50px, held item visible, matching pixel size and painterly limited-retro palette as reference. Each individual body stays entirely inside its own cell, central 78% of the square. Large transparent gutters, no overlaps or debris in neighboring cells. True transparency outside outlines. No names, text, cards, tokens, backdrop, ground, ground shadow, grid lines, glows or detached particles.

Top row left to right strictly:
1. A lean outlaw raider, scarred uncovered face and rusty half-helm, ragged oxblood cloak, dark leather sash and a cleaver-like hand axe.
2. A flying purple NIGHT BAT monster, two openly spread angular horizontal violet leathery wings, tiny charcoal fur torso, long bat ears, pale fangs. One bat only.
3. A masked black hooded dark archer, gray-blue leather vest and black curved longbow, poised to fire, ochre arrow quiver on the back. Slender silhouette.
4. A hulking infantry brute with oversized steel plate pauldrons, small slotted helmed head, compact colossal square-headed heavy maul held across the body. Strong dark iron, aged copper highlights.

Bottom row left to right strictly:
1. A crimson warlock with dark hair and curling horned scarlet circlet, deep red split robe, clawed crimson crystal atop a tall black staff. Separate distinctive red silhouette.
2. A BELLKEEPER ritual enemy. A hunched faceless burgundy hooded monk carrying a tall wooden yoke with a HUGE suspended antique bronze church bell and clearly visible golden clapper. The bell is half the character's width and openly silhouetted on their front side. Bright bronze, muted wine cloth and black shadow.
3. Calm uncrowned king boss, imposing broken gold crown, dark silver ornate plate armor with a crimson gem on his sternum, deep oxblood mantle falling straight, broad long silver sword, composed upright stance.
4. The same unmistakable king, same face, broken crown, longsword and armor, now visibly ENRAGED: chest plate split with glowing hot amber fissures and cape flaring wide into two red-black wings, aggressive forward stance. All visible light stays within its silhouette.
Consistent pixel artwork across ALL EIGHT. The kings in slots 7+8 should share identity but present dramatically different silhouette. Exact four-by-two packing; wide landscape.
```

## 可玩小丑的选角头像

`performer-avatars.png` 是 3 列 2 行的方形像素头像图集，每格 96 × 96。以现有六张动作原画为人物参考，由 ImageGen 绘制头肩像，保留脸谱、服装、视线和代表道具。第一行依次为鬼手、双面、铃铛，第二行为夹层、替嗓、活扣。按钮按最近邻采样。原画单独用于半透明背景。

### 城门商行

内置 ImageGen 生成的原创场景，导出为 gate-market.jpg。游戏中的文字、可点击区域和成交提示均由界面实时叠加。

> Original premium pixel-art RPG shop background, full bleed 16:9 wide landscape, a single cohesive warm, intimate night-time medieval quartermaster's card shop carved inside the city gate of a dark garnet-and-brass joker army. Front-facing theatrical game stage wide shot, three evenly spaced unmistakable stations facing the viewer on one continuous worn walnut counter across middle: at x=19% open square-first-aid and provisioning chest with rolled ivory linen, vivid red potion bottles and small heart motif; x=50% charismatic tired adult whiteface jester merchant in burgundy cap, intriguing expression, behind a fan of ivory illustrated trading cards, tiny gold coins and velvet burgundy card display stand; x=81% an ink-stained scribe's illuminated open folio with a huge pale feather quill, ink bottle and indigo curtain. Three distinct golden pools of hanging lantern light, dark timber arches and shelves, crisp selective pixel clusters, deliberate highlights, inky black outlines, fine hand-authored pixel detailing at ~560x315 native resolution scaled up, sophisticated palette with deep aubergine shadows, antique brass and coral red. Counters at 63% height. Bottom 20% dark quiet wood, top 12% quiet rafters. Objects substantial, stations legible across the room; subtle heraldic diamond patterns. Cohesive original collectible card game art, grounded in a fortified town. Straight horizontal perspective. No text, no typography, no signage, no interface, no panels, no buttons, no modern equipment, no circus tents, no watermarks.

## 品质军装与兵器

使用内置 ImageGen 生成两张透明底图。游戏使用的军装和坐骑位于 `regalia.png`，武器位于 `armory.png`。角色按品质和职业合成，拖动沿用同一张精灵。

### 军装与坐骑

Production sprite sheet for Joker Legion, an original dark playing-card fantasy tactics game. One wide landscape transparent PNG organized in EXACTLY FOUR equal columns and TWO equal rows, eight separate evenly spaced sprites. No outlines around cells, no labels, letters, numbers, border, scenery, ground shadows or external particles. Top row four ordinary-to-elite soldiers, bottom row three champion soldiers and one empty riderless horse in final cell. ONE single isolated intact full character per cell, entirely in bounds with generous empty margin, boots on a common baseline inside each cell, consistent anatomy and scale. Crisp painstaking SNES / 32-bit strategy RPG pixel art, strong dark plum outer pixels, tight clusters with material highlights, warm skin or ivory half-mask, adult male foot soldier facing right 3/4, clearly legible when reduced to 54 pixels high. Seven versions of SAME jester legion foot soldier, lively grounded stance; both EMPTY hands, one curled hand extended forward to receive a separate weapon. No weapons, floating objects or shields. Make tier progression immediately readable from silhouette and tailoring, not just recoloring. Top left 1 plain charcoal linen hood, cropped undyed tabard, leather belt, undecorated boots. Top second 2 green split cap, short jade shoulder cape, bronze clasp. Top third 3 sapphire asymmetric cavalier cap with a single pale feather, embroidered blue diagonal sash, light silver shoulderplate. Top last 4 amethyst bicorne jester hood, split purple cape, two silver pauldrons, silver diamond embroidery. Bottom left 5 legendary ruby-and-gold royal knight-jester, three-point gilt crown, deep carmine ermine-trimmed full mantle, gold breastplate. Bottom second 6 mythic moonlit sovereign, tall crescent crown, wide teal-and-silver wing-shaped layered pauldrons, ivory panelled longcoat flowing back, sapphire gems. Bottom third 7 ultimate spectacular faceted prismatic glass regalia: luminous white-gold multi-spire diadem, pink-cyan-violet faceted crystal mantle, graduated gold filigree, layered coat tails, regal jewel silhouette; controlled restrained sparkles INSIDE its silhouette. Bottom right 8: single entire dark-bay warhorse in right-facing side profile with red leather saddle and saddlecloth, riderless, no rider, all four hooves visible. All eight designs equally spaced centered at 12.5%, 37.5%, 62.5%, 87.5% x in their half-row; each soldier has same centre of gravity and is full body with boots fully visible. Real alpha background throughout.

### 兵器

An original transparent pixel-art RPG armory sprite sheet. Strict 4 columns x 2 rows, one isolated side-view weapon per cell, 8 sprites total, no text, no hands or people, no pedestals or shadows, no borders, in a wide transparent landscape canvas. All weapons are distinct full silhouettes and have negative space within their cells. Stylized SNES strategy pixel art, strong dark plum pixel outlines, broad crisp highlight clusters that stay legible at 24px, gold/ivory/steel and tinted jewels. Top row from left to right: (1) curved single edged silver saber, grip at bottom-left, blade tip top-right; (2) a long elegant spear with red pennant, mostly vertical with tip at top right and wooden haft at lower left; (3) a tall golden healing crozier with a warm luminous heart crystal at its head, vertical staff; (4) a wooden recurved tall longbow facing right, vertical, clear drawn bowstring. Bottom row: (5) a deep indigo metal kite shield viewed from its face, silver rim, unmistakable pointed bottom, simple central ivory spade emblem; (6) vertical obsidian mage staff with a luminous flame-shaped ruby at the top; (7) a dark wooden hand crossbow with steel gold arms aimed diagonally up and right; (8) slim ornate two-edged straight silver rapier with a gold hilt, grip bottom-left, tip top-right. Align centers x at 12.5, 37.5, 62.5, 87.5% and row centers at 25 and 75%. Each weapon fills 75% of its cell height or width. Genuine transparent alpha.

## 2026-11-23 · 缀命皇后动作图集

文件 `queen-motion.png`。使用内置 ImageGen 生成透明原画，保存原始输出至项目素材目录。4×2 图集的八格依次是待机、左步、右步、挥剪蓄力、挥剪命中、王庭震荡、受击和收势。战场与敌军图鉴共用原图和固定脚底锚点。全部其他单位保留已有原画，以独立的头、躯干、手臂、腿部、披风、坐骑和装备关节动画驱动；没有将全部模型描述为逐帧重绘。

完整生成提示词

> Use case: stylized-concept. Production animation spritesheet for an original pixel-art tactical card RPG, truly transparent background. EXACT 4 columns by 2 rows of equal cells, eight FULL-BODY poses of the SAME female final boss, 'The Threadbound Queen'. No text, no labels, no grids, no shadows or scenery. Crisp detailed SNES / 32-bit RPG pixel clusters with dark plum outlines, highly legible at 90px high. Side view facing RIGHT, graceful sinister adult queen with ivory face, black-violet hair, an elaborate narrow tall gold crown bearing a bright violet spindle, purple silver plate armor over an ivory paneled gown, four long angular dark-violet cloak tails like puppet strings, silver-gold long scissors held in the right/front hand, left hand raised with a violet spindle. Full feet in every cell on a common baseline 90% down within each cell. Exactly identical proportions, scale, equipment, face and outfit across all 8 cells, centered at cell center with at least 10% clear padding. Row1 left to right: 1 neutral alert stance, scissors low; 2 WALK left foot forward right foot back, opposite arms; 3 WALK right foot forward left foot back, opposite arms; 4 ATTACK windup scissors raised high and left hand drawn in. Row2: 5 ATTACK follow-through sharp forward down scissors sweep, bending at hips; 6 SHOCKWAVE fully raised both hands, tall open crown silhouette, cloak spread; 7 HIT reaction shoulder twists back and knee bends; 8 recover stance scissors returning low. Show genuine distinct leg and arm postures, NOT whole body wobble or just recoloring. Each pose isolated; no magic particles beyond silhouette. Output wide landscape 4x2 atlas.
