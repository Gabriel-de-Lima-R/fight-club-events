// Fight Club — calendário mensal.
// Usa el(), montarEvento() e FUSO_PADRAO de js/app.js.

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Data do evento (AAAA-MM-DD) no fuso de exibição. Ex.: 2026-10-18T00:00:00Z vira 2026-10-17 em Brasília.
function chaveDoDia(data, fuso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(data);
}

function montarChave(ano, mes, dia) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function nomeDoMes(ano, mes) {
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ano, mes, 1)));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

function nomeDoDia(chave) {
  const [ano, mes, dia] = chave.split('-').map(Number);
  const nome = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, mes - 1, dia)));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
}

function montarCalendario(dados) {
  const fuso = dados.display_timezone || FUSO_PADRAO;
  const hoje = chaveDoDia(new Date(), fuso);

  let eventosPorDia = new Map();

  // Agrupa os eventos que passam no filtro por dia (no horário de Brasília).
  function agruparEventos() {
    eventosPorDia = new Map();
    dados.events
      .filter(passaNoFiltro)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
      .forEach((evento) => {
        const chave = chaveDoDia(new Date(evento.starts_at), fuso);
        if (!eventosPorDia.has(chave)) eventosPorDia.set(chave, []);
        eventosPorDia.get(chave).push(evento);
      });
  }

  agruparEventos();

  const estado = {
    ano: Number(hoje.slice(0, 4)),
    mes: Number(hoje.slice(5, 7)) - 1,
    selecionado: eventosPorDia.has(hoje) ? hoje : null,
  };

  const elTitulo = document.getElementById('cal-titulo');
  const elGrade = document.getElementById('cal-grade');
  const elDetalhe = document.getElementById('cal-detalhe');
  document.getElementById('calendario-status').textContent = '';
  document.getElementById('calendario').hidden = false;

  function mudarMes(passo) {
    const data = new Date(Date.UTC(estado.ano, estado.mes + passo, 1));
    estado.ano = data.getUTCFullYear();
    estado.mes = data.getUTCMonth();
    estado.selecionado = null;
    desenhar();
  }

  function desenharGrade() {
    elTitulo.textContent = nomeDoMes(estado.ano, estado.mes);

    const celulas = DIAS_SEMANA.map((nome) => el('div', 'cal-dia-semana', nome));

    const primeiroDiaSemana = new Date(Date.UTC(estado.ano, estado.mes, 1)).getUTCDay();
    const diasNoMes = new Date(Date.UTC(estado.ano, estado.mes + 1, 0)).getUTCDate();

    for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(el('div', 'cal-vazio'));

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const chave = montarChave(estado.ano, estado.mes, dia);
      const eventos = eventosPorDia.get(chave);
      let celula;

      if (eventos) {
        celula = el('button', 'cal-dia tem-evento', String(dia));
        celula.type = 'button';
        celula.setAttribute('aria-pressed', String(chave === estado.selecionado));
        celula.setAttribute('aria-label', `${nomeDoDia(chave)}, ${eventos.length} evento${eventos.length > 1 ? 's' : ''}`);
        celula.addEventListener('click', () => {
          estado.selecionado = chave;
          desenhar();
          elDetalhe.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      } else {
        celula = el('div', 'cal-dia', String(dia));
      }

      if (chave < hoje) celula.classList.add('passado');
      if (chave === hoje) {
        celula.classList.add('hoje');
        celula.setAttribute('aria-current', 'date');
      }
      celulas.push(celula);
    }

    elGrade.replaceChildren(...celulas);
  }

  function desenharDetalhe() {
    if (!estado.selecionado) {
      const prefixo = montarChave(estado.ano, estado.mes, 1).slice(0, 8);
      const temEventoNoMes = Array.from(eventosPorDia.keys()).some((chave) => chave.startsWith(prefixo));
      elDetalhe.replaceChildren(el('p', 'mensagem', temEventoNoMes
        ? 'Toque num dia marcado para ver o evento e onde assistir.'
        : 'Nenhum evento neste mês.'));
      return;
    }

    const lista = el('ol', 'lista-eventos');
    eventosPorDia.get(estado.selecionado).forEach((evento) => {
      const cartao = montarEvento(evento, fuso);
      if (estado.selecionado < hoje) cartao.classList.add('evento-passado');
      lista.append(cartao);
    });
    elDetalhe.replaceChildren(el('h2', 'cal-detalhe-titulo', nomeDoDia(estado.selecionado)), lista);
  }

  function desenhar() {
    desenharGrade();
    desenharDetalhe();
  }

  document.getElementById('cal-anterior').addEventListener('click', () => mudarMes(-1));
  document.getElementById('cal-proximo').addEventListener('click', () => mudarMes(1));
  document.getElementById('cal-hoje').addEventListener('click', () => {
    estado.ano = Number(hoje.slice(0, 4));
    estado.mes = Number(hoje.slice(5, 7)) - 1;
    estado.selecionado = eventosPorDia.has(hoje) ? hoje : null;
    desenhar();
  });

  // Chamado quando o filtro muda: reagrupa os eventos e redesenha, mantendo o mês exibido.
  function atualizar() {
    agruparEventos();
    if (estado.selecionado && !eventosPorDia.has(estado.selecionado)) estado.selecionado = null;
    desenhar();
  }

  desenhar();
  return { atualizar };
}
