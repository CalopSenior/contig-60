/** Página "Como jogar": conteúdo estático, em HTML. Os limites vêm de boards.ts para nunca ficarem desatualizados. */
export function helpHtml(limits: readonly number[]): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const sections: [string, string][] = [
    ['visao', 'Visão geral'], ['jogada', 'A jogada'], ['pontos', 'Pontuação'], ['vitoria', 'Como vencer'], ['cores', 'Cores dos números'],
    ['tabuleiros', 'Tabuleiros'], ['opcionais', 'Regras opcionais'], ['multi', 'Vários jogadores'], ['mesao', 'O Mesão'], ['registro', 'Registro de cálculo'], ['online', 'Jogar online'], ['dicas', 'Dicas'],
  ];
  return `
<div class="help-head"><button type="button" class="ghost" data-help-back>← Voltar</button><div><span class="eyebrow">GUIA COMPLETO</span><h1>Como jogar</h1></div></div>
<nav class="help-toc card" aria-label="Seções">${sections.map(([id, label]) => `<a href="#/ajuda" data-to="h-${id}">${label}</a>`).join('')}</nav>

<article class="card" id="h-visao"><h2>Visão geral</h2>
<p>No Contig 60 os jogadores rolam três dados e tentam formar, com contas de cabeça, o número de uma casa do tabuleiro. Cada casa conquistada vira sua. Quem completa uma linha (horizontal, vertical ou diagonal) vence, ou quem fizer o melhor placar quando a partida acabar.</p>
<p>O jogo não pede que você digite a conta: você <b>só toca na casa</b>. Se os dados conseguem formar aquele número, a casa é sua; se não, ela balança e você tenta outra.</p></article>

<article class="card" id="h-jogada"><h2>A jogada, passo a passo</h2>
<ol>
<li><b>Role os dados.</b> São três dados (cinco no Mesão com 5 dados).</li>
<li><b>Combine-os de cabeça</b> com <b>+ − × ÷</b> e parênteses, usando <b>cada dado exatamente uma vez</b>. Exemplo: com 2, 3 e 4, o 14 sai de (3 + 4) × 2; o 10 de 2 × 3 + 4. Divisões só valem se o resultado final for inteiro (frações intermediárias são permitidas).</li>
<li><b>Toque numa casa livre.</b> ✓ Aceita: a casa ganha a sua cor. × Recusada: a casa balança e você pode tentar outra, sem perder a vez.</li>
<li>Sem nenhuma casa possível, a vez passa sozinha. Você também pode usar <b>Passar a vez</b>.</li>
</ol>
<p class="hint">O jogo não mostra quais casas são possíveis: encontrá-las faz parte do desafio.</p></article>

<article class="card" id="h-pontos"><h2>Pontuação</h2>
<ul>
<li>Cada casa <b>ocupada ao redor</b> da que você conquista vale <b>1 ponto</b>, incluindo as diagonais e as peças de qualquer cor (até 8 pontos).</li>
<li>No <b>Contig 60</b> você começa com <b>60</b> e cada ponto é <b>subtraído</b>: quem tem o <b>menor</b> placar está na frente.</li>
<li>No <b>Clássico</b> você começa com <b>0</b>, os pontos são <b>somados</b> e vence o <b>maior</b> placar. Linhas não valem.</li>
<li>Roubar (veja “Vários jogadores”) <b>dobra</b> os pontos da jogada.</li>
</ul></article>

<article class="card" id="h-vitoria"><h2>Como vencer e como a partida termina</h2>
<ul>
<li><b>Linha</b> (só no Contig 60): 5 peças seguidas no tabuleiro 8×8, 4 no 6×6, 6 no 10×10 e 7 no 12×12. Vence na hora quem a completar.</li>
<li><b>A linha encolhe.</b> Para a partida nunca se arrastar, a linha exigida cai 1 peça ao chegar a 50% das rodadas e mais 1 aos 75% (mínimo de 3). Quem já tiver a linha menor vence.</li>
<li><b>Tabuleiro cheio</b> ou <b>fim das rodadas</b>: vence o melhor placar (menor no Contig 60, maior no Clássico). Placar igual é empate.</li>
<li>Uma <b>rodada</b> é um turno normal por jogador, mesmo que passe a vez.</li>
</ul></article>

<article class="card" id="h-cores"><h2>Cores dos números</h2>
<p>A cor de cada número no tabuleiro mostra <b>a chance de uma rolagem conseguir formá-lo</b>. Números pequenos saem quase sempre; os grandes dependem de dados altos e certeiros.</p>
<ul class="legend">
<li><span class="dot" data-tier="0"></span><b>Verde-água · muito comum</b><small>formável em ${pct(limits[0])} ou mais das rolagens</small></li>
<li><span class="dot" data-tier="1"></span><b>Azul · comum</b><small>de ${pct(limits[1])} a ${pct(limits[0])}</small></li>
<li><span class="dot" data-tier="2"></span><b>Violeta · médio</b><small>de ${pct(limits[2])} a ${pct(limits[1])}</small></li>
<li><span class="dot" data-tier="3"></span><b>Laranja · raro</b><small>de ${pct(limits[3])} a ${pct(limits[2])}</small></li>
<li><span class="dot" data-tier="4"></span><b>Rosa · raríssimo</b><small>menos de ${pct(limits[3])}</small></li>
</ul>
<p>As porcentagens são calculadas para a quantidade de dados da partida. Com 5 dados (e descarte de um), mais números ficam comuns. Casas já conquistadas ficam com a <b>cor do jogador</b>; a última jogada ganha um contorno branco e a linha vencedora brilha em dourado.</p></article>

<article class="card" id="h-tabuleiros"><h2>Tabuleiros</h2>
<ul>
<li><b>Oficial PUC</b>: 8×8, números de 0 a 180 em espiral, com cada anel crescente.</li>
<li><b>PUC embaralhado</b>: os mesmos 64 números, em lugares aleatórios.</li>
<li><b>Totalmente aleatório</b>: 64 números sorteados entre todos os possíveis (podem se repetir).</li>
<li><b>Equilibrado</b>: casas comuns e raras na mesma proporção.</li>
<li><b>Sorte grande</b>: muitos números fáceis; partidas rápidas.</li>
<li><b>Espiral invertida</b>: o PUC de ponta-cabeça, com os gigantes nas bordas.</li>
<li><b>Rápido 6×6</b>: 36 casas e linha de 4.</li>
<li><b>Desafio do dia</b>: um PUC embaralhado igual para todo mundo na mesma data.</li>
<li><b>Mesões</b> (10×10 e 12×12): grandes, para mesas cheias; veja o capítulo do Mesão.</li>
</ul>
<p>Nos tabuleiros sorteados, toque de novo no cartão selecionado para sortear outro antes de começar.</p></article>

<article class="card" id="h-opcionais"><h2>Regras opcionais</h2>
<ul>
<li><b>Modo</b>: Contig 60 (menor placar, linhas valem) ou Clássico (maior placar, só pontos).</li>
<li><b>Duração</b>: Curta (10 rodadas), Normal (20), Longa (35) ou Sem limite. Sem limite, a partida só acaba com linha ou tabuleiro cheio, e a linha não encolhe.</li>
<li><b>Blitz</b>: depois de rolar, você tem 30 segundos para escolher a casa (45 s com 5 dados). Estourou o tempo, a vez é passada.</li>
<li><b>Penalidade ao estourar</b>: o estouro do tempo piora seu placar em 5 pontos (+5 no Contig 60, −5 no Clássico). Só faz sentido com a Blitz.</li>
</ul>
<p class="hint">Na partida online as regras são escolhidas pelo anfitrião e valem para todos.</p></article>

<article class="card" id="h-multi"><h2>Como as regras mudam com vários jogadores</h2>
<div class="compare">
<div><h3>2 jogadores</h3><ul><li>Os dois se alternam; um sempre é o “próximo”.</li><li>Se você passa, o adversário pode <b>roubar</b> a sua rolagem.</li><li>Rodada = um turno de cada.</li></ul></div>
<div><h3>3 e 4 jogadores</h3><ul><li>A ordem é sorteada no início e fica fixa.</li><li><b>Só o próximo na ordem pode roubar</b>, e o roubo vale o dobro. Depois do roubo ele joga o turno normal dele, com nova rolagem.</li><li>A rodada passa a ter 3 ou 4 turnos: o limite de rodadas dura mais e a linha encolhe mais devagar.</li><li>Com mais peças no tabuleiro, os pontos por vizinhança sobem mais rápido.</li></ul></div>
<div><h3>Mesão (3 ou mais)</h3><ul><li>Vários jogadores têm a <b>iniciativa ao mesmo tempo</b>, cada um com os próprios dados.</li><li><b>Não há roubo.</b></li><li>Ao terminar, o jogador vai para o fim da fila e o próximo da fila ganha a iniciativa na hora.</li><li>Tabuleiros maiores e linhas de 6 ou 7.</li></ul></div>
</div></article>

<article class="card" id="h-mesao"><h2>O Mesão</h2>
<p>O Mesão é o modo para grupos grandes: o jogo não impõe limite de jogadores (o que limita é a conexão do anfitrião e a paciência da mesa) e a partida anda rápido porque várias pessoas jogam <b>ao mesmo tempo</b>.</p>
<h3>Iniciativas</h3>
<p>Algumas pessoas, as <b>iniciativas</b>, jogam ao mesmo tempo: <b>3</b> até 10 jogadores e <b>5</b> acima disso (você também pode fixar 3 ou 5). Cada jogador ativo rola os próprios dados e escolhe a casa dele. Quando a jogada termina (conquistando uma casa, passando ou estourando o tempo), a iniciativa passa individualmente ao primeiro da fila, sem esperar os outros. Exemplo: numa mesa de 8, três jogam juntos, e cada vez que um termina o próximo da fila entra no lugar dele. Se duas pessoas tentarem a mesma casa quase juntas, a primeira a chegar ao anfitrião fica com ela; a outra tenta outra casa.</p>
<h3>Duas variantes</h3>
<ul>
<li><b>5 dados, descarte um</b>: você rola cinco dados, <b>descarta um à sua escolha</b> e combina os outros quatro (cada um uma vez). Os números chegam a 1296 e o tabuleiro tem 100 ou 144 casas. Na Blitz há 45 segundos.</li>
<li><b>3 dados, números repetidos</b>: a regra normal, mas num tabuleiro grande onde o mesmo número aparece várias vezes.</li>
</ul>
<h3>Outras diferenças</h3>
<ul><li>Cada pessoa vê os dados dos jogadores ativos. Quem está na fila vê a posição dela.</li><li>Se alguém sai da sala no meio, o anfitrião passa as vezes dele automaticamente.</li><li>No mesmo dispositivo (até 12 pessoas), toque no jogador ativo para jogar por ele.</li></ul></article>

<article class="card" id="h-registro"><h2>Registro de cálculo</h2>
<p>Durante a partida <b>nenhuma conta é mostrada</b>: nem as suas nem as dos outros. Ao final, a tela de resultado traz o <b>registro completo</b>, jogada a jogada:</p>
<ul>
<li>quem jogou, a casa conquistada e quantos pontos rendeu (e se foi roubo);</li>
<li>os dados daquela rolagem;</li>
<li><b>todas as expressões</b> que formam o número, por exemplo <code>((3 + 4) * 2) = 14</code>. Com 4 ou 5 dados são mostradas as 40 primeiras, e, no caso de 5 dados, qual dado ficou de fora.</li>
</ul>
<p><b>Exportar histórico</b> baixa um arquivo JSON com todos os eventos. Cada evento carrega o resumo criptográfico (SHA-256) do anterior, o que permite reconferir que ninguém alterou a partida. É um detector de divergência, não um sistema contra trapaça: os dados são sorteados no dispositivo de quem joga.</p></article>

<article class="card" id="h-online"><h2>Jogar online</h2>
<ol>
<li>O anfitrião escolhe <b>Criar sala online</b>, o estilo e o tabuleiro, e recebe um <b>código de 5 caracteres</b> (e um link, quando o jogo está num endereço público).</li>
<li>Os outros escolhem <b>Entrar em sala</b>, digitam o código ou abrem o link e ficam na lista de jogadores.</li>
<li>O anfitrião inicia quando todos estiverem presentes. No Mesão ele pode começar com 3 ou mais, a qualquer momento antes do início; depois de começar, ninguém mais entra.</li>
</ol>
<p>Os dispositivos conversam diretamente (WebRTC); um servidor público gratuito só apresenta os jogadores ao anfitrião. Precisa de internet. Se o anfitrião sair, a partida acaba. Quem sai no meio perde as vezes automaticamente; não há reconexão.</p></article>

<article class="card" id="h-dicas"><h2>Dicas</h2>
<ul>
<li>Memorize o 0 (dois dados iguais: (a − a) × b), e o 1, o 2 e o 3, que quase sempre saem.</li>
<li>Pense em produtos e somas ao mesmo tempo: com 4, 5 e 6, o 120 é 4 × 5 × 6 e o 26 é 4 × 5 + 6.</li>
<li>Ocupar casas rodeadas por outras vale muitos pontos no Clássico; no Contig 60, formar linha e evitar vizinhos importa mais.</li>
<li>Bloqueie linhas do adversário ocupando a casa que falta, se você achar que consegue formá-la.</li>
</ul>
<div class="buttons"><button type="button" class="primary" data-help-back>Entendi, vamos jogar</button></div></article>`;
}
