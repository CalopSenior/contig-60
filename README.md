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

## Executável Windows e distribuição no PIBID

Em `downloads/`:

- `Contig60.exe`: Windows 10/11 x64 (Intel/AMD).
- `Contig60-arm64.exe`: Windows 10/11 ARM64.
- Arquivos `.sha256`: checksums dos executáveis.

O EXE contém o jogo compilado e o servidor local. Não requer Python, Node.js, Java, Go, instalação ou privilégios de administrador. Basta dar dois cliques. O navegador padrão abre automaticamente; mantenha a janela do servidor aberta enquanto joga. Feche-a ou pressione Ctrl+C para encerrar. O modo local funciona offline. Cada jogador online abre sua própria cópia; WebRTC ainda depende da rede. Os executáveis não têm assinatura Authenticode: o Windows pode mostrar um aviso de editor desconhecido. Não desative as proteções do sistema; para distribuição institucional sem esse aviso, é necessário assinar com certificado da instituição.

Para publicar no site do PIBID, hospede o EXE por HTTPS com acesso público, sem página de login. O botão de download pode apontar diretamente para esse arquivo. Não é necessário publicar o código-fonte ou instalar um backend no site.

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

O script recompila o jogo, incorpora `web/`, testa o servidor e compila os dois EXEs sem dependências DLL de terceiros. `CONTIG_GO` pode selecionar o compilador. A workflow `Validate Windows launcher` verifica o checksum e inicia o EXE x64 em um runner Windows. A compilação cruzada e os testes em Linux não substituem essa validação em Windows.

## Android (APK)

Baixe [`downloads/Contig60.apk`](https://raw.githubusercontent.com/CalopSenior/contig-60/main/downloads/Contig60.apk) no celular e abra o arquivo para instalar. Requer Android 8.0 ou superior e Android System WebView atualizado. O Android pode solicitar autorização para instalar aplicativos dessa origem. Não é necessário instalar Python, Node.js ou um servidor.

O APK inclui o jogo e roda dentro do WebView, com uma origem HTTPS local interceptada para fornecer os arquivos incorporados. O modo local funciona offline; o modo online usa os mesmos códigos manuais WebRTC, para 2 a 4 participantes. Não são solicitadas permissões de câmera, microfone ou armazenamento; a única permissão é INTERNET. Rotação da tela preserva a instância atual. Fechar o aplicativo ou o sistema encerrar seu processo perde a partida; retomada automática não foi implementada.

Esta primeira versão foi compilada e teve assinatura, estrutura e arquivos incorporados verificados. Ainda precisa de teste em aparelho Android para confirmar interface, WebRTC e exportação do histórico. A exportação por download de Blob usada na versão web não tem integração nativa com o armazenamento Android nesta versão.

### Reproduzir o APK

A camada de jogo permanece em TypeScript; `android/src/` contém somente a Activity Java de integração com o Android. Após `npm run build`, configure as variáveis abaixo e execute `python android/build.py`:

- `ANDROID_JAR`: caminho de `platforms/android-35/android.jar`.
- `ANDROID_BUILD_TOOLS`: pasta de Build Tools 35.0.0, com aapt2, d8, zipalign e apksigner.
- `CONTIG_KEYSTORE`: arquivo PKCS12/JKS da chave de assinatura, alias `contig60`.
- `CONTIG_STOREPASS_FILE`: arquivo privado com a senha do keystore.
- JDK com javac; alternativamente `CONTIG_ECJ` aponta para o compilador Eclipse ECJ 3.40.0 verificado, executado com Java.

A chave desta distribuição foi criada em `/workspace/contig-signing/contig60.p12`, com a senha em arquivo separado na mesma pasta. Ambos estão fora do Git e não devem ser publicados. Faça backup privado desses arquivos para assinar futuras atualizações; sem a mesma chave, o Android exige desinstalar a versão anterior. A assinatura é própria, para distribuição direta de APK, sem publicação na Play Store.
