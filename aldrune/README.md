# Aldrune Online

Um RPG multiplayer 2D de navegador, com mundo aberto persistente, inspirado em **The Elder Scrolls II: Daggerfall** (mundo procedural, calendário astral, facções profundas, masmorras proceduais) e **Ultima Online** (progressão por uso de habilidades, economia viva, casas dos jogadores, PvP por consentimento) — com mecânicas próprias em cima disso.

Servidor autoritativo em Node.js + WebSocket. Cliente em Canvas 2D + JavaScript puro (sem build step). Sem dependência de conta/senha: seu personagem é identificado pelo nome e persiste em disco.

## Como rodar

```bash
cd aldrune
npm install
npm start
```

Abra `http://localhost:3000` em duas abas (ou dois navegadores) para testar o multiplayer. `PORT` é configurável por variável de ambiente.

Os personagens, o Grimório compartilhado e os lotes de terra são salvos em `data/saves/*.json` a cada ~20s e ao encerrar o servidor (Ctrl+C).

## Design: o que este RPG tenta ser

A pergunta de design foi: **o que Daggerfall e Ultima Online tinham de mais especial, e como isso fica melhor sendo multiplayer de verdade — com sistemas que só fazem sentido porque outras pessoas estão jogando ao mesmo tempo?**

### 1. Progressão por uso, sem níveis (Ultima Online)
Não existe XP nem barra de nível. Cada habilidade (Espadas, Arco, Magia, Mineração, Herbalismo, Corte de Madeira, Arrombamento, Mercancia) sobe conforme é praticada, e fica mais difícil de subir quanto mais alta ela já está. Existe um teto global de pontos: ao esbarrar nele, treinar uma habilidade nova *rouba* um pouco de outra que você já domina. Isso força especialização horizontal — ninguém vira "faz-tudo", e builds de jogadores acabam sendo naturalmente complementares.

### 2. Teia de Facções com reputação em cadeia *(mecânica nova)*
Seis facções (Guarda, Liga Mercante, Alcateia Cinzenta, Confraria das Sombras, Culto da Lua Oca, Feras Selvagens) formam um grafo de relações. Ganhar ou perder reputação com uma facção **ecoa parcialmente** para as aliadas e rivais dela — matar um bandido não só te deixa mal visto entre bandidos, como automaticamente te deixa melhor visto pela Guarda, porque elas são rivais entre si. O mundo reage de forma sistêmica, não isolada.

### 3. Magia Rúnica com Descoberta Compartilhada *(mecânica nova, o coração criativo do jogo)*
Não há uma lista fixa de feitiços. Você combina 1 a 3 fragmentos rúnicos (Fogo, Gelo, Força, Vida, Morte, Sombra) e o servidor resolve o efeito a partir das propriedades brutas das runas. Algumas combinações já são ensinadas por mestres (feitiços "de fábrica"); qualquer combinação nunca vista antes no servidor é uma **descoberta real**: a primeira pessoa a conjurá-la com sucesso nomeia o feitiço, e ele é anunciado para todo mundo online e gravado para sempre no Grimório compartilhado — que qualquer jogador pode consultar e usar dali em diante. Isso transforma spellcrafting em um meta-jogo coletivo de exploração, em vez de uma árvore de talentos fixa.

### 4. Masmorras Vivas com Relógio de Corrupção *(mecânica nova sobre as masmorras proceduais de Daggerfall)*
Cada entrada de masmorra gera uma instância procedural própria para o grupo que entra. Quanto mais tempo o grupo permanece lá dentro, um **Relógio de Corrupção** sobe e, em marcos (25%/50%/75%/100%), a masmorra muda: paredes se abrem, monstros mais fortes despertam, culminando em um guardião de elite ("Arauto da Lua Oca") se o grupo ficar tempo demais. Isso recompensa incursões rápidas e decisivas em vez de limpar cada sala com calma.

### 5. Corrupção e Peregrinação — Karma visível *(mecânica nova, "Blood & Ash")*
Magia sombria, assassinato e necromancia mancham seu personagem com Corrupção, visível como uma aura roxa e refletida no jeito que NPCs e preços reagem a você. É totalmente reversível: peregrinar até o Santuário da Lua limpa a mancha. É um controle de estilo de jogo, não uma punição permanente.

### 6. Foragidos e PvP por consentimento (Ultima Online: Trammel/Felucca simplificado)
Cidades e estradas são protegidas pela Guarda — atacar outro jogador ali é bloqueado e punido. Fora delas, PvP só acontece se ambos os lados topam: ative o modo **Foragido** para poder lutar (e ser atacado) por outros jogadores, com risco de perder tudo o que carrega. Assassinatos ilegais acumulam contagem de mortes; a partir de 5, você vira **Procurado** e não pode mais desligar o modo Foragido.

### 7. Território vivo: terrenos, baús e decadência (Ultima Online: casas)
Lotes de terra ao redor da cidade podem ser reivindicados de graça. Você ganha um baú de armazenamento e pode anunciar itens à venda numa bancazinha (outros jogadores compram mesmo com você offline, e o ouro fica esperando por você). Lotes abandonados se deterioram com o tempo real e, se ninguém voltar, viram ruínas saqueáveis por qualquer um — o mapa muda de verdade dependendo de como as pessoas jogam.

### 8. Calendário Astral (Daggerfall)
O tempo corre em tempo real (1 segundo real = 1 minuto de jogo). Dia/noite afeta spawns (mais e mais fortes à noite) e a fase da lua afeta o mundo: sob a Lua Oca, runas de Morte e Sombra ficam mais potentes e a Corrupção sobe mais rápido; sob a Lua Nova, magias de cura ficam mais fortes.

## Arquitetura

```
aldrune/
  server/
    index.js          # bootstrap HTTP + WebSocket
    gameServer.js      # loop autoritativo, protocolo, orquestra todos os sistemas
    world/
      noise.js         # ruído 2D com seed, para o terreno
      worldgen.js       # biomas, cidade, recursos, lotes, pontos de spawn
      dungeon.js         # geração procedural de masmorra + relógio de corrupção
    systems/
      time.js            # calendário astral (dia/noite/lua/clima)
      skills.js           # progressão por uso + teto global
      combat.js            # fórmulas de dano/acerto
      factions.js           # ajuste de reputação com propagação em grafo
      magic.js                # resolução de combinações rúnicas + descoberta
      corruption.js             # karma, título, efeitos de preço/reputação
      pvp.js                     # zonas seguras, foragido, assassinato ilegal
      housing.js                  # reivindicação de lote, decadência
    entities/            # players, mobs (com IA simples por facção)
    data/                 # definições de itens, runas, mobs, facções
    persistence/           # save/load em JSON
  public/                   # cliente: HTML/CSS/JS puro, sem build
    js/
      net.js, state.js, input.js, render.js, ui.js, main.js
```

Protocolo é JSON sobre WebSocket. O servidor é autoritativo para tudo (posição, combate, economia); o cliente só envia intenção (`move`, `attack`, `cast`, `gather`, ...) e recebe snapshots filtrados por proximidade a ~10Hz.

## O que é uma base sólida vs. o que é um esboço

Sistemas completos e jogáveis agora: movimento e chat multiplayer em tempo real, mundo procedural com biomas, IA de monstros por facção, combate corpo-a-corpo/à distância/mágico, coleta de recursos, um NPC mercador com preços que reagem a oferta/demanda, masmorras instanciadas com o relógio de corrupção, teia de facções, spellcrafting com descoberta compartilhada, corrupção/peregrinação, foragido/PvP, lotes de terra com baú, bancazinha e decadência, calendário astral completo.

Áreas propositalmente deixadas simples, como próximos passos naturais: árvore de crafting mais profunda (hoje só há fundição de minério), mais tipos de monstros/masmorras/itens, quests estruturadas, e contas com senha (hoje é só o nome — suficiente para um protótipo local, mas trocar por autenticação de verdade é o primeiro passo antes de expor isso na internet pública).
