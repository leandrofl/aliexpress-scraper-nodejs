/**
 * FILTROS QUANTITATIVOS MELHORADOS
 * Sistema inteligente com score ponderado e filtros por categoria
 */

import {
  MIN_SALES,
  MIN_REVIEWS,
  MIN_RATING,
  MIN_ORDERS
} from '../config.js';

// Configurações por categoria
const CATEGORY_CONFIGS = {
  'Casa e Cozinha': {
    minSales: 300,
    minReviews: 30,
    minRating: 4.2,
    minOrders: 80,
    weights: { sales: 0.3, reviews: 0.2, rating: 0.3, orders: 0.2 }
  },
  'Tecnologia': {
    minSales: 500,
    minReviews: 50,
    minRating: 4.4,
    minOrders: 150,
    weights: { sales: 0.25, reviews: 0.25, rating: 0.35, orders: 0.15 }
  },
  'Beleza': {
    minSales: 400,
    minReviews: 40,
    minRating: 4.3,
    minOrders: 100,
    weights: { sales: 0.2, reviews: 0.3, rating: 0.4, orders: 0.1 }
  },
  'default': {
    minSales: MIN_SALES,
    minReviews: MIN_REVIEWS,
    minRating: MIN_RATING,
    minOrders: MIN_ORDERS,
    weights: { sales: 0.25, reviews: 0.25, rating: 0.25, orders: 0.25 }
  }
};

/**
 * Aplica filtros quantitativos melhorados com score ponderado
 */
export function applyQuantitativeFilter(produto) {
  const categoria = produto.categoria || 'default';
  const config = CATEGORY_CONFIGS[categoria] || CATEGORY_CONFIGS['default'];
  
  // Extrair valores numéricos
  const vendas = extrairNumero(produto.vendas);
  const avaliacoes = Number(produto.avaliacoes || 0);
  const nota = Number(produto.nota || 0);
  const pedidos = Number(produto.pedidos || 0);
  
  // Critérios básicos (passa/falha)
  const criterios = {
    vendasMinimas: vendas >= config.minSales,
    avaliacoesMinimas: avaliacoes >= config.minReviews,
    notaMinima: nota >= config.minRating,
    pedidosMinimos: pedidos >= config.minOrders
  };
  
  // Calcular scores individuais (0-100)
  const scores = {
    vendas: Math.min(100, (vendas / config.minSales) * 50),
    avaliacoes: Math.min(100, (avaliacoes / config.minReviews) * 50),
    nota: Math.min(100, (nota / 5.0) * 100),
    pedidos: Math.min(100, (pedidos / config.minOrders) * 50)
  };
  
  // Score ponderado final
  const scoreFinal = (
    scores.vendas * config.weights.sales +
    scores.avaliacoes * config.weights.reviews +
    scores.nota * config.weights.rating +
    scores.pedidos * config.weights.orders
  );
  
  // Aprovação: critérios básicos OU score alto (≥70)
  const aprovadoCriterios = Object.values(criterios).every(Boolean);
  const aprovadoScore = scoreFinal >= 70;
  const aprovado = aprovadoCriterios || aprovadoScore;
  
  return {
    ...criterios,
    scores,
    scoreFinal: Math.round(scoreFinal),
    aprovado,
    motivoAprovacao: aprovadoCriterios ? 'Critérios básicos' : 'Score ponderado',
    categoria: categoria,
    config: config
  };
}

// Utilitário: extrai número de string
function extrairNumero(texto) {
  // Garantir que é string antes de aplicar replace
  if (typeof texto !== 'string') {
    texto = String(texto || '');
  }
  const clean = (texto || '').replace(/[^\d]/g, '');
  return parseInt(clean || '0');
}
