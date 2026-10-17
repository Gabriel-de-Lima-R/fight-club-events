# Fight Club

Site estático, gratuito e sem login que reúne a agenda dos próximos eventos do UFC. Projeto independente, sem afiliação com o UFC.

## Como trabalhar comigo

1. Antes de escrever código em cada fase, descreva em até 3 linhas o que vai fazer e espere minha aprovação.
2. Faça um passo por vez. Não avance para a próxima fase sem eu confirmar.
3. Ao terminar um passo, rode o validador (quando existir), abra o site localmente e me diga exatamente o que eu devo testar.
4. Se algo der erro, explique a causa em português simples e proponha a correção antes de aplicar.
5. Faça um commit claro, em português, ao fim de cada etapa que funcionar, e envie para o GitHub.
6. Nunca peça nem aceite senhas, tokens ou chaves no chat. A autenticação do GitHub é feita pelo navegador.
7. Não apague arquivos nem reescreva partes grandes do projeto sem me avisar antes.
8. Não instale dependências pesadas sem explicar por quê.

## Restrições do projeto

- 100% gratuito: hospedagem (GitHub Pages) e qualquer serviço futuro precisam ter plano gratuito.
- Sem login, sem banco de dados e sem backend no MVP1.
- Sem apostas, odds ou links de casas de apostas.
- Sem logos, fotos de lutadores ou imagens de terceiros. Usar apenas texto e cores próprias.
- Rodapé com aviso: site independente, não afiliado ao UFC, e data da última atualização dos dados.

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
- README.md

## Formato dos dados (data/eventos.json)

O arquivo tem last_updated (data da última revisão, AAAA-MM-DD), display_timezone ("America/Sao_Paulo") e events (lista de eventos).

Cada evento:
- id: texto único, sem espaços
- is_sample: true para dados de teste/exemplo, false para eventos reais conferidos
- organization: "UFC"
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
- nationality: nacionalidade, em português (ex.: "Brasileiro", "Canadense")
- record: wins, losses, draws, no_contests (números inteiros, 0 ou mais)
- height_ft e reach_in: opcionais, podem ser null

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
- Fase 6: publicar no GitHub Pages e testar a URL pública.

## MVP1 está pronto quando

- abre sem login
- agenda em ordem de data, com a luta principal em destaque
- calendário mensal funcionando, mostrando onde assistir cada evento
- horários em Brasília
- confortável no celular
- cada evento tem link para fonte oficial
- validação do JSON passa
- site publicado e acessível por URL

## Fora do MVP1 (não implementar sem pedido)

Atualização automática de dados, card completo detalhado, resultados ao vivo, favoritos, lembretes, notícias, busca por lutador, banco de dados.
