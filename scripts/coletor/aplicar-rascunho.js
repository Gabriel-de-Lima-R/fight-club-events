// Aplica o rascunho gerado pelo coletor em data/eventos.json e escreve o texto do Pull Request.
// Não valida (quem valida é scripts/validar.js, rodado em seguida) e não faz commit.
//
// Uso:
//   node scripts/coletor/aplicar-rascunho.js <rascunho.json> [--eventos data/eventos.json] [--corpo corpo-pr.md]
//
// O que faz:
//   - acrescenta os eventos do rascunho que ainda não existem (compara por id e por source_url);
//   - mantém a lista em ordem de data (starts_at);
//   - atualiza last_updated para hoje (horário de Brasília);
//   - escreve o corpo do PR com a lista "o que conferir".
// Se não houver nada novo, não altera nada e não escreve o corpo do PR.

const fs = require('fs');
const path = require('path');

function argumento(nome, padrao) {
  const i = process.argv.indexOf(nome);
  return i !== -1 ? process.argv[i + 1] : padrao;
}

const arquivoRascunho = process.argv[2];
if (!arquivoRascunho || arquivoRascunho.startsWith('--')) {
  console.error('Uso: node scripts/coletor/aplicar-rascunho.js <rascunho.json> [--eventos arquivo] [--corpo arquivo]');
  process.exit(2);
}
const arquivoEventos = argumento('--eventos', path.join(__dirname, '..', '..', 'data', 'eventos.json'));
const arquivoCorpo = argumento('--corpo', 'corpo-pr.md');

const emBrasilia = (iso, opcoes) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...opcoes }).format(new Date(iso));
const hojeBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const rascunho = JSON.parse(fs.readFileSync(arquivoRascunho, 'utf8'));
const dados = JSON.parse(fs.readFileSync(arquivoEventos, 'utf8'));

const ids = new Set(dados.events.map((e) => e.id));
const fontes = new Set(dados.events.map((e) => e.source_url).filter(Boolean));

const adicionados = [];
const ignorados = [];
for (const evento of rascunho.eventos) {
  if (ids.has(evento.id) || fontes.has(evento.source_url)) ignorados.push(evento.id);
  else adicionados.push(evento);
}

if (ignorados.length) console.log(`Ignorados (já existem no eventos.json): ${ignorados.join(', ')}`);
if (adicionados.length === 0) {
  console.log('Nada novo para aplicar.');
  process.exit(0);
}

dados.events.push(...adicionados);
// Array.prototype.sort é estável: eventos no mesmo horário mantêm a ordem de entrada.
dados.events.sort((a, b) => (a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0));
dados.last_updated = hojeBrasilia();
fs.writeFileSync(arquivoEventos, JSON.stringify(dados, null, 2) + '\n');

// ---------- corpo do Pull Request ----------

const revisarPorId = new Map((rascunho.revisar || []).map((r) => [r.id, r.itens]));
const linhas = [];
linhas.push('Eventos novos encontrados na agenda oficial da UFC e **ainda não conferidos por uma pessoa**.');
linhas.push('Nenhum dado deste PR é definitivo até você revisar cada evento na fonte oficial.');
linhas.push('');

for (const e of adicionados) {
  const luta = e.fights[0];
  linhas.push(`## ${e.name}`);
  linhas.push(`- **Data:** ${emBrasilia(e.starts_at, { dateStyle: 'short', timeStyle: 'short' })} (Brasília)`);
  linhas.push(`- **Local:** ${[e.venue.name, e.venue.city, e.venue.country].filter(Boolean).join(', ')}`);
  linhas.push(`- **Luta principal:** ${luta.fighters.map((l) => `${l.name}${l.record ? ` (${l.record.wins}-${l.record.losses}-${l.record.draws})` : ''}`).join(' x ')}, ${luta.weight_class}`);
  linhas.push(`- **Fonte oficial:** ${e.source_url}`);
  linhas.push('');
  linhas.push('Conferir:');
  linhas.push('- [ ] data, hora e local batem com a fonte oficial');
  linhas.push('- [ ] luta principal, categoria e cartel dos dois lutadores');
  for (const item of revisarPorId.get(e.id) || []) linhas.push(`- [ ] ${item}`);
  linhas.push('');
}

linhas.push('## Depois do merge');
linhas.push('Colar `supabase/dados.sql` no SQL Editor do Supabase, para o banco ficar igual ao JSON.');
linhas.push('');
linhas.push('_Gerado por `scripts/coletor/ufc.js` e `scripts/coletor/aplicar-rascunho.js` (workflow "Coletor da UFC")._');

fs.writeFileSync(arquivoCorpo, linhas.join('\n') + '\n');
console.log(`${adicionados.length} evento(s) adicionado(s) em ${arquivoEventos}; last_updated = ${dados.last_updated}.`);
console.log(`Texto do PR em ${arquivoCorpo}.`);
