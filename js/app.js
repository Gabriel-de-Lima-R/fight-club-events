// Fight Club — carrega os eventos do Supabase (com data/eventos.json de reserva) e monta a agenda.

// A Project URL e a chave publishable são públicas por natureza: a RLS do banco só permite leitura.
// Nunca colocar aqui a chave secret/service_role nem a senha do banco.
const SUPABASE_URL = 'https://nrahgicoirktbgqpjmhu.supabase.co';
const SUPABASE_CHAVE_PUBLICA = 'sb_publishable_LWOVMU_wCebbLb-4Npz2sw_bfKrARA4';
const SUPABASE_TIMEOUT_MS = 8000;

const FUSO_PADRAO = 'America/Sao_Paulo';
// Um evento continua na agenda por algumas horas depois do início (o card ainda está acontecendo).
const HORAS_VISIVEL_APOS_INICIO = 6;

const NOMES_STATUS = {
  live: 'Ao vivo',
  cancelled: 'Cancelado',
  postponed: 'Adiado',
};

// Cria um elemento com classe e texto. Usar textContent evita injetar HTML vindo dos dados.
function el(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined && texto !== null) elemento.textContent = texto;
  return elemento;
}

function formatarDataHora(iso, fuso) {
  const data = new Date(iso);
  const dia = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long',
  }).format(data);
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, hour: '2-digit', minute: '2-digit',
  }).format(data);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora} (Brasília)`;
}

function formatarDataSimples(aaaaMmDd) {
  const [ano, mes, dia] = aaaaMmDd.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarCartel(record) {
  const cartel = `${record.wins}-${record.losses}-${record.draws}`;
  return record.no_contests > 0 ? `${cartel} (${record.no_contests} NC)` : cartel;
}

function formatarLocal(venue) {
  const lugar = [venue.city, venue.country].filter(Boolean).join(', ');
  return lugar ? `${venue.name} · ${lugar}` : venue.name;
}

function eventoVisivel(evento, agora) {
  if (evento.status === 'completed') return false;
  const fim = new Date(evento.starts_at).getTime() + HORAS_VISIVEL_APOS_INICIO * 3600000;
  return fim > agora;
}

function montarLutador(lutador) {
  const bloco = el('div', 'lutador');
  bloco.append(el('span', 'lutador-nome', lutador.name));
  // Sem cartel (record null) quando a fonte oficial não informa o cartel completo.
  if (lutador.record) bloco.append(el('span', 'lutador-cartel', formatarCartel(lutador.record)));
  return bloco;
}

function montarLutaPrincipal(luta) {
  const bloco = el('div', 'luta-principal');
  bloco.append(el('p', 'luta-rotulo', 'Luta principal'));

  const confronto = el('div', 'luta-confronto');
  confronto.append(
    montarLutador(luta.fighters[0]),
    el('span', 'versus', 'vs'),
    montarLutador(luta.fighters[1]),
  );
  bloco.append(confronto);
  bloco.append(el('p', 'luta-categoria', `${luta.weight_class} · até ${luta.weight_limit_lbs} lb`));
  return bloco;
}

function montarOndeAssistir(broadcast) {
  const dd = el('dd');
  if (broadcast.length === 0) {
    dd.textContent = 'A confirmar';
    return dd;
  }
  broadcast.forEach((canal, i) => {
    if (i > 0) dd.append(', ');
    if (canal.url) {
      const link = el('a', null, canal.name);
      link.href = canal.url;
      link.target = '_blank';
      link.rel = 'noopener';
      dd.append(link);
    } else {
      dd.append(canal.name);
    }
  });
  return dd;
}

function montarFonte(sourceUrl) {
  const dd = el('dd');
  if (sourceUrl) {
    const link = el('a', null, 'Ver no site oficial ↗');
    link.href = sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    dd.append(link);
  } else {
    dd.textContent = 'A confirmar';
  }
  return dd;
}

function montarEtiquetas(evento) {
  const etiquetas = el('div', 'evento-etiquetas');
  etiquetas.append(el('span', 'etiqueta', evento.organization));
  if (NOMES_STATUS[evento.status]) etiquetas.append(el('span', 'etiqueta', NOMES_STATUS[evento.status]));
  if (evento.is_sample) etiquetas.append(el('span', 'etiqueta etiqueta-exemplo', 'Exemplo'));
  return etiquetas;
}

function lutaPrincipal(evento) {
  return evento.fights.find((luta) => luta.card_section === 'main_event') || evento.fights[0];
}

// Também usado pelo calendário (js/calendario.js).
function montarEvento(evento, fuso) {
  const item = el('li', 'evento');
  item.append(montarEtiquetas(evento));

  item.append(
    el('h2', 'evento-nome', evento.name),
    el('p', 'evento-data', formatarDataHora(evento.starts_at, fuso)),
    el('p', 'evento-local', formatarLocal(evento.venue)),
  );

  const principal = lutaPrincipal(evento);
  if (principal) item.append(montarLutaPrincipal(principal));

  const detalhes = el('dl', 'evento-detalhes');
  detalhes.append(el('dt', null, 'Onde assistir'), montarOndeAssistir(evento.broadcast));
  detalhes.append(el('dt', null, 'Fonte oficial'), montarFonte(evento.source_url));
  item.append(detalhes);

  return item;
}

// Destaque do próximo evento: faixa escura no topo da aba Eventos, com contagem regressiva.

// O destaque ignora o filtro: é sempre o próximo evento agendado ou ao vivo, de qualquer organização.
// Eventos adiados e cancelados ficam só na lista.
function escolherDestaque(proximos) {
  return proximos.find((evento) => evento.status === 'scheduled' || evento.status === 'live') || null;
}

// Primeira letra do primeiro e do último nome (ex.: "Gabriel Silva" vira "GS").
function iniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return `${partes[0].charAt(0)}${ultima}`.toUpperCase();
}

function dividirTempo(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

function pluralizar(quantidade, singular, plural) {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

// Os números mudam a cada segundo e ficam escondidos dos leitores de tela. O texto equivalente
// só muda de minuto em minuto e não tem aria-live, então nada é anunciado sozinho.
function montarContagem(evento) {
  const inicio = new Date(evento.starts_at).getTime();
  const bloco = el('div', 'contagem');
  const rotulo = el('p', 'contagem-rotulo', 'Começa em');

  const caixas = el('div', 'contagem-caixas');
  caixas.setAttribute('aria-hidden', 'true');
  const numeros = {};
  [['dias', 'Dias'], ['horas', 'Horas'], ['minutos', 'Min'], ['segundos', 'Seg']].forEach(([chave, nome]) => {
    numeros[chave] = el('span', 'contagem-numero', '00');
    const caixa = el('div', 'contagem-caixa');
    caixa.append(numeros[chave], el('span', 'contagem-unidade', nome));
    caixas.append(caixa);
  });

  const textoLeitor = el('p', 'so-leitor');
  const andamento = el('p', 'contagem-andamento', 'Em andamento');
  andamento.hidden = true;
  bloco.append(rotulo, caixas, textoLeitor, andamento);

  // Devolve false quando a contagem acabou (o evento já começou ou está ao vivo).
  function atualizar() {
    const restante = inicio - Date.now();
    if (restante <= 0 || evento.status === 'live') {
      rotulo.hidden = true;
      caixas.hidden = true;
      textoLeitor.textContent = '';
      andamento.hidden = false;
      return false;
    }
    const tempo = dividirTempo(restante);
    Object.keys(numeros).forEach((chave) => {
      numeros[chave].textContent = String(tempo[chave]).padStart(2, '0');
    });
    const texto = `Começa em ${pluralizar(tempo.dias, 'dia', 'dias')}, ${pluralizar(tempo.horas, 'hora', 'horas')} e ${pluralizar(tempo.minutos, 'minuto', 'minutos')}`;
    if (textoLeitor.textContent !== texto) textoLeitor.textContent = texto;
    return true;
  }

  return { elemento: bloco, atualizar };
}

// O círculo com as iniciais é só decorativo: o nome do lutador aparece logo abaixo.
function montarLutadorDestaque(lutador) {
  const bloco = el('div', 'destaque-lutador');
  const avatar = el('span', 'destaque-avatar', iniciais(lutador.name));
  avatar.setAttribute('aria-hidden', 'true');
  bloco.append(avatar, el('span', 'destaque-lutador-nome', lutador.name));
  if (lutador.record) bloco.append(el('span', 'destaque-lutador-cartel', formatarCartel(lutador.record)));
  return bloco;
}

function montarLutaDestaque(luta) {
  const painel = el('div', 'destaque-luta');
  painel.append(el('p', 'luta-rotulo', 'Luta principal'));

  const confronto = el('div', 'destaque-confronto');
  confronto.append(
    montarLutadorDestaque(luta.fighters[0]),
    el('span', 'versus', 'vs'),
    montarLutadorDestaque(luta.fighters[1]),
  );
  painel.append(confronto, el('p', 'luta-categoria', `${luta.weight_class} · até ${luta.weight_limit_lbs} lb`));
  return painel;
}

let temporizadorDestaque = null;
let destaqueAtualId = null;
let painelAtivo = 'painel-agenda';

function mostrarDestaque(evento, fuso) {
  clearInterval(temporizadorDestaque);
  destaqueAtualId = evento ? evento.id : null;
  const secao = document.getElementById('hero-destaque');

  if (!evento) {
    secao.replaceChildren();
    secao.hidden = true;
    atualizarFaixa();
    return;
  }

  const contagem = montarContagem(evento);
  const info = el('div', 'destaque-info');
  info.append(
    el('p', 'destaque-rotulo', 'Próximo evento'),
    montarEtiquetas(evento),
    el('h2', 'destaque-nome', evento.name),
    el('p', 'destaque-data', formatarDataHora(evento.starts_at, fuso)),
    el('p', 'destaque-local', formatarLocal(evento.venue)),
    contagem.elemento,
  );

  const links = el('dl', 'destaque-links');
  links.append(el('dt', null, 'Onde assistir'), montarOndeAssistir(evento.broadcast));
  links.append(el('dt', null, 'Fonte oficial'), montarFonte(evento.source_url));
  info.append(links);

  const partes = [info];
  const luta = lutaPrincipal(evento);
  if (luta) partes.push(montarLutaDestaque(luta));
  secao.replaceChildren(...partes);
  secao.hidden = false;
  atualizarFaixa();

  if (contagem.atualizar()) {
    temporizadorDestaque = setInterval(() => {
      if (!contagem.atualizar()) clearInterval(temporizadorDestaque);
    }, 1000);
  }
}

// A faixa mostra o destaque na aba Eventos (se houver) e o texto geral no Calendário.
// Nas abas Sobre e Guia ela não aparece.
function atualizarFaixa() {
  const hero = document.getElementById('hero');
  hero.hidden = painelAtivo === 'painel-sobre' || painelAtivo === 'painel-guia';
  const temDestaque = !document.getElementById('hero-destaque').hidden;
  hero.dataset.modo = temDestaque && painelAtivo === 'painel-agenda' ? 'evento' : 'geral';
}

const ORDEM_ORGANIZACOES = ['UFC', 'PFL', 'ONE'];

// Organizações marcadas no filtro. Vazio = mostra todas.
const organizacoesMarcadas = new Set();

function posicaoOrganizacao(organizacao) {
  const posicao = ORDEM_ORGANIZACOES.indexOf(organizacao);
  return posicao === -1 ? ORDEM_ORGANIZACOES.length : posicao;
}

function passaNoFiltro(evento) {
  return organizacoesMarcadas.size === 0 || organizacoesMarcadas.has(evento.organization);
}

function mostrarAgenda(dados) {
  const status = document.getElementById('agenda-status');
  const lista = document.getElementById('lista-eventos');
  const fuso = dados.display_timezone || FUSO_PADRAO;
  const agora = Date.now();

  document.getElementById('ultima-atualizacao').textContent = formatarDataSimples(dados.last_updated);

  const proximos = dados.events
    .filter((evento) => eventoVisivel(evento, agora))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  // O destaque não muda com o filtro; só é remontado quando o próximo evento passa a ser outro.
  const destaque = escolherDestaque(proximos);
  if ((destaque ? destaque.id : null) !== destaqueAtualId) mostrarDestaque(destaque, fuso);

  if (proximos.length === 0) {
    lista.replaceChildren();
    status.textContent = 'Nenhum evento futuro na agenda no momento. Volte em breve: a agenda é revisada com frequência.';
    return;
  }

  const filtrados = proximos.filter(passaNoFiltro);
  atualizarBotoesFiltro();
  lista.replaceChildren(...filtrados.map((evento) => montarEvento(evento, fuso)));
  status.textContent = filtrados.length === 0 ? 'Nenhum evento das organizações selecionadas no momento.' : '';
}

// Botões: "Todos" e uma opção por organização presente nos dados.
function montarBotoesFiltro(dados) {
  const organizacoes = [...new Set(dados.events.map((evento) => evento.organization))]
    .sort((a, b) => posicaoOrganizacao(a) - posicaoOrganizacao(b));

  const todos = el('button', 'filtro', 'Todos');
  todos.dataset.organizacao = 'todos';
  const botoes = [todos];
  organizacoes.forEach((organizacao) => {
    const botao = el('button', 'filtro', organizacao);
    botao.dataset.organizacao = organizacao;
    botoes.push(botao);
  });

  botoes.forEach((botao) => {
    botao.type = 'button';
    botao.addEventListener('click', () => {
      const organizacao = botao.dataset.organizacao;
      if (organizacao === 'todos') {
        organizacoesMarcadas.clear();
      } else if (organizacoesMarcadas.has(organizacao)) {
        organizacoesMarcadas.delete(organizacao);
      } else {
        organizacoesMarcadas.add(organizacao);
      }
      atualizarAgenda(dados);
    });
  });

  const filtros = document.getElementById('filtros');
  filtros.replaceChildren(...botoes);
  filtros.hidden = false;
}

function atualizarBotoesFiltro() {
  document.querySelectorAll('#filtros [data-organizacao]').forEach((botao) => {
    const ativo = botao.dataset.organizacao === 'todos'
      ? organizacoesMarcadas.size === 0
      : organizacoesMarcadas.has(botao.dataset.organizacao);
    botao.setAttribute('aria-pressed', String(ativo));
  });
}

// Atualizado em carregarEventos, depois que o calendário é montado.
let atualizarCalendario = null;

function atualizarAgenda(dados) {
  mostrarAgenda(dados);
  if (atualizarCalendario) atualizarCalendario();
}

async function carregarDoJson() {
  const resposta = await fetch('data/eventos.json', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  return resposta.json();
}

// O cartel só existe se o banco tiver ao menos V-D-E; senão fica null, como no JSON.
function montarRecord(linha) {
  if (linha.wins === null || linha.losses === null || linha.draws === null) return null;
  return { wins: linha.wins, losses: linha.losses, draws: linha.draws, no_contests: linha.no_contests };
}

// Converte as linhas do banco para o mesmo formato do data/eventos.json.
function converterEvento(linha) {
  const lutas = [...linha.fights].sort((a, b) => a.order - b.order).map((luta) => ({
    order: luta.order,
    card_section: luta.card_section,
    weight_class: luta.weight_class,
    weight_limit_lbs: luta.weight_limit_lbs,
    fighters: [...luta.fight_fighters].sort((a, b) => a.position - b.position).map((lutador) => ({
      name: lutador.name,
      nationality: lutador.nationality,
      record: montarRecord(lutador),
      height_ft: lutador.height_ft,
      reach_in: lutador.reach_in,
    })),
  }));

  return {
    id: linha.id,
    is_sample: linha.is_sample,
    organization: linha.organization,
    name: linha.name,
    starts_at: new Date(linha.starts_at).toISOString(),
    status: linha.status,
    venue: { name: linha.venue_name, city: linha.venue_city, country: linha.venue_country },
    broadcast: linha.event_broadcasts.map(({ name, type, url }) => ({ name, type, url })),
    source_url: linha.source_url,
    fights: lutas,
  };
}

async function carregarDoSupabase() {
  const consulta = 'select=*,event_broadcasts(*),fights(*,fight_fighters(*))&order=starts_at';
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/events?${consulta}`, {
    headers: { apikey: SUPABASE_CHAVE_PUBLICA },
    signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
  });
  if (!resposta.ok) throw new Error(`Supabase HTTP ${resposta.status}`);
  const linhas = await resposta.json();
  if (!Array.isArray(linhas) || linhas.length === 0) throw new Error('Supabase devolveu zero eventos');

  // A data de revisão ainda não está no banco: vem do JSON (se ele não carregar, fica sem data).
  const json = await carregarDoJson().catch(() => ({}));
  return {
    last_updated: json.last_updated,
    display_timezone: json.display_timezone || FUSO_PADRAO,
    events: linhas.map(converterEvento),
  };
}

async function carregarDados() {
  try {
    return await carregarDoSupabase();
  } catch (erro) {
    console.warn('Supabase indisponível, usando data/eventos.json:', erro);
    return carregarDoJson();
  }
}

async function carregarEventos() {
  try {
    const dados = await carregarDados();
    montarBotoesFiltro(dados);
    mostrarAgenda(dados);
    atualizarCalendario = montarCalendario(dados).atualizar; // definido em js/calendario.js
  } catch (erro) {
    console.error('Erro ao carregar eventos:', erro);
    const mensagem = 'Não foi possível carregar os eventos. Tente recarregar a página.';
    document.getElementById('agenda-status').textContent = mensagem;
    document.getElementById('calendario-status').textContent = mensagem;
  }
}

function configurarAbas() {
  const abas = Array.from(document.querySelectorAll('[role="tab"]'));

  function ativar(aba) {
    abas.forEach((outra) => {
      const ativa = outra === aba;
      outra.setAttribute('aria-selected', String(ativa));
      outra.tabIndex = ativa ? 0 : -1;
      document.getElementById(outra.getAttribute('aria-controls')).hidden = !ativa;
    });
    // O filtro por organização só vale para Eventos e Calendário.
    const painel = aba.getAttribute('aria-controls');
    painelAtivo = painel;
    atualizarFaixa();
    const usaFiltro = painel === 'painel-agenda' || painel === 'painel-calendario';
    document.getElementById('filtros').classList.toggle('filtros-oculto', !usaFiltro);
  }

  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => ativar(aba));
    aba.addEventListener('keydown', (evento) => {
      if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
      const passo = evento.key === 'ArrowRight' ? 1 : -1;
      const proxima = abas[(i + passo + abas.length) % abas.length];
      ativar(proxima);
      proxima.focus();
    });
  });
}

// Menu hambúrguer (só aparece no celular): abre/fecha a lista de links.
function configurarMenu() {
  const botao = document.getElementById('menu-botao');
  const barra = document.querySelector('.barra-interna');

  function definir(aberto) {
    barra.classList.toggle('menu-aberto', aberto);
    botao.setAttribute('aria-expanded', String(aberto));
  }

  botao.addEventListener('click', () => {
    definir(botao.getAttribute('aria-expanded') !== 'true');
  });

  // Escolher um item fecha o menu.
  document.querySelectorAll('[role="tab"]').forEach((aba) => {
    aba.addEventListener('click', () => definir(false));
  });

  // Esc fecha e devolve o foco ao botão.
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && barra.classList.contains('menu-aberto')) {
      definir(false);
      botao.focus();
    }
  });

  // Tocar fora do menu fecha.
  document.addEventListener('click', (evento) => {
    if (!barra.contains(evento.target)) definir(false);
  });
}

configurarAbas();
configurarMenu();
carregarEventos();
