// Fight Club — carrega data/eventos.json e monta a agenda.

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
  bloco.append(
    el('span', 'lutador-nome', lutador.name),
    el('span', 'lutador-cartel', formatarCartel(lutador.record)),
  );
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

// Também usado pelo calendário (js/calendario.js).
function montarEvento(evento, fuso) {
  const item = el('li', 'evento');

  const etiquetas = el('div', 'evento-etiquetas');
  if (NOMES_STATUS[evento.status]) etiquetas.append(el('span', 'etiqueta', NOMES_STATUS[evento.status]));
  if (evento.is_sample) etiquetas.append(el('span', 'etiqueta etiqueta-exemplo', 'Exemplo'));
  if (etiquetas.childElementCount > 0) item.append(etiquetas);

  item.append(
    el('h2', 'evento-nome', evento.name),
    el('p', 'evento-data', formatarDataHora(evento.starts_at, fuso)),
    el('p', 'evento-local', formatarLocal(evento.venue)),
  );

  const principal = evento.fights.find((luta) => luta.card_section === 'main_event') || evento.fights[0];
  if (principal) item.append(montarLutaPrincipal(principal));

  const detalhes = el('dl', 'evento-detalhes');
  detalhes.append(el('dt', null, 'Onde assistir'), montarOndeAssistir(evento.broadcast));
  detalhes.append(el('dt', null, 'Fonte oficial'), montarFonte(evento.source_url));
  item.append(detalhes);

  return item;
}

// "UFC 333: ..." é evento numerado; os demais (UFC Fight Night, UFC Edmonton...) contam como Fight Night.
function tipoDoEvento(evento) {
  return /^UFC \d+\b/.test(evento.name) ? 'numerado' : 'fight-night';
}

let filtroAtual = 'todos';

function mostrarAgenda(dados) {
  const status = document.getElementById('agenda-status');
  const lista = document.getElementById('lista-eventos');
  const filtros = document.getElementById('filtros');
  const fuso = dados.display_timezone || FUSO_PADRAO;
  const agora = Date.now();

  document.getElementById('ultima-atualizacao').textContent = formatarDataSimples(dados.last_updated);

  const proximos = dados.events
    .filter((evento) => eventoVisivel(evento, agora))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  if (proximos.length === 0) {
    filtros.hidden = true;
    lista.replaceChildren();
    status.textContent = 'Nenhum evento futuro na agenda no momento. Volte em breve: a agenda é revisada com frequência.';
    return;
  }

  const filtrados = proximos.filter((evento) => filtroAtual === 'todos' || tipoDoEvento(evento) === filtroAtual);
  filtros.hidden = false;
  filtros.querySelectorAll('[data-filtro]').forEach((botao) => {
    botao.setAttribute('aria-pressed', String(botao.dataset.filtro === filtroAtual));
  });
  lista.replaceChildren(...filtrados.map((evento) => montarEvento(evento, fuso)));
  status.textContent = filtrados.length === 0 ? 'Nenhum evento deste tipo na agenda no momento.' : '';
}

function configurarFiltros(dados) {
  document.querySelectorAll('#filtros [data-filtro]').forEach((botao) => {
    botao.addEventListener('click', () => {
      filtroAtual = botao.dataset.filtro;
      mostrarAgenda(dados);
    });
  });
}

async function carregarEventos() {
  try {
    const resposta = await fetch('data/eventos.json', { cache: 'no-store' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados = await resposta.json();
    configurarFiltros(dados);
    mostrarAgenda(dados);
    montarCalendario(dados); // definido em js/calendario.js
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
