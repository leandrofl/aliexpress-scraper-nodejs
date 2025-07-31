import {
  MIN_SALES,
  MIN_REVIEWS,
  MIN_RATING,
  MIN_ORDERS
} from '../config.js';

/**
 * Aplica os filtros quantitativos ao produto.
 * Retorna `true` se aprovado em todos os critérios.
 */
export function applyQuantitativeFilter(produto) {
  const criterios = {
    vendasMinimas: avaliarVendas(produto.vendas),
    avaliacoesMinimas: avaliarAvaliacoes(produto.avaliacoes),
    notaMinima: avaliarNota(produto.nota),
    pedidosMinimos: avaliarPedidos(produto.pedidos)
  };

  const aprovado = Object.values(criterios).every(Boolean);

  return {
    ...criterios,
    aprovado
  };
}

// ===== Critérios quantitativos individuais =====

function avaliarVendas(vendasStr) {
  if (!vendasStr) return false;
  const vendas = extrairNumero(vendasStr);
  return vendas >= MIN_SALES;
}

function avaliarAvaliacoes(avaliacoes) {
  if (!avaliacoes) return false;
  return Number(avaliacoes) >= MIN_REVIEWS;
}

function avaliarNota(nota) {
  if (!nota) return false;
  return Number(nota) >= MIN_RATING;
}

function avaliarPedidos(pedidos) {
  if (!pedidos) return false;
  return Number(pedidos) >= MIN_ORDERS;
}

// Utilitário: extrai número de string
function extrairNumero(texto) {
  const clean = (texto || '').replace(/[^\d]/g, '');
  return parseInt(clean || '0');
}
