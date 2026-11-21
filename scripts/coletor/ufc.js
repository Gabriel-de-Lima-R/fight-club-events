// Coletor da UFC (MVP4, fase 1): lê a lista oficial de eventos e compara com data/eventos.json.
// SÓ LÊ: imprime um relatório de diferenças e não altera nenhum arquivo de dados.
//
// Uso:
//   node scripts/coletor/ufc.js                      busca https://www.ufc.com.br/events
//   node scripts/coletor/ufc.js --arquivo lista.html  usa um HTML já baixado (teste offline)
//   node scripts/coletor/ufc.js --rascunho            além do relatório, gera um rascunho de cada evento
//                                                     novo em scripts/coletor/saida/rascunho-ufc.json
//                                                     (use --saida caminho.json para outro destino)
//
// Código de saída: 0 = relatório gerado; 2 = falha ao buscar ou o layout do site mudou.
// O robots.txt da UFC pede crawl-delay de 15 s: o relatório usa uma única requisição; o --rascunho
// faz 3 por evento novo (evento + 2 lutadores) e espera 15 s entre elas.

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

// ---------- rascunho de evento novo (páginas do evento e dos lutadores) ----------

const ESPERA_ENTRE_REQUISICOES_MS = 15000; // crawl-delay do robots.txt da UFC
const ARQUIVO_LUTADORES = path.join(__dirname, '..', '..', 'data', 'lutadores.json');
const SAIDA_PADRAO = path.join(__dirname, 'saida', 'rascunho-ufc.json');

// Categorias da UFC: chave sem acento e sem hífen -> nome no nosso padrão e limite em libras.
const CATEGORIAS = [
  ['peso meio pesado', 'Peso Meio-pesado', 205],
  ['peso meio medio', 'Peso Meio-médio', 170],
  ['peso pesado', 'Peso Pesado', 265],
  ['peso medio', 'Peso Médio', 185],
  ['peso leve', 'Peso Leve', 155],
  ['peso pena', 'Peso Pena', 145],
  ['peso galo', 'Peso Galo', 135],
  ['peso mosca', 'Peso Mosca', 125],
  ['peso palha', 'Peso Palha', 115],
  ['peso atomo', 'Peso Átomo', 115],
];

const PAISES = {
  'United States': 'Estados Unidos', Canada: 'Canadá', 'United Arab Emirates': 'Emirados Árabes Unidos',
  Qatar: 'Catar', 'Saudi Arabia': 'Arábia Saudita', Australia: 'Austrália', Brazil: 'Brasil', Mexico: 'México',
  'United Kingdom': 'Reino Unido', China: 'China', Japan: 'Japão', France: 'França', Germany: 'Alemanha',
  Spain: 'Espanha', Poland: 'Polônia', Singapore: 'Singapura', Azerbaijan: 'Azerbaijão', Russia: 'Rússia',
  Thailand: 'Tailândia', 'South Korea': 'Coreia do Sul', Argentina: 'Argentina', Chile: 'Chile',
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitizarChave(texto) {
  return semAcento(texto).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// "Peso-pena Luta" -> { weight_class: "Peso Pena", weight_limit_lbs: 145, extra: "" }
function interpretarCategoria(texto) {
  const chave = sanitizarChave(texto);
  const achada = CATEGORIAS.find(([k]) => chave.startsWith(k));
  if (!achada) return { weight_class: limparTexto(texto), weight_limit_lbs: null, extra: texto };
  let resto = chave.slice(achada[0].length).trim();
  let nome = achada[1];
  if (resto.startsWith('feminino')) {
    nome += ' feminino';
    resto = resto.slice('feminino'.length).trim();
  }
  resto = resto.replace(/^luta\b/, '').trim(); // "Luta" é só o rótulo da UFC
  return { weight_class: nome, weight_limit_lbs: achada[2], extra: resto };
}

function slugTexto(texto) {
  return semAcento(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function dataEmBrasilia(iso) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  return p; // AAAA-MM-DD
}

// Página do evento: nome, transmissão e a luta principal (primeiro bloco de luta da página).
function extrairDetalhe(html) {
  const limpo = html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/\s+/g, ' ');

  const titulo = limpo.match(/<title>([\s\S]*?)<\/title>/);
  const nome = titulo ? limparTexto(titulo[1]).split(' | ')[0].replace(/\s+vs\.?\s+/i, ' x ') : null;

  const inicio = limpo.indexOf('<div class="c-listing-fight" ');
  const proximo = inicio === -1 ? -1 : limpo.indexOf('<div class="c-listing-fight" ', inicio + 10);
  const bloco = inicio === -1 ? '' : limpo.slice(inicio, proximo === -1 ? undefined : proximo);

  const classe = bloco.match(/c-listing-fight__class-text">([^<]*)</);
  const lutadores = [];
  const re = /c-listing-fight__corner-name--(?:red|blue)"> ?<a href="[^"]*\/athlete\/([^"]+)"> ?<span class="c-listing-fight__corner-given-name">([^<]*)<\/span> ?<span class="c-listing-fight__corner-family-name">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(bloco))) {
    lutadores.push({ slug: m[1], nome: [limparTexto(m[2]), limparTexto(m[3])].filter(Boolean).join(' '), sobrenome: limparTexto(m[3]) });
  }

  return {
    nome,
    transmissao_paramount: /Assista no Paramount\+/.test(limpo),
    categoria: classe ? limparTexto(classe[1]) : null,
    lutadores,
  };
}

// Página do lutador: cartel (V-D-E) e envergadura. Nacionalidade não existe na fonte, só a cidade natal.
function extrairAtleta(html) {
  const limpo = html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/\s+/g, ' ');
  const cartel = limpo.match(/hero-profile__division-body">([^<]*)</);
  const m = cartel && cartel[1].match(/(\d+)-(\d+)-(\d+)/);
  const bio = {};
  for (const b of limpo.matchAll(/c-bio__label">([^<]*)<\/div> ?<div class="c-bio__text">([^<]*)</g)) bio[limparTexto(b[1])] = limparTexto(b[2]);
  const envergadura = parseFloat(bio['Envergadura']);
  return {
    texto_cartel: cartel ? limparTexto(cartel[1]) : null,
    record: m ? { wins: +m[1], losses: +m[2], draws: +m[3], no_contests: null } : null,
    nc: cartel ? (cartel[1].match(/(\d+)\s*NC/i) || [])[1] || null : null,
    reach_in: envergadura > 0 ? envergadura : null,
    cidade_natal: bio['Cidade natal'] || null,
  };
}

// Junta lista + página do evento + páginas dos lutadores num evento no formato do eventos.json.
// Devolve também "revisar": o que o coletor não conseguiu preencher ou que merece conferência humana.
function montarRascunho(site, detalhe, atletas, idsCadastrados) {
  const revisar = [];
  const numerado = site.slug.match(/^ufc-(\d+)$/);
  const nomeEvento = detalhe.nome || `UFC: ${site.luta_principal.replace(/\s+vs\.?\s+/i, ' x ')}`;
  if (!detalhe.nome) revisar.push('nome do evento não encontrado na página: nome montado a partir da luta principal');

  if (detalhe.lutadores.length !== 2) revisar.push(`a página trouxe ${detalhe.lutadores.length} lutadores na luta principal (esperado: 2)`);
  const principalConfere = detalhe.lutadores.length === 2 &&
    detalhe.lutadores.every((l) => semAcento(site.luta_principal).includes(semAcento(l.sobrenome).split(' ').pop()));
  if (!principalConfere) revisar.push(`luta principal da página difere da lista ("${site.luta_principal}")`);

  const cat = detalhe.categoria ? interpretarCategoria(detalhe.categoria) : { weight_class: '', weight_limit_lbs: null, extra: 'categoria não encontrada' };
  if (cat.weight_limit_lbs === null) revisar.push(`categoria "${detalhe.categoria}" não reconhecida: preencher weight_class e weight_limit_lbs`);
  if (cat.extra && cat.weight_limit_lbs !== null) revisar.push(`categoria com detalhe extra ("${detalhe.categoria}"): conferir se é disputa de cinturão`);

  const pais = PAISES[site.country] || site.country;
  if (site.country && !PAISES[site.country]) revisar.push(`país "${site.country}" sem tradução cadastrada: traduzir para português`);

  const lutadores = detalhe.lutadores.map((l) => {
    const a = atletas[l.slug] || {};
    if (!a.record) revisar.push(`${l.nome}: cartel não encontrado`);
    if (a.nc) revisar.push(`${l.nome}: tem ${a.nc} no contest(s) na fonte; no_contests ficou null, ajustar se quiser`);
    revisar.push(`${l.nome}: nationality ficou null (a UFC só mostra a cidade natal${a.cidade_natal ? `: ${a.cidade_natal}` : ''})`);
    const lutador = {};
    if (idsCadastrados.has(l.slug)) lutador.fighter_id = l.slug;
    lutador.name = l.nome;
    lutador.nationality = null;
    lutador.record = a.record || null;
    if (a.reach_in) lutador.reach_in = a.reach_in;
    return lutador;
  });

  const familias = detalhe.lutadores.map((l) => slugTexto(l.sobrenome));
  const id = [numerado ? site.slug : 'ufc-fn', dataEmBrasilia(site.starts_at), ...familias].join('-');
  revisar.push('broadcast: url ficou null (padrão do projeto para o Paramount+)');

  const evento = {
    id,
    is_sample: false,
    organization: 'UFC',
    name: nomeEvento,
    starts_at: site.starts_at,
    status: 'scheduled',
    venue: { name: site.venue, city: site.city, country: pais },
    broadcast: detalhe.transmissao_paramount ? [{ name: 'Paramount+', type: 'streaming', url: null }] : [],
    source_url: site.url,
    fights: [{ order: 1, card_section: 'main_event', weight_class: cat.weight_class, weight_limit_lbs: cat.weight_limit_lbs, fighters: lutadores }],
  };
  if (!detalhe.transmissao_paramount) revisar.push('transmissão: Paramount+ não aparece na página, broadcast ficou vazio');
  return { evento, revisar };
}

async function gerarRascunhos(novos, arquivoSaida) {
  const idsCadastrados = new Set(JSON.parse(fs.readFileSync(ARQUIVO_LUTADORES, 'utf8')).fighters.map((f) => f.id));
  const rascunhos = [];
  let primeira = true;
  const pegar = async (url) => {
    if (!primeira) await esperar(ESPERA_ENTRE_REQUISICOES_MS);
    primeira = false;
    return baixar(url);
  };

  for (const site of novos) {
    console.log(`Lendo ${site.url} ...`);
    const detalhe = extrairDetalhe(await pegar(site.url));
    const atletas = {};
    for (const l of detalhe.lutadores) {
      console.log(`  lutador: ${l.nome}`);
      atletas[l.slug] = extrairAtleta(await pegar(`https://www.ufc.com.br/athlete/${l.slug}`));
    }
    rascunhos.push(montarRascunho(site, detalhe, atletas, idsCadastrados));
  }

  fs.mkdirSync(path.dirname(arquivoSaida), { recursive: true });
  const saida = {
    aviso: 'RASCUNHO gerado automaticamente. Conferir cada item na fonte oficial (source_url) antes de copiar para data/eventos.json.',
    gerado_em: new Date().toISOString(),
    eventos: rascunhos.map((r) => r.evento),
    revisar: rascunhos.map((r) => ({ id: r.evento.id, itens: r.revisar })),
  };
  fs.writeFileSync(arquivoSaida, JSON.stringify(saida, null, 2) + '\n');
  console.log(`\n${rascunhos.length} rascunho(s) salvo(s) em ${path.relative(process.cwd(), arquivoSaida)} (fora de data/).`);
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
  const resultado = comparar(eventos, dados);
  imprimirRelatorio(eventos, resultado);

  if (process.argv.includes('--rascunho') && resultado.novos.length) {
    const s = process.argv.indexOf('--saida');
    console.log('');
    await gerarRascunhos(resultado.novos, s !== -1 ? process.argv[s + 1] : SAIDA_PADRAO);
  }
}

if (require.main === module) {
  main().catch((erro) => {
    console.error('Falha no coletor da UFC:', erro.message);
    process.exit(2);
  });
}

module.exports = { extrairEventos, comparar, extrairDetalhe, extrairAtleta, montarRascunho, interpretarCategoria };
