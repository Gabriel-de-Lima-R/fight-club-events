# Fight Club

Site estático, gratuito e sem login que reúne a agenda dos próximos eventos de MMA (UFC, PFL e ONE Championship; KSW e Jungle Fight entram no MVP3). Projeto independente, sem afiliação com nenhuma dessas organizações.

## Como trabalhar comigo

1. Antes de escrever código em cada fase, descreva em até 3 linhas o que vai fazer e espere minha aprovação.
2. Faça um passo por vez. Não avance para a próxima fase sem eu confirmar.
3. Ao terminar um passo, rode o validador (quando existir), abra o site localmente e me diga exatamente o que eu devo testar.
4. Se algo der erro, explique a causa em português simples e proponha a correção antes de aplicar.
5. Faça um commit claro, em português, ao fim de cada etapa que funcionar, e envie para o GitHub.
6. Nunca peça nem aceite senhas, tokens ou chaves no chat. A autenticação do GitHub é feita pelo navegador.
7. Não apague arquivos nem reescreva partes grandes do projeto sem me avisar antes.
8. Não instale dependências pesadas sem explicar por quê.

## Git e commits

- Trabalhar sempre na branch develop. A main só recebe o que está pronto para ir ao ar (a Vercel publica a partir dela, integrada ao repositório do GitHub).
- Todo commit segue Conventional Commits: tipo, dois pontos e descrição em português (ex.: feat: adiciona filtro por tipo de evento).
- Tipos: feat, fix, docs, style, refactor, perf, test, build, ci, chore.

## Restrições do projeto

- 100% gratuito: hospedagem (Vercel, plano gratuito) e qualquer serviço futuro precisam ter plano gratuito. Não pagar nenhum plano, nem no Supabase. O GitHub Pages não é mais usado.
- Sem login, sem banco de dados e sem backend no MVP1. O banco de dados (Supabase) entra no MVP2, veja a seção "MVP2".
- Sem apostas, odds ou links de casas de apostas.
- Sem logos nem imagens de terceiros. Usar texto e cores próprias. Exceção a partir do MVP3: fotos de lutadores com licença livre ou com permissão por escrito do dono dos direitos, sempre com crédito (o nome do autor ou, quando ele não pedir nome, "Uso autorizado pelo autor"; veja a seção "MVP3"). Fotos oficiais das organizações (UFC, PFL, ONE, KSW, Jungle Fight) só com permissão por escrito delas.
- Rodapé com aviso: site independente, não afiliado a nenhuma das organizações listadas, e data da última atualização dos dados.

## Tecnologia (MVP1)

- HTML, CSS e JavaScript puros. Sem framework e sem etapa de build.
- Dados em data/eventos.json, editado manualmente.
- Datas guardadas em UTC (formato ISO 8601). Na tela, converter para o horário de Brasília (America/Sao_Paulo).
- Layout mobile-first: precisa funcionar bem em tela de celular.

## Estrutura de pastas

- index.html: agenda e calendário (duas abas)
- css/style.css
- js/app.js: carrega os dados e monta a agenda
- js/calendario.js: grade mensal
- data/eventos.json
- scripts/validar.js: confere o JSON antes de cada commit
- scripts/gerar-sql.js: gera supabase/dados.sql a partir do JSON (MVP2)
- supabase/schema.sql: tabelas e regras de segurança (RLS) do PostgreSQL (MVP2)
- supabase/dados.sql: gerado, não editar à mão (MVP2)
- images/lutadores/: fotos dos lutadores, uma por lutador (MVP3)
- docs/arquitetura.md: diagramas da arquitetura em Mermaid (MVP3)
- README.md

## Formato dos dados (data/eventos.json)

O arquivo tem last_updated (data da última revisão, AAAA-MM-DD), display_timezone ("America/Sao_Paulo") e events (lista de eventos).

Cada evento:
- id: texto único, sem espaços
- is_sample: true para dados de teste/exemplo, false para eventos reais conferidos
- organization: "UFC", "PFL" ou "ONE" (no MVP3 entram "KSW" e "JUNGLE")
- name: nome do evento
- starts_at: data e hora em UTC, formato ISO 8601 terminando em Z (ex.: 2026-10-18T00:00:00Z)
- status: scheduled, live, completed, cancelled ou postponed
- venue: name, city, country (city e country podem ser null)
- broadcast: lista de onde assistir (pode ser vazia). Cada item tem:
  - name: nome do canal ou streaming
  - type: streaming ou tv
  - url: link (pode ser null)
- source_url: link da fonte oficial (pode ser null só em evento de exemplo; obrigatório quando is_sample é false)
- fights: lista de lutas

Cada luta:
- order: posição no card (1, 2, 3... em sequência; a luta 1 é sempre main_event)
- card_section: main_event, co_main, main_card, prelims ou early_prelims
- weight_class: categoria de peso
- weight_limit_lbs: limite de peso em libras
- fighters: lista com 2 lutadores

Cada lutador:
- name
- nationality: nacionalidade, em português (ex.: "Brasileiro", "Canadense"); null quando a fonte oficial não informar
- record: wins, losses, draws, no_contests (números inteiros, 0 ou mais; no_contests pode ser null, pois o site oficial mostra só V-D-E). O record inteiro pode ser null quando a fonte oficial não mostra o cartel completo (ex.: ONE)
- height_ft e reach_in: opcionais, podem ser null
- fighter_id: opcional (ausente ou null). Quando existe, é o identificador fixo do lutador em data/lutadores.json (ex.: "charles-oliveira")

Regras dos dados:
- Não guardar idade (muda com o tempo). Se necessário, guardar a data de nascimento.
- Campos desconhecidos ficam null. Nunca inventar informação.
- Todo evento real precisa ter source_url com fonte oficial conferida.
- Eventos com is_sample: true são só para teste e não podem ir ao ar como dados reais.
- Antes de cada commit, rodar scripts/validar.js. Se falhar, corrigir antes de commitar.
- O hook de pre-commit (.githooks/pre-commit) roda o validador e bloqueia o commit se houver erro. Em um clone novo, ativar com: git config core.hooksPath .githooks

## Plano do MVP1

- Fase 0: preparação (plano, app, pasta, repositório público no GitHub).
- Fase 1: fundação (Git conectado, CLAUDE.md, estrutura de pastas, eventos.json com os 3 eventos de exemplo atuais (is_sample: true), validador).
- Fase 2: agenda (próximos eventos por data, luta principal em destaque, horário de Brasília, local, onde assistir, link oficial; eventos passados ocultos).
- Fase 3: calendário mensal (navegação entre meses, dias com evento marcados, clique no dia mostra o evento e onde assistir).
- Fase 4: dados reais (10 a 15 eventos conferidos em fonte oficial).
- Fase 5: acabamento (teste no celular, estado vazio, aviso de site independente, data de atualização; filtro por tipo de evento se houver tempo).
- Fase 6: publicar na Vercel (deploy automático a partir do GitHub) e testar a URL pública.

## MVP1 está pronto quando

- abre sem login
- agenda em ordem de data, com a luta principal em destaque
- calendário mensal funcionando, mostrando onde assistir cada evento
- horários em Brasília
- confortável no celular
- cada evento tem link para fonte oficial
- validação do JSON passa
- site publicado e acessível por URL

## MVP2: banco de dados (Supabase)

Objetivo: deixar de usar o JSON como fonte da verdade e passar a usar PostgreSQL no Supabase (plano gratuito), mantendo o site estático, sem login e sem backend próprio.

- O site lê os dados pela API pública do Supabase (fetch, sem biblioteca), só leitura. A Project URL e a chave anon/publishable podem ficar no código; a RLS garante que o acesso anônimo só consegue ler.
- Nunca guardar no repositório nem no chat: senha do banco e chave service_role/secret.
- data/eventos.json e o banco precisam ficar sempre iguais, porque o JSON é o fallback do site. Fluxo manual: editar o JSON, rodar o validador, rodar node scripts/gerar-sql.js e colar supabase/dados.sql no SQL Editor do Supabase (o arquivo apaga e reinsere tudo, então pode ser rodado de novo). Todo commit que mude o JSON deve incluir o dados.sql regenerado.
- No plano gratuito o projeto pausa após cerca de 1 semana sem atividade. A pausa não apaga os dados: o projeto fica adormecido e é reativado pelo painel (Restore). O botão de restauração fica disponível por 90 dias após a pausa; depois disso só dá para baixar o backup. Enquanto estiver pausado, o site continua funcionando pelo JSON.
- Etapas: (1) esquema e importação dos dados (feito); (2) site lendo do Supabase com fallback para o JSON; (3) definir como os dados passam a ser editados no banco e o que acontece com o validador.

## MVP3: novas organizações, resultados, fotos e arquitetura

Objetivo: ampliar a cobertura e o conteúdo do site sem perder as regras dos MVPs anteriores (gratuito, sem login, sem backend próprio, JSON como fallback igual ao banco).

### 1. KSW e Jungle Fight
- Novos valores de organization: "KSW" (Konfrontacja Sztuk Walki) e "JUNGLE" (Jungle Fight). Atualizar juntos: check do banco (supabase/schema.sql), validador, filtro, etiquetas, cores, rodapé e páginas Sobre/Guia.
- Fontes oficiais: kswmma.com e junglefc.com.br (site oficial do Jungle Fight).
- Evento com card ainda não anunciado (caso atual do Jungle Fight): fights pode ser uma lista vazia. O validador passa a aceitar isso, e o site mostra "Card a anunciar" no lugar da luta principal. Nunca inventar lutadores.

### 2. Resultado das lutas
- Cada luta ganha o campo result, null (ou ausente) enquanto a luta não aconteceu ou o resultado não foi conferido na fonte oficial.
- result tem só dois campos: outcome (win ou draw) e winner (1 ou 2, posição do vencedor em fighters; null em draw). Não guardamos método, round nem tempo, e no contest fica sem resultado (result null).
- Cenários que o card de luta passada mostra: vitória, empate e resultado não conferido. Luta cancelada é tratada à parte (não tem resultado).
- Visual (esboço aprovado): vencedor em destaque com o selo "Venceu" e perdedor esmaecido; empate com os dois lutadores neutros e o selo "Empate"; sem resultado conferido, o card fica como o de hoje com o selo "Não atualizado".
- Os eventos passados continuam fora da agenda e só aparecem no calendário, ao clicar num dia antigo; o card deles mostra o resultado. Uma área própria de "Resultados" fica para um MVP futuro: por enquanto o resultado só entra na base de dados.

### 3. Fotos dos lutadores
- Primeira opção: foto com licença livre (ex.: Wikimedia Commons com CC BY, CC BY-SA ou domínio público), com crédito ao autor e link da licença.
- Sem foto livre, só com permissão por escrito do dono dos direitos (fotógrafo, lutador ou organização). O mantenedor guarda a prova da permissão fora do repositório. Nos dados, a licença fica "Uso autorizado pelo autor" e license_url fica null. author e source_url ficam null quando o autor não pediu nome nem link; nesse caso o crédito mostrado é só "Uso autorizado pelo autor". Com licença livre, autor, license_url e source_url são obrigatórios.
- Sem foto conferida, o site continua mostrando as iniciais.
- As fotos ficam no repositório, em images/lutadores/, publicadas pela Vercel (funcionam mesmo com o Supabase pausado). Formato WebP, quadrado, pequeno (cerca de 256 px e até 30 KB).
- Para reaproveitar a foto entre eventos, cada lutador ganha um identificador fixo (fighter_id, ex.: "charles-oliveira"). No banco, isso vira uma tabela fighters (nome, foto, autor, licença e links), referenciada pelas lutas.
- data/lutadores.json espelha a tabela fighters: { "fighters": [ { id, name, photo } ] }. photo é null ou { path, author, license, license_url, source_url }, com path em images/lutadores/ e terminando em .webp. O validador confere os dois arquivos juntos.
- Posição na tela: no destaque do topo, a foto fica no lugar das iniciais; nos cards da agenda e do calendário, um círculo pequeno ao lado do nome (foto ou iniciais). Créditos completos numa lista na aba Sobre e no title da foto.

### 4. Arquitetura
- docs/arquitetura.md com diagramas em Mermaid (o GitHub mostra direto): contexto (C4 nível 1), contêineres (C4 nível 2: navegador, Vercel, Supabase, JSON de fallback, scripts) e o modelo de dados (diagrama ER).
- Atualizar os diagramas sempre que uma fase do MVP3 mudar o esquema ou o fluxo dos dados.

### Ordem das fases do MVP3
- Fase 1: arquitetura atual e modelo de dados planejado (base para as fases seguintes).
- Fase 2: KSW e Jungle Fight.
- Fase 3: resultados (esboço visual, dados, selos no card do calendário).
- Fase 4: fotos dos lutadores (identificador fixo, tabela fighters, primeiras fotos com crédito).

## Fora dos MVPs (não implementar sem pedido)

Atualização automática de dados, card completo detalhado, resultados ao vivo (durante o evento), favoritos, lembretes, notícias, busca por lutador.
