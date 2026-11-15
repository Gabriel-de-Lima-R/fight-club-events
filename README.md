# Fight Club

Agenda gratuita e sem login dos próximos eventos de MMA (UFC, PFL, ONE Championship, KSW e Jungle Fight), com horários de Brasília, local, luta principal e onde assistir.

**Acesse:** https://fight-club-events.vercel.app/

Projeto independente, **sem afiliação com o UFC, a PFL, a ONE Championship, a KSW nem o Jungle Fight**. Não tem apostas nem odds. As fotos dos lutadores têm licença livre ou foram usadas com permissão do autor, e o crédito fica na aba Sobre.

## O que o site mostra

- **Agenda:** os próximos eventos em ordem de data, com a luta principal em destaque, o horário de Brasília, o local, onde assistir e o link da fonte oficial. Cada lutador aparece com a foto ou, sem foto, com as iniciais. Dá para filtrar por organização (UFC, PFL, ONE, KSW, Jungle Fight), marcando uma ou mais.
- **Calendário:** a grade do mês com os dias de evento marcados. Ao tocar num dia, aparece o evento e onde assistir. Nos eventos já encerrados, o card mostra quem venceu a luta principal (ou o empate).
- **Guia do MMA:** explicação para quem está começando: o que é MMA, como uma luta termina, categorias de peso, como ler a agenda e um resumo de UFC, PFL, ONE Championship, KSW e Jungle Fight.

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
- Todo evento real precisa de `source_url` apontando para a página oficial da organização.
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
data/lutadores.json   cadastro dos lutadores (id, nome e foto)
images/lutadores/     fotos dos lutadores (recortes em WebP)
fonts/                fontes do site (licença SIL OFL)
scripts/validar.js    validador dos JSON
scripts/gerar-sql.js  gera supabase/dados.sql a partir dos JSON
scripts/servidor.js   servidor local para testes
supabase/             esquema e dados do banco
docs/arquitetura.md   diagramas da arquitetura
```

Feito com HTML, CSS e JavaScript puros, sem framework e sem etapa de build.

## Fotos dos lutadores

Cada lutador tem um identificador fixo (por exemplo, `charles-oliveira`) em `data/lutadores.json`. Para adicionar uma foto:

1. Recorte um quadrado de 256 px no rosto e salve em WebP como `images/lutadores/<id>.webp`, com o nome em minúsculas e até 30 KB. Guarde o original fora da pasta do projeto, se quiser mantê-lo: só o recorte final deve ficar em `images/lutadores/`.
2. Preencha o campo `photo` do lutador em `data/lutadores.json`: caminho, licença e, quando houver, autor e links. Com permissão por escrito do autor, a licença é "Uso autorizado pelo autor".
3. Use o `fighter_id` do lutador no `data/eventos.json`, rode o validador e gere o `dados.sql`.

Só entram fotos com licença livre ou com permissão por escrito de quem tem os direitos.

## Publicação

O site é publicado de graça pela Vercel, integrada ao repositório do GitHub. Cada push na branch de produção (`main`) gera um novo deploy automaticamente.

Os eventos são lidos do Supabase (PostgreSQL, plano gratuito). Se o banco estiver fora do ar ou pausado, o site usa `data/eventos.json` como reserva, por isso os dois precisam ficar iguais. Para sincronizar: `node scripts/gerar-sql.js` e colar `supabase/dados.sql` no SQL Editor do Supabase.
