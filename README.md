# Fight Club

Agenda gratuita e sem login dos próximos eventos de MMA (UFC, PFL e ONE Championship), com horários de Brasília, local, luta principal e onde assistir.

**Acesse:** https://fight-club-events.vercel.app/

Projeto independente, **sem afiliação com o UFC, a PFL nem a ONE Championship**. Não tem apostas, odds nem imagens de terceiros.

## O que o site mostra

- **Agenda:** os próximos eventos em ordem de data, com a luta principal em destaque, o horário de Brasília, o local, onde assistir e o link da fonte oficial. Dá para filtrar por organização (UFC, PFL, ONE), marcando uma ou mais.
- **Calendário:** a grade do mês com os dias de evento marcados. Ao tocar num dia, aparece o evento e onde assistir.

## Como abrir no seu computador

Precisa do [Node.js](https://nodejs.org) instalado. Não é preciso instalar mais nada.

```bash
node scripts/servidor.js
```

Depois abra http://localhost:8080 no navegador. Para parar o servidor, aperte `Ctrl+C`.

> Abrir o `index.html` direto (com dois cliques) não funciona: o navegador bloqueia a leitura do `data/eventos.json`. Use o servidor acima.

## Como atualizar os eventos

1. Edite `data/eventos.json` à mão. O formato completo está no [CLAUDE.md](CLAUDE.md).
2. Atualize o campo `last_updated` com a data da revisão.
3. Rode o validador:

   ```bash
   node scripts/validar.js
   ```

O validador mostra **erros**, que bloqueiam, e **avisos**, que não bloqueiam, sempre dizendo o evento e o campo com problema.

### Regras dos dados

- Datas e horas em UTC, terminando em `Z` (ex.: `2026-10-18T00:00:00Z`). O site converte para o horário de Brasília.
- Todo evento real precisa de `source_url` apontando para a página oficial (ufc.com.br ou ufc.com).
- O que a fonte oficial não informar fica `null`. Nunca inventar informação.
- Não guardar idade, apenas a data de nascimento, se necessário.

## Validação automática antes do commit

O hook em `.githooks/pre-commit` roda o validador e bloqueia o commit se houver erro. Num clone novo, ative com:

```bash
git config core.hooksPath .githooks
```

## Estrutura

```
index.html            agenda e calendário (duas abas)
css/style.css         estilos (mobile-first, modo claro e escuro)
js/app.js             carrega os dados e monta a agenda
js/calendario.js      grade mensal
data/eventos.json     dados dos eventos
scripts/validar.js    validador do JSON
scripts/servidor.js   servidor local para testes
```

Feito com HTML, CSS e JavaScript puros, sem framework e sem etapa de build.

## Publicação

O site é publicado de graça pelo GitHub Pages, a partir da branch `main` (pasta raiz). Cada push para a `main` atualiza o site em 1 a 2 minutos. O arquivo `.nojekyll` faz o GitHub servir os arquivos exatamente como estão.
