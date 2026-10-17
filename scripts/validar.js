// Valida data/eventos.json antes de cada commit.
// Uso: node scripts/validar.js [caminho/do/arquivo.json]
// Termina com falha (código 1) se houver erro. Avisos não bloqueiam.

const fs = require('fs');
const path = require('path');

const arquivo = process.argv[2] || path.join(__dirname, '..', 'data', 'eventos.json');

const STATUS = ['scheduled', 'live', 'completed', 'cancelled', 'postponed'];
const CARD_SECTIONS = ['main_event', 'co_main', 'main_card', 'prelims', 'early_prelims'];
const BROADCAST_TYPES = ['streaming', 'tv'];
const CAMPOS_RECORD = ['wins', 'losses', 'draws', 'no_contests'];
const DIAS_MAXIMOS_SEM_ATUALIZAR = 7;

const erros = [];
const avisos = [];

function textoPreenchido(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

function ehObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function ehLink(valor) {
  return typeof valor === 'string' && /^https?:\/\/\S+$/.test(valor);
}

// Confere formato AAAA-MM-DD e se a data existe de verdade (ex.: rejeita 2026-02-30).
function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(valor + 'T00:00:00Z');
  return !isNaN(data) && data.toISOString().slice(0, 10) === valor;
}

// Confere data e hora em UTC terminando em Z (ex.: 2026-10-18T00:00:00Z).
function dataHoraUtcValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(valor)) return false;
  const data = new Date(valor);
  return !isNaN(data) && data.toISOString().slice(0, 19) === valor.slice(0, 19);
}

function validarLutador(lutador, onde) {
  if (!ehObjeto(lutador)) {
    erros.push(`${onde}: o lutador precisa ser um objeto`);
    return;
  }
  if (!textoPreenchido(lutador.name)) erros.push(`${onde}: o campo name está vazio`);
  if (!textoPreenchido(lutador.nationality)) erros.push(`${onde}: o campo nationality está vazio`);

  if (!ehObjeto(lutador.record)) {
    erros.push(`${onde}: o campo record está faltando`);
    return;
  }
  for (const campo of CAMPOS_RECORD) {
    const valor = lutador.record[campo];
    if (!Number.isInteger(valor) || valor < 0) {
      erros.push(`${onde}: o campo record.${campo} precisa ser um número inteiro, 0 ou mais`);
    }
  }
}

function validarLuta(luta, posicao, ordensVistas, rotuloEvento) {
  const onde = `${rotuloEvento}, luta ${posicao + 1}`;
  if (!ehObjeto(luta)) {
    erros.push(`${onde}: a luta precisa ser um objeto`);
    return;
  }

  if (!Number.isInteger(luta.order)) {
    erros.push(`${onde}: o campo order precisa ser um número inteiro`);
  } else if (ordensVistas.has(luta.order)) {
    erros.push(`${onde}: o campo order ${luta.order} está repetido`);
  } else if (luta.order !== posicao + 1) {
    erros.push(`${onde}: o campo order está fora de sequência (esperado ${posicao + 1}, encontrado ${luta.order})`);
  }
  ordensVistas.add(luta.order);

  if (!CARD_SECTIONS.includes(luta.card_section)) {
    erros.push(`${onde}: o campo card_section tem valor inválido (use: ${CARD_SECTIONS.join(', ')})`);
  } else if (posicao === 0 && luta.card_section !== 'main_event') {
    erros.push(`${onde}: a primeira luta precisa ser main_event`);
  }

  if (!textoPreenchido(luta.weight_class)) erros.push(`${onde}: o campo weight_class está vazio`);
  if (typeof luta.weight_limit_lbs !== 'number' || !isFinite(luta.weight_limit_lbs)) {
    erros.push(`${onde}: o campo weight_limit_lbs precisa ser um número`);
  }

  if (!Array.isArray(luta.fighters) || luta.fighters.length !== 2) {
    erros.push(`${onde}: a luta precisa ter exatamente 2 lutadores`);
    return;
  }
  luta.fighters.forEach((lutador, i) => validarLutador(lutador, `${onde}, lutador ${i + 1}`));
}

function validarEvento(evento, posicao, idsVistos, agora) {
  if (!ehObjeto(evento)) {
    erros.push(`Evento ${posicao + 1}: o evento precisa ser um objeto`);
    return;
  }

  const rotulo = textoPreenchido(evento.id) ? `Evento ${evento.id}` : `Evento ${posicao + 1}`;

  if (!textoPreenchido(evento.id)) {
    erros.push(`${rotulo}: o campo id está vazio`);
  } else if (/\s/.test(evento.id)) {
    erros.push(`${rotulo}: o campo id não pode ter espaços`);
  } else if (idsVistos.has(evento.id)) {
    erros.push(`${rotulo}: o campo id está repetido`);
  }
  idsVistos.add(evento.id);

  const ehExemplo = evento.is_sample === true;
  if (ehExemplo) {
    avisos.push(`${rotulo}: é um evento de exemplo (is_sample: true). São dados de teste e não podem ir ao ar como dados reais`);
  }

  if (evento.organization !== 'UFC') erros.push(`${rotulo}: o campo organization precisa ser "UFC"`);
  if (!textoPreenchido(evento.name)) erros.push(`${rotulo}: o campo name está vazio`);

  if (!dataHoraUtcValida(evento.starts_at)) {
    erros.push(`${rotulo}: o campo starts_at precisa ser data e hora em UTC terminando em Z (ex.: 2026-10-18T00:00:00Z)`);
  }

  if (!STATUS.includes(evento.status)) {
    erros.push(`${rotulo}: o campo status tem valor inválido (use: ${STATUS.join(', ')})`);
  } else if (evento.status === 'scheduled' && dataHoraUtcValida(evento.starts_at) && new Date(evento.starts_at) < agora) {
    avisos.push(`${rotulo}: está como scheduled, mas a data ${evento.starts_at} já passou`);
  }

  if (!ehObjeto(evento.venue) || !textoPreenchido(evento.venue.name)) {
    erros.push(`${rotulo}: o campo venue.name está vazio`);
  }

  if (!Array.isArray(evento.broadcast)) {
    erros.push(`${rotulo}: o campo broadcast precisa ser uma lista`);
  } else {
    evento.broadcast.forEach((item, i) => {
      const onde = `${rotulo}, broadcast ${i + 1}`;
      if (!ehObjeto(item) || !textoPreenchido(item.name)) {
        erros.push(`${onde}: o campo name está vazio`);
      }
      if (!ehObjeto(item) || !BROADCAST_TYPES.includes(item.type)) {
        erros.push(`${onde}: o campo type tem valor inválido (use: ${BROADCAST_TYPES.join(', ')})`);
      }
    });
  }

  if (evento.source_url === null || evento.source_url === undefined) {
    if (!ehExemplo) erros.push(`${rotulo}: o campo source_url é obrigatório para eventos reais (is_sample: false)`);
  } else if (!ehLink(evento.source_url)) {
    erros.push(`${rotulo}: o campo source_url precisa ser null ou um link http(s)`);
  }

  if (!Array.isArray(evento.fights) || evento.fights.length === 0) {
    erros.push(`${rotulo}: o evento não tem lutas`);
    return;
  }
  const ordensVistas = new Set();
  evento.fights.forEach((luta, i) => validarLuta(luta, i, ordensVistas, rotulo));
}

function validar(dados) {
  const agora = new Date();

  if (!ehObjeto(dados)) {
    erros.push('O arquivo precisa conter um objeto com last_updated e events');
    return;
  }

  if (!dataValida(dados.last_updated)) {
    erros.push('O campo last_updated precisa estar no formato AAAA-MM-DD (ex.: 2026-10-16)');
  } else {
    const dias = Math.floor((agora - new Date(dados.last_updated + 'T00:00:00Z')) / 86400000);
    if (dias > DIAS_MAXIMOS_SEM_ATUALIZAR) {
      avisos.push(`O campo last_updated (${dados.last_updated}) tem ${dias} dias. Revise os dados`);
    }
  }

  if (!Array.isArray(dados.events) || dados.events.length === 0) {
    erros.push('A lista de eventos (events) está vazia');
    return;
  }

  const idsVistos = new Set();
  dados.events.forEach((evento, i) => validarEvento(evento, i, idsVistos, agora));
}

let conteudo;
try {
  conteudo = fs.readFileSync(arquivo, 'utf8');
} catch (e) {
  console.error(`ERRO: não consegui abrir o arquivo ${arquivo}`);
  process.exit(1);
}

let dados;
try {
  dados = JSON.parse(conteudo.replace(/^﻿/, ''));
} catch (e) {
  console.error(`ERRO: o arquivo ${arquivo} não é um JSON válido (${e.message})`);
  process.exit(1);
}

validar(dados);

console.log(`Validando ${path.relative(process.cwd(), arquivo) || arquivo}`);

if (avisos.length > 0) {
  console.log(`\n${avisos.length} aviso(s):`);
  avisos.forEach((a) => console.log(`  AVISO: ${a}`));
}

if (erros.length > 0) {
  console.error(`\n${erros.length} erro(s):`);
  erros.forEach((e) => console.error(`  ERRO: ${e}`));
  console.error('\nValidação falhou. Corrija os erros acima.');
  process.exit(1);
}

console.log('\nValidação passou.');
