# Retratos dos créditos do Contig 60

Gerados com a ferramenta integrada `image_gen`. Atlas com cinco colunas e duas linhas: Daniela, Denise, Fernanda, Gabriel, Luiz Gustavo; Marília, Thiago, Vitoria Naomi, Aline e Isabella. Cada célula é exibida como um quadrado, sem esticar o retrato.

Referências consultadas: chats “Ver chats de outros projetos” (Calc Boy 3000), “Ajustar fases e imagens dos créditos” (Invasão de Numéria) e “Implementar renderização procedural…” (M.M.C.). Os sete retratos das fotografias vêm dos três cartões enviados no chat do Calc Boy. Gabriel e Luiz usam como referência o atlas daquele jogo; Marília usa a fotografia frontal do chat de M.M.C. O nome de Daniela segue o cartão fotográfico e o Calc Boy, que diferem dos nomes escritos em M.M.C. e Numéria.

Os apoiadores são símbolos SVG estilizados no próprio `src/credits.ts`, com formas arredondadas e a paleta do Contig. Os nomes institucionais permanecem em texto HTML.

## Prompt final

Use case: stylized-concept / style-transfer.
Asset: final portrait atlas for the educational board game Contig 60.
Create EXACTLY TEN distinct head-and-shoulders portraits in a strict FIVE COLUMNS by TWO ROWS grid. Output aspect ratio 5:2 (e.g. 2560x1024). Every equal SQUARE cell contains exactly ONE person at the same head scale, completely inside the cell, head top with at least 6% padding, shoulders at lower edge. Straight frontal camera. No text, no labels, no lines, no frames, no gutters. Each cell solid uniform navy #161f3d.
STYLE: clean friendly contemporary board-game illustrations, smooth rounded silhouettes and simplified recognizable faces, matte flat colors with very soft minimal shading. Rounded geometric shapes like the game's rounded dice and colored counters. A small tasteful purple/teal rim accent harmonizes with navy UI #0b1020, lavender #7c8cff, gold #ffcf5a, teal #5eead4. Restrained stylization, natural facial proportions, distinctive hairstyles and glasses, consistent clean face detail across all ten. NOT voxel, NOT pixel art, NOT realistic photos or painted fantasy. No costumes, calculators, dice or decorative props. Keep actual outfits and skin/hair/glasses from references, warm approachable expressions.
References 1, 2, 3 are authoritative real photo panels. Reference 4 is an earlier atlas ONLY for identifying Gabriel and Luiz (top row cells4,5); do NOT copy its blocky/voxel rendering. Reference 5 is the real Marilia photo and overrides her old atlas face/hair.
Cell order top row left to right:
1 Daniela, ref2 left: light-medium warm skin, full rounded oval face, long dark brown curly hair, olive open shirt over dark top, broad natural smile.
2 Denise, ref2 center: fair warm skin, very short side-swept dark brown hair, black t-shirt, friendly smile; preserve short hairstyle, no added lipstick.
3 Fernanda, ref2 right: dark warm brown skin, long dark braids, delicate round glasses, navy sleeveless top, gold earrings, bright smile.
4 Gabriel, ref4 top row fourth: medium warm skin, brown curly hair, dark rectangular glasses, small mustache/goatee, gray tank top.
5 Luiz Gustavo, ref4 top row fifth: medium warm brown skin, very short dark buzz hair, short dark beard, charcoal tee.
Bottom row:
6 Marilia, ref5: warm light-medium skin, full softly rounded oval face, near-black long center-parted gently wavy hair, real relaxed almond eyes, fuller lips and naturally broader rounded nose base, subtle CLOSED-MOUTH smile. Green square-neck top and small pearl necklace from prior reference. Preserve likeness and natural face volume, no fantasy goggles/costume.
7 Thiago, ref3 left: fair warm skin, short dark high quiff, short dark beard, white tee with red collar and black outer layer, restrained expression.
8 Vitoria Naomi, ref3 right: light-medium warm skin, straight short black bob, olive cardigan over cream top, warm closed-mouth smile.
9 Aline, ref1 right: fair warm skin, long blonde highlighted hair with dark roots, magenta/red rectangular glasses, black blouse, colorful small beaded necklace and earrings, broad smile.
10 Isabella, ref1 left: fair warm skin, shoulder-length wavy silver-gray hair, burgundy rectangular glasses, dark jacket over patterned top, red lips, broad smile, mature natural face.
Keep everyone distinct, no duplicate or blended faces. Exactly ten people, no additional faces. Names will be HTML outside image.
