# Contig 60

Jogo mobile-first em TypeScript, sem banco de dados ou backend remoto. Node.js 22+.

```sh
npm ci
npm test
npm run build
npm run dev
```

O Vite é o servidor local. Abra a aplicação em localhost (contexto seguro). Para acesso por outro dispositivo use hospedagem HTTPS; HTTP em endereço LAN não fornece todas as APIs criptográficas necessárias. Cada participante pode executar sua própria cópia local.

## Créditos

O botão **Créditos** abre `#/creditos` com Equipe, Orientação, Apoio e Sobre. São oito integrantes, dois retratos de supervisão/coordenação, IFRJ, FEVRE, PIBID e agradecimentos. As ilustrações seguem as formas arredondadas e a paleta do Contig 60. Referências e prompt estão em `src/assets/credits/PROMPT.md`.

As abas aceitam clique, toque, setas esquerda/direita e Home/End. Escape e os botões Voltar retornam à tela anterior, preservando formulário, partida, foco e posição de rolagem. Os créditos, como a ajuda, não pausam o cronômetro de uma partida em andamento.

## Tabuleiros

Na tela inicial o jogador escolhe o tabuleiro (`src/boards.ts`). Os sorteados são gerados na hora e podem ser sorteados de novo tocando no cartão selecionado. Cada número é colorido pela chance de aparecer nos dados (verde = comum, rosa = raro).

| Tabuleiro | Descrição |
| --- | --- |
| Oficial PUC | 8×8 em espiral, de 0 a 180, linha de 5 |
| PUC embaralhado | os mesmos 64 números em posições aleatórias |
| Totalmente aleatório | 64 números sorteados entre todos os que os dados formam (podem repetir) |
| Equilibrado | casas comuns e raras na mesma proporção |
| Sorte grande | pesos favorecem os números fáceis: partidas rápidas |
| Espiral invertida | o PUC de ponta-cabeça (gigantes nas bordas) |
| Rápido 6×6 | 36 casas, linha de 4 |
| Desafio do dia | PUC embaralhado com semente da data: igual para todos no mesmo dia |

O tabuleiro escolhido vai dentro da configuração e cada participante o valida (`sanitizeConfig`): tamanho, linha e apenas valores que três dados conseguem formar.

## Mesão

Modo para mesas grandes (`Config.table`), sem limite de jogadores nas regras (recomendado 3 ou mais; o limite prático é a conexão do anfitrião, e a configuração recebida da rede é recusada acima de 1000 jogadores só por segurança). Várias pessoas, as **iniciativas**, jogam ao mesmo tempo, cada uma com os próprios dados; ao terminar sua jogada (casa conquistada, passe ou estouro de tempo) o jogador vai para o fim da fila e o primeiro da fila ganha a iniciativa na hora. Iniciativas: automático (3 até 10 jogadores, 5 acima), ou fixo em 3 ou 5. Não há roubo.

Duas variantes, escolhidas ao criar a sala:

- **5 dados, descarte um**: rola 5 dados e combina 4 deles (qualquer um pode ser descartado). Tabuleiros 10×10 (linha de 6) e 12×12 (linha de 7), com valores de 0 a 1296. Blitz de 45 s.
- **3 dados, números repetidos**: regra normal em tabuleiros grandes onde os números se repetem.

`src/solver.ts` calcula os valores atingíveis com racionais, sem gerar texto (`reachableValues`), e só gera as contas da casa escolhida (`expressionsFor`; no máximo 40 com 4 ou 5 dados). A probabilidade usada nas cores (`coverage` em `src/boards.ts`) considera o número de dados.

A partida termina como nas demais: linha (que encolhe com as rodadas), tabuleiro cheio ou fim das rodadas (uma rodada = tantas jogadas finalizadas quanto jogadores). No mesmo dispositivo (até 12 jogadores) toca-se no jogador ativo para jogar por ele.

## Como a partida termina

Antes uma linha de cinco podia nunca sair e a partida se arrastava indefinidamente. Agora:

- **Rodadas**: Curta (10), Normal (20, padrão), Longa (35) ou Sem limite. Vale para os dois modos. Ao fim das rodadas vence o melhor placar.
- **Linha que encolhe** (Contig 60): a linha exigida cai 1 ao chegar a 50% das rodadas e mais 1 aos 75% (mínimo 3). Quem já tiver a linha menor vence na próxima verificação.
- **Passe automático**: se nenhuma casa livre pode ser formada com os dados (jogada ou roubo), a vez passa sozinha após uma breve mensagem.
- Também termina com o tabuleiro cheio.

## Online

Uma partida online precisa só de um código:

1. O anfitrião escolhe "Criar sala online", o estilo, o tabuleiro e as regras, e recebe um código de 5 caracteres (e um link, quando o jogo está hospedado num endereço público).
2. Os outros escolhem "Entrar em sala" e digitam o código, ou abrem o link. O anfitrião define o assento de cada um (P2, P3, ...).
3. O anfitrião inicia a partida. No modo normal, quando todos os assentos estão ocupados; no Mesão, com 3 ou mais jogadores, e depois do início ninguém mais entra.

A topologia é em estrela: todos se conectam só ao anfitrião (P1), que atribui os assentos, **põe as jogadas em ordem** e as repassa a todos. Isso permite jogadas simultâneas do Mesão e dispensa uma conexão entre cada par (com 30 jogadores seriam 435). Os convidados enviam propostas (`PROPOSE`); o anfitrião as valida com o mesmo reducer, numera, calcula o hash encadeado e transmite o evento. Cada convidado reexecuta o evento e confere o hash. O anfitrião é, portanto, árbitro de ordem e de relógio, o que é registrado como limitação. Se uma proposta perde uma disputa (ex.: duas pessoas na mesma casa), recebe `REJECT`.

Um corretor público (PeerJS Cloud, `0.peerjs.com`) apenas apresenta os dispositivos ao anfitrião e fornece STUN/TURN. As jogadas trafegam por WebRTC DataChannel criptografado. Precisa de internet e de acesso a `0.peerjs.com`; sem isso só funciona o modo "neste dispositivo". Quem sai no meio da partida é coberto pelo anfitrião: as vezes dele são puladas automaticamente (`SKIP`/`PASS`). Não há reconexão. Se o anfitrião sair, a partida termina.

O link de convite só aparece quando o jogo é aberto por um endereço público; no EXE (localhost) e no APK compartilha-se apenas o código.

## Estado e integridade

`src/game.ts` implementa o estado e um reducer determinístico; `src/room.ts` implementa a sala em estrela e o transporte (PeerJS/WebRTC); `src/help.ts`, a página de ajuda; `src/boards.ts`, os tabuleiros; `src/main.ts` coordena interface, autoridade do turno e histórico. A autoridade lógica muda com `currentTurn`, sem renegociar a conexão WebRTC. Ambos mantêm uma cópia do estado. Cada ação leva sessão, sequência, ator, timestamp e hash anterior; o receptor reexecuta a ação e compara o SHA-256 do evento e do estado resultante. Pacotes inválidos pausam a partida. Não se aceita sobrescrita arbitrária do estado pelo adversário.

O histórico pode ser exportado em JSON. Desconexão pausa as ações online; não há retomada automática após recarregar. Hashes detectam divergência, não constituem anticheat: sorteio, dados e relógio dependem da honestidade dos clientes. Não há commit-reveal nem árbitro confiável. Os relógios devem estar sincronizados (tolerância de transporte de dois minutos).

A jogada é feita clicando diretamente na casa. O solver enumera as permutações dos três dados, as quatro operações e os dois agrupamentos binários, usando aritmética racional para decidir quais valores são possíveis. Não usa eval. Cada peer recalcula as soluções e valida a casa recebida. As expressões de cada colocação são registradas no estado, mas só são exibidas na tela de resultado. O parser AST é mantido para verificação independente nos testes.

## Decisões de regras

- Contig começa em 60; a linha exigida (5 no 8×8, 4 no 6×6, 6 no 10×10, 7 no 12×12, encolhendo com as rodadas) vence; tabuleiro cheio ou fim das rodadas decide pelo menor score. Chegar a zero sozinho não encerra o jogo.
- Clássico começa em zero; soma pontos, ignora linhas, termina após N rodadas ou tabuleiro cheio.
- Uma rodada contém um turno normal por participante, incluindo passes. A última oportunidade de roubo é concluída antes de avaliar o limite de rodadas.
- Somente o próximo jogador na ordem pode roubar. Roubo dobra pontos e é seguido pelo turno normal do ladrão, com botão de rolagem.
- Blitz limita apenas INPUT_MATH a 30 segundos. Roubo não tem limite.
- Penalidade opcional piora a pontuação: +5 no Contig, −5 no clássico.
- Scores iguais ao encerrar resultam em empate.

Testes cobrem parser, uso exato dos dados, adjacência, turno, roubo, timer, penalidade, linhas, tabuleiro cheio e limite de rodadas.

A sala em `src/room.ts` gerencia a malha completa de pares e identifica o remetente pela ligação (o ID do par é `contig60-CODIGO-N`), sem confiar apenas no ator declarado no pacote. O turno e o histórico permanecem replicados em todos os participantes.

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

O servidor escuta somente neste computador (localhost), em porta livre por padrão. Mantenha o terminal aberto e pressione Ctrl+C para encerrar. Para jogar online, cada participante executa o launcher no próprio computador; um cria a sala e passa o código de 5 caracteres aos outros (seção Online). O download requer acesso ao repositório público; repositórios privados exigem um checkout autenticado com `web/` disponível.

`web/` contém o build estático versionado para permitir o launcher sem ferramentas JavaScript. Após alterar o TypeScript, execute `npm run build` e inclua os arquivos atualizados de `web/` no commit.

## Executável Windows e distribuição no PIBID

Em `downloads/`:

- `Contig60.exe`: Windows 10/11 x64 (Intel/AMD).
- `Contig60-arm64.exe`: Windows 10/11 ARM64.
- Arquivos `.sha256`: checksums dos executáveis.

O EXE contém o jogo compilado e o servidor local. Não requer Python, Node.js, Java, Go, instalação ou privilégios de administrador. Basta dar dois cliques. O navegador padrão abre automaticamente; mantenha a janela do servidor aberta enquanto joga. Feche-a ou pressione Ctrl+C para encerrar. O modo local funciona offline. Cada jogador online abre sua própria cópia; WebRTC ainda depende da rede. Os executáveis não têm assinatura Authenticode: o Windows pode mostrar um aviso de editor desconhecido. Não desative as proteções do sistema; para distribuição institucional sem esse aviso, é necessário assinar com certificado da instituição.

Para publicar no site do PIBID, hospede o EXE por HTTPS com acesso público, sem página de login. O botão de download pode apontar diretamente para esse arquivo. Não é necessário publicar o código-fonte ou instalar um backend no site.

### Linux

Em `downloads/`: `Contig60-linux-amd64.tar.gz` (Intel/AMD) e `Contig60-linux-arm64.tar.gz` (ARM, ex.: Raspberry Pi 64 bits). Cada um contém o executável `contig60`, sem dependências (binário estático, sem glibc específica):

```sh
tar -xzf Contig60-linux-amd64.tar.gz
./contig60
```

Abre o navegador padrão com `xdg-open` (se não houver, copie o endereço mostrado no terminal). Use `./contig60 -no-browser -port 8080` para escolher a porta. Os arquivos `.sha256` conferem a integridade (`sha256sum -c`). O tar.gz preserva a permissão de execução, que se perderia num download direto do binário.

### Comando único no CMD

O comando usa **Windows PowerShell 5.1**, que já acompanha o Windows 10/11, e um navegador instalado. Nenhuma instalação de runtime é necessária. Ele baixa o EXE para `%LOCALAPPDATA%\Contig60`, valida um SHA-256 fixo antes de executar e abre o jogo. Precisa de internet para o primeiro download; o EXE baixado pode ser executado depois sem download.

O comando pronto para baixar pelo GitHub está em [`downloads/iniciar-cmd.txt`](downloads/iniciar-cmd.txt). Use o botão Raw e copie a linha inteira para o CMD. O link de download direto é https://raw.githubusercontent.com/CalopSenior/contig-60/main/downloads/Contig60.exe . Para funcionar sem login, este repositório precisa estar público. Se estiver privado, baixe o EXE pela interface autenticada do GitHub; o comando anônimo não terá acesso.

Quando houver um domínio do PIBID, o mantenedor pode gerar a linha com a nova URL (esta etapa de preparação não é feita pelo jogador):

```sh
python desktop/comando.py https://SEU-DOMINIO/caminho/Contig60.exe
```

O comando pronto é salvo em `downloads/iniciar-cmd.txt`. Copie o conteúdo desse arquivo para a página do PIBID. O jogador cola a linha no CMD e pressiona Enter. Gere novamente a linha ao publicar uma nova versão: o hash é específico do arquivo distribuído. Esse método não executa scripts baixados nem altera a política de execução do PowerShell. Em máquinas onde a instituição bloqueia PowerShell ou execução de programas, é necessária a liberação pelo administrador.

### Compilar o launcher (somente desenvolvedores)

O jogo continua em TypeScript; o launcher nativo em `desktop/` usa apenas a biblioteca padrão de Go. Para atualizar os executáveis, instale Node.js, Python 3.10+ e Go 1.24+ no computador de desenvolvimento e execute:

```sh
npm ci
python desktop/build.py
```

O script recompila o jogo, incorpora `web/`, testa o servidor e compila os dois EXEs do Windows e os dois pacotes Linux, todos estáticos. `CONTIG_GO` pode selecionar o compilador. A workflow `Validate Windows launcher` verifica o checksum e inicia o EXE x64 em um runner Windows. A compilação cruzada e os testes em Linux não substituem essa validação em Windows.

## Android (APK)

Baixe [`downloads/Contig60.apk`](https://raw.githubusercontent.com/CalopSenior/contig-60/main/downloads/Contig60.apk) no celular e abra o arquivo para instalar. Requer Android 8.0 ou superior e Android System WebView atualizado. O Android pode solicitar autorização para instalar aplicativos dessa origem. Não é necessário instalar Python, Node.js ou um servidor.

O APK inclui o jogo e roda dentro do WebView, com uma origem HTTPS local interceptada para fornecer os arquivos incorporados. O modo local funciona offline; o modo online usa o código de sala (seção Online), para 2 a 4 participantes. O WebView deste APK bloqueia requisições HTTP a outros hosts; o corretor PeerJS usa WebSocket e WebRTC, que não passam por esse filtro, mas isso ainda precisa ser confirmado num aparelho. Não são solicitadas permissões de câmera, microfone ou armazenamento; a única permissão é INTERNET. Rotação da tela preserva a instância atual. Fechar o aplicativo ou o sistema encerrar seu processo perde a partida; retomada automática não foi implementada.

Esta primeira versão foi compilada e teve assinatura, estrutura e arquivos incorporados verificados. Ainda precisa de teste em aparelho Android para confirmar interface, WebRTC e exportação do histórico. A exportação por download de Blob usada na versão web não tem integração nativa com o armazenamento Android nesta versão.

### Reproduzir o APK

A camada de jogo permanece em TypeScript; `android/src/` contém somente a Activity Java de integração com o Android. Após `npm run build`, configure as variáveis abaixo e execute `python android/build.py`:

- `ANDROID_JAR`: caminho de `platforms/android-35/android.jar`.
- `ANDROID_BUILD_TOOLS`: pasta de Build Tools 35.0.0, com aapt2, d8, zipalign e apksigner.
- `CONTIG_KEYSTORE`: arquivo PKCS12/JKS da chave de assinatura, alias `contig60`.
- `CONTIG_STOREPASS_FILE`: arquivo privado com a senha do keystore.
- JDK com javac; alternativamente `CONTIG_ECJ` aponta para o compilador Eclipse ECJ 3.40.0 verificado, executado com Java.

A chave atual foi criada em `~/.contig60-signing/contig60.p12` (senha em `storepass.txt`, na mesma pasta); a chave da primeira versão do APK se perdeu, então **quem instalou o APK antigo precisa desinstalá-lo antes de instalar este**. Ambos estão fora do Git e não devem ser publicados. Faça backup privado desses arquivos para assinar futuras atualizações; sem a mesma chave, o Android exige desinstalar a versão anterior. A assinatura é própria, para distribuição direta de APK, sem publicação na Play Store.


## Fluxo de jogo e telas (versão 2.0)

- `#/ajuda`: guia completo (jogada, pontuação, cores, tabuleiros, regras opcionais, vários jogadores, Mesão, registro de cálculo, online).
- `#/menu`: modo (neste dispositivo, criar sala, entrar em sala), estilo (normal ou Mesão), regras, tabuleiro e nomes. `#/entrar/CODIGO` abre já na entrada de sala.
- `#/sala`: código, link, lista de jogadores e regras da sala.
- `#/partida`: placar, rodada, linha exigida, dados e tabuleiro. No celular tudo cabe numa tela.
- `#/resultado`: placares finais, como terminou e todas as expressões de cada casa conquistada.

Um clique válido ocupa a casa (✓); um inválido balança (×) sem alterar a vez. As casas válidas não são reveladas antecipadamente, e as contas só aparecem no resultado. Os nomes têm até 24 caracteres. Todos os participantes online devem usar a mesma versão: o protocolo mudou (sala por código, tabuleiro na configuração).

Os EXEs, o APK e o comando de download precisam ser regerados para incluir esta versão (veja as seções acima). O APK e o EXE já publicados continuam com a versão anterior até lá.
