// Gera supabase/dados.sql (comandos insert) a partir de data/eventos.json.
// Uso: node scripts/gerar-sql.js
// Não se conecta a nada: só lê o JSON e escreve o arquivo .sql.
// O SQL apaga os dados atuais e reinsere tudo, então pode ser rodado de novo.

const fs = require('fs');
const path = require('path');

const entrada = path.join(__dirname, '..', 'data', 'eventos.json');
const saida = path.join(__dirname, '..', 'supabase', 'dados.sql');

function sql(valor) {
  if (valor === null || valor === undefined) return 'null';
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'boolean') return valor ? 'true' : 'false';
  return "'" + String(valor).replace(/'/g, "''") + "'";
}

function linha(valores) {
  return '(' + valores.map(sql).join(', ') + ')';
}

const dados = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const eventos = [];
const transmissoes = [];
const lutas = [];
const lutadores = [];

for (const ev of dados.events) {
  eventos.push(linha([
    ev.id, ev.is_sample, ev.organization, ev.name, ev.starts_at, ev.status,
    ev.venue.name, ev.venue.city, ev.venue.country, ev.source_url,
  ]));
  for (const b of ev.broadcast) {
    transmissoes.push(linha([ev.id, b.name, b.type, b.url]));
  }
  for (const luta of ev.fights) {
    lutas.push(linha([ev.id, luta.order, luta.card_section, luta.weight_class, luta.weight_limit_lbs]));
    luta.fighters.forEach((l, i) => {
      const r = l.record || {};
      // O id da luta é buscado pelo evento e pela ordem, pois é gerado pelo banco.
      lutadores.push(
        `((select id from public.fights where event_id = ${sql(ev.id)} and "order" = ${luta.order}), ` +
        [i + 1, l.name, l.nationality, r.wins, r.losses, r.draws, r.no_contests, l.height_ft, l.reach_in]
          .map(sql).join(', ') + ')'
      );
    });
  }
}

const partes = [
  '-- Gerado por scripts/gerar-sql.js a partir de data/eventos.json. Não editar à mão.',
  '-- Rodar no painel: SQL Editor > New query > colar e executar.',
  '',
  'begin;',
  '',
  '-- As demais tabelas são apagadas junto (on delete cascade).',
  'delete from public.events;',
  '',
  'insert into public.events (id, is_sample, organization, name, starts_at, status, venue_name, venue_city, venue_country, source_url) values',
  eventos.join(',\n') + ';',
  '',
];
if (transmissoes.length) {
  partes.push(
    'insert into public.event_broadcasts (event_id, name, type, url) values',
    transmissoes.join(',\n') + ';',
    ''
  );
}
partes.push(
  'insert into public.fights (event_id, "order", card_section, weight_class, weight_limit_lbs) values',
  lutas.join(',\n') + ';',
  '',
  'insert into public.fight_fighters (fight_id, position, name, nationality, wins, losses, draws, no_contests, height_ft, reach_in) values',
  lutadores.join(',\n') + ';',
  '',
  'commit;',
  ''
);

fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, partes.join('\n'));
console.log(`Gerado ${path.relative(process.cwd(), saida)}: ${eventos.length} eventos, ${transmissoes.length} transmissões, ${lutas.length} lutas, ${lutadores.length} lutadores.`);
