# Contig 60

Jogo mobile-first em TypeScript, sem banco de dados ou backend remoto. Node.js 22+.

```sh
npm ci
npm test
npm run build
npm run dev
```

O Vite é o servidor local. Abra a aplicação em localhost (contexto seguro). Para acesso por outro dispositivo use hospedagem HTTPS; HTTP em endereço LAN não fornece todas as APIs criptográficas necessárias. Cada participante pode executar sua própria cópia local.

## Online

Abra Configurações da partida para ativar a versão expandida e escolher 2, 3 ou 4 jogadores. A opção vem desativada; Blitz e penalidade também. As regras são fixadas ao criar a sala.

P1 cria a sala e gera uma oferta para cada convidado usando o seletor de destinatário. O convidado seleciona Entrar com convite e processa a oferta: sua identidade e regras vêm do convite de P1. Devolve a resposta para P1 processar. Depois os convidados conectam os pares restantes pelo mesmo fluxo Gerar oferta / Processar código: P2–P3, P2–P4 e P3–P4 quando há quatro jogadores. Cada par é criado somente uma vez. São 1, 3 ou 6 conexões para 2, 3 ou 4 jogadores.

Após todos os pares e os avisos de prontidão chegarem, P1 pode clicar em Iniciar partida. A ordem inteira é embaralhada uma vez e preservada. P1 continua sendo a identidade do criador, mesmo quando não começa. A desconexão de um par sinaliza pausa aos demais. Recarregue todas as sessões para criar outra sala se a sinalização falhar; reconexão automática não está implementada.

A conexão usa WebRTC DataChannel ordenado e criptografado. STUN: `stun.l.google.com:19302`. Não há servidor de sinalização obrigatório. Alguns NATs/firewalls exigem TURN: esta versão não configura relay e não garante conexão entre todas as redes. O backend local não recebe jogadas.

## Estado e integridade

`src/game.ts` implementa o estado e um reducer determinístico; `src/peer.ts` implementa o transporte; `src/main.ts` coordena interface, autoridade do turno e histórico. A autoridade lógica muda com `currentTurn`, sem renegociar a conexão WebRTC. Ambos mantêm uma cópia do estado. Cada ação leva sessão, sequência, ator, timestamp e hash anterior; o receptor reexecuta a ação e compara o SHA-256 do evento e do estado resultante. Pacotes inválidos pausam a partida. Não se aceita sobrescrita arbitrária do estado pelo adversário.

O histórico pode ser exportado em JSON. Desconexão pausa as ações online; não há retomada automática após recarregar. Hashes detectam divergência, não constituem anticheat: sorteio, dados e relógio dependem da honestidade dos clientes. Não há commit-reveal nem árbitro confiável. Os relógios devem estar sincronizados (tolerância de transporte de dois minutos).

O parser gera uma AST restrita a inteiros de um dígito, quatro operações binárias e parênteses. Não usa eval. Resultado comparado estritamente, conforme as regras solicitadas.

## Decisões de regras

- Contig começa em 60; cinco em linha vence; tabuleiro cheio decide pelo menor score. Chegar a zero sozinho não encerra o jogo.
- Clássico começa em zero; soma pontos, ignora cinco em linha, termina após N rodadas ou tabuleiro cheio.
- Uma rodada contém um turno normal por participante, incluindo passes. A última oportunidade de roubo é concluída antes de avaliar o limite de rodadas.
- Somente o próximo jogador na ordem pode roubar. Roubo dobra pontos e é seguido pelo turno normal do ladrão, com botão de rolagem.
- Blitz limita apenas INPUT_MATH a 30 segundos. Roubo não tem limite.
- Penalidade opcional piora a pontuação: +5 no Contig, −5 no clássico.
- Scores iguais ao encerrar resultam em empate.

Testes cobrem parser, uso exato dos dados, adjacência, turno, roubo, timer, penalidade, linhas, tabuleiro cheio e limite de rodadas.

A sala em `src/room.ts` gerencia a malha completa de pares e identifica o remetente pelo canal, sem confiar apenas no ator declarado no pacote. O turno e o histórico permanecem replicados em todos os participantes.

## Jogar somente com Python (sem Node.js)

Baixe [jogar.py](https://raw.githubusercontent.com/CalopSenior/contig-60/main/jogar.py) e execute com Python 3.10 ou superior:

```sh
python jogar.py
```

No Windows também pode usar `py jogar.py`. Se o arquivo estiver sozinho, ele baixa a versão `main` do GitHub e abre o jogo no navegador. Com o repositório completo, usa os arquivos compilados de `web/` e funciona offline para partidas locais. Não precisa instalar pacotes Python, Git ou Node.js.

```sh
python jogar.py --github          # força baixar a versão publicada
python jogar.py --ref main        # permite também uma tag ou SHA
python jogar.py --port 8080 --no-browser
```

O servidor escuta somente neste computador (localhost), em porta livre por padrão. Mantenha o terminal aberto e pressione Ctrl+C para encerrar. Para jogar online, cada participante executa o launcher no próprio computador e troca os códigos de conexão. Continuam valendo as limitações WebRTC/STUN/TURN descritas acima. O download requer acesso ao repositório público; repositórios privados exigem um checkout autenticado com `web/` disponível.

`web/` contém o build estático versionado para permitir o launcher sem ferramentas JavaScript. Após alterar o TypeScript, execute `npm run build` e inclua os arquivos atualizados de `web/` no commit.
