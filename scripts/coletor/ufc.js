// Coletor da UFC (MVP4, fase 1): lê a lista oficial de eventos e compara com data/eventos.json.
// SÓ LÊ: imprime um relatório de diferenças e não altera nenhum arquivo de dados.
//
// Uso:
//   node scripts/coletor/ufc.js                      busca https://www.ufc.com.br/events
//   node scripts/coletor/ufc.js --arquivo lista.html  usa um HTML já baixado (teste offline)
//
// Código de saída: 0 = relatório gerado; 2 = falha ao buscar ou o layout do site mudou.
// O robots.txt da UFC pede crawl-delay de 15 s: este script faz uma única requisição por execução.

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const URL_LISTA = 'https://www.ufc.com.br/events';
const ARQUIVO_EVENTOS = path.join(__dirname, '..', '..', 'data', 'eventos.json');
const USER_AGENT = 'fight-club-coletor/0.1 (projeto independente, leitura da agenda publica)';

// ---------- busca ----------

function baixar(url, redirecionamentos = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9', 'Accept-Encoding': 'gzip' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirecionamentos <= 0) return reject(new Error('Redirecionamentos demais'));
          return resolve(baixar(new URL(res.headers.location, url).href, redirecionamentos - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} em ${url}`));
        }
        const partes = [];
        const fluxo = res.headers['content-encoding'] === 'gzip' ? res.pipe(zlib.createGunzip()) : res;
        fluxo.on('data', (p) => partes.push(p));
        fluxo.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
        fluxo.on('error', reject);
      }
    );
    req.setTimeout(30000, () => req.destroy(new Error('Tempo esgotado ao buscar ' + url)));
    req.on('error', reject);
  });
}

// ---------- leitura do HTML ----------

function limparTexto(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Devolve os cartões de evento da lista. Cada cartão tem slug, luta principal, data, local e se já passou.
function extrairEventos(html) {
  const limpo = html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/\s+/g, ' ');
  const cartoes = limpo.split('<article class="c-card-event--result">').slice(1);

  const eventos = [];
  for (const cartao of cartoes) {
    // O cartão tem <article> aninhados (lutas); o fim real é o </article> depois dos botões de ação.
    const acoes = cartao.indexOf('c-card-event--result__actions');
    const fim = acoes === -1 ? -1 : cartao.indexOf('</article>', acoes);
    const c = fim === -1 ? cartao : cartao.slice(0, fim);

    const link = c.match(/<h3 class="c-card-event--result__headline"><a href="\/event\/([^"#?]+)">([\s\S]*?)<\/a>/);
    const epoch = c.match(/data-main-card-timestamp="(\d+)"/);
    if (!link || !epoch) continue; // cartão sem os dados essenciais: ignorado (e contado como suspeito abaixo)

    const local = c.match(/<h5>([\s\S]*?)<\/h5>/);
    const cidade = c.match(/<span class="locality">([\s\S]*?)<\/span>/);
    const pais = c.match(/<span class="country">([\s\S]*?)<\/span>/);

    eventos.push({
      slug: link[1],
      url: `https://www.ufc.com.br/event/${link[1]}`,
      luta_principal: limparTexto(link[2]),
      starts_at: new Date(Number(epoch[1]) * 1000).toISOString().replace('.000Z', 'Z'),
      venue: local ? limparTexto(local[1]) : null,
      city: cidade ? limparTexto(cidade[1]) : null,
      country: pais ? limparTexto(pais[1]) : null,
      // Evento já realizado mostra "Resultados"; o futuro mostra "Como Assistir".
      passado: /Resultados/.test(c) && !/Como Assistir/.test(c),
    });
  }
  return { eventos, cartoesNaPagina: cartoes.length };
}

// ---------- comparação com data/eventos.json ----------

function semAcento(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function slugDoSourceUrl(url) {
  const m = typeof url === 'string' && url.match(/\/event\/([^/?#]+)/);
  return m ? m[1] : null;
}

// A luta principal bate se cada lutador do JSON tem pelo menos uma palavra (3+ letras) no nome do site.
function lutaPrincipalConfere(evento, nomeSite) {
  const luta = evento.fights && evento.fights[0];
  if (!luta) return true; // card ainda não cadastrado: não há o que comparar
  const alvo = semAcento(nomeSite);
  return luta.fighters.every((l) =>
    semAcento(l.name)
      .split(/[\s-]+/)
      .filter((p) => p.length >= 3)
      .some((p) => alvo.includes(p))
  );
}

function comparar(coletados, dados, agora = new Date()) {
  const ufcNoJson = dados.events.filter((e) => e.organization === 'UFC');
  const porSlug = new Map();
  for (const e of ufcNoJson) {
    const slug = slugDoSourceUrl(e.source_url);
    if (slug) porSlug.set(slug, e);
  }

  const novos = [];
  const divergentes = [];

  for (const site of coletados) {
    const nosso = porSlug.get(site.slug);
    if (!nosso) {
      if (!site.passado) novos.push(site); // eventos passados antigos não interessam ao job de eventos
      continue;
    }
    const problemas = [];
    if (nosso.starts_at !== site.starts_at) problemas.push(`data/hora: nosso ${nosso.starts_at}, site ${site.starts_at}`);
    if (site.venue && semAcento(nosso.venue.name || '') !== semAcento(site.venue)) {
      problemas.push(`local: nosso "${nosso.venue.name}", site "${site.venue}"`);
    }
    if (!lutaPrincipalConfere(nosso, site.luta_principal)) {
      problemas.push(`luta principal: nosso "${nosso.fights[0].fighters.map((l) => l.name).join(' x ')}", site "${site.luta_principal}"`);
    }
    if (site.passado && nosso.status === 'scheduled') problemas.push('já aconteceu no site, mas nosso status ainda é "scheduled" (tarefa do job de resultados)');
    if (!site.passado && nosso.status === 'completed') problemas.push('site mostra como futuro, mas nosso status é "completed"');
    if (problemas.length) divergentes.push({ site, nosso, problemas });
  }

  // "Sumiu da fonte": evento futuro nosso, dentro do período que a lista cobre, que não aparece mais.
  const futurosSite = coletados.filter((s) => !s.passado);
  const limite = futurosSite.length ? futurosSite.map((s) => s.starts_at).sort().pop() : null;
  const vistos = new Set(coletados.map((s) => s.slug));
  const ausentes = limite
    ? ufcNoJson.filter(
        (e) =>
          e.status === 'scheduled' &&
          new Date(e.starts_at) >= agora &&
          e.starts_at <= limite &&
          !vistos.has(slugDoSourceUrl(e.source_url))
      )
    : [];

  return { novos, divergentes, ausentes, limite };
}

// ---------- relatório ----------

function emBrasilia(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function imprimirRelatorio(coletados, resultado) {
  const futuros = coletados.filter((s) => !s.passado).length;
  console.log(`UFC: ${coletados.length} eventos lidos na lista oficial (${futuros} futuros, ${coletados.length - futuros} passados).`);
  console.log('');

  console.log(`NOVOS (na fonte e fora do eventos.json): ${resultado.novos.length}`);
  for (const e of resultado.novos) {
    console.log(`  + ${e.luta_principal} | ${emBrasilia(e.starts_at)} (Brasília) | ${[e.venue, e.city, e.country].filter(Boolean).join(', ')}`);
    console.log(`    fonte: ${e.url}`);
  }
  console.log('');

  console.log(`DIVERGENTES (nos dois, com dados diferentes): ${resultado.divergentes.length}`);
  for (const d of resultado.divergentes) {
    console.log(`  ~ ${d.nosso.id}`);
    for (const p of d.problemas) console.log(`      - ${p}`);
  }
  console.log('');

  console.log(`AUSENTES (nossos, futuros, que sumiram da lista oficial): ${resultado.ausentes.length}`);
  for (const e of resultado.ausentes) console.log(`  ! ${e.id} (${emBrasilia(e.starts_at)})`);
  if (resultado.limite) console.log(`  (a lista oficial cobre até ${emBrasilia(resultado.limite)}; eventos depois disso não são checados)`);
  console.log('');

  const total = resultado.novos.length + resultado.divergentes.length + resultado.ausentes.length;
  console.log(total === 0 ? 'Nada a atualizar: eventos.json está igual à fonte.' : `${total} ponto(s) para revisar. Nenhum arquivo foi alterado.`);
}

// ---------- execução ----------

async function main() {
  const i = process.argv.indexOf('--arquivo');
  const html = i !== -1 ? fs.readFileSync(process.argv[i + 1], 'utf8') : await baixar(URL_LISTA);

  const { eventos, cartoesNaPagina } = extrairEventos(html);
  // Se o site mudar o layout, preferimos falhar a gerar um relatório enganoso.
  if (eventos.length === 0 || eventos.length < cartoesNaPagina) {
    console.error(`Layout inesperado: ${cartoesNaPagina} cartões na página, ${eventos.length} lidos com sucesso. O coletor precisa de ajuste.`);
    process.exit(2);
  }

  const dados = JSON.parse(fs.readFileSync(ARQUIVO_EVENTOS, 'utf8'));
  imprimirRelatorio(eventos, comparar(eventos, dados));
}

if (require.main === module) {
  main().catch((erro) => {
    console.error('Falha no coletor da UFC:', erro.message);
    process.exit(2);
  });
}

module.exports = { extrairEventos, comparar };
