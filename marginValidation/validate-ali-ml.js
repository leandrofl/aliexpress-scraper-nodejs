/**
 * validate-ali-ml.js
 * High-level AliExpress -> Mercado Livre validation pipeline (v1)
 * Reuses existing search, semantic and image similarity, and computes price stats and margin.
 * This is a minimal, safe implementation that can be evolved to support multi-query + pagination.
 */

import { buscarMelhorProdutoML } from './mercado-livre-scraper.js';
import { gerarTermosDeBusca } from '../utils/comparador-produtos.js';
import { searchMLB, enrichMLItem } from './ml-search.js';
import { compararSemantica } from '../utils/analisador-semantico.js';
import { compararImagensPorHash } from '../utils/comparador-imagens.js';

/**
 * @typedef {Object} AliProduct
 * @property {string} url
 * @property {string} title
 * @property {number} price_original // USD
 * @property {number} price_current // USD
 * @property {number} shipping_usd  // USD
 * @property {string[]} images
 * @property {Record<string,string>=} attrs
 * @property {Object=} seller                   // AliExpress seller info (optional)
 * @property {string=} seller.name
 * @property {number=} seller.rating            // 0..5
 * @property {number=} seller.positive_rate     // 0..1
 * @property {number=} seller.followers
 * @property {number=} seller.store_age_months
 */

/**
 * @typedef {Object} Params
 * @property {number} fx_usd_brl
 * @property {number} tax_rate
 * @property {number} ml_fee_rate
 * @property {number} min_margin_brl
 * @property {number} min_margin_pct
 * @property {number} max_pages
 */

/**
 * @typedef {Object} MLMatch
 * @property {string} ml_item_id
 * @property {string} title
 * @property {number} price_brl
 * @property {number=} shipping_brl
 * @property {string=} seller_reputation
 * @property {number=} sold_qty
 * @property {string=} location
 * @property {string[]} images
 * @property {{ image:number; title:number; final:number }} score
 * @property {string} url
 */

/** Normalize AliProduct into our internal shape */
function normalizeAli(ali) {
  return {
    nome: ali?.title || '',
    nomeTraduzido: ali?.title || '',
    precoUSD: ali?.price_current || ali?.price_original || 0,
    shippingUSD: ali?.shipping_usd || 0,
    imagemURL: Array.isArray(ali?.images) && ali.images.length ? ali.images[0] : undefined,
  };
}

/** 0..1 title similarity using semantic analyzer (fallback textual) */
async function titleSimilarity(aliTitle, mlTitle) {
  try {
    const r = await compararSemantica(aliTitle || '', mlTitle || '');
    return Math.max(0, Math.min(1, (r?.score || 0) / 100));
  } catch {
    return 0;
  }
}

/** 0..1 image similarity using pHash */
async function imageSimilarity(aliImgs, mlImgs) {
  const a = (aliImgs || []).find(Boolean);
  const b = (mlImgs || []).find(Boolean);
  if (!a || !b) return 0;
  try {
    const r = await compararImagensPorHash(a, b);
    return Math.max(0, Math.min(1, (r?.similaridade || 0) / 100));
  } catch {
    return 0;
  }
}

/** Compute price stats including quartiles and median */
function priceStats(prices) {
  const arr = (prices || []).map(Number).filter(v => isFinite(v) && v > 0).sort((x,y) => x - y);
  const n = arr.length;
  if (!n) return { min:0, p25:0, median:0, p75:0, max:0 };
  const q = (p) => {
    if (n === 1) return arr[0];
    const pos = (n - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    return arr[base] + (arr[base + 1] - arr[base]) * rest;
  };
  return {
    min: arr[0],
    p25: q(0.25),
    median: q(0.5),
    p75: q(0.75),
    max: arr[n - 1]
  };
}

/** Evaluate costs and margin following the provided formulas */
function evaluateMargin(ali, stats, params) {
  const fx = Number(params.fx_usd_brl || 0);
  const tax = Number(params.tax_rate || 0);
  const fee = Number(params.ml_fee_rate || 0);
  const minBRL = Number(params.min_margin_brl || 0);
  const minPct = Number(params.min_margin_pct || 0);

  const aliPriceUSD = Number(ali.price_current || ali.price_original || 0);
  const shippingUSD = Number(ali.shipping_usd || 0);

  const cost_total_brl = ((aliPriceUSD * fx) + (shippingUSD * fx)) * (1 + tax);
  const target_price_brl = stats?.median || 0;
  let ml_net_brl = target_price_brl * (1 - fee);
  // If you intend to offer free shipping paid by you, subtract here:
  // ml_net_brl -= (your_shipping_cost_brl || 0);

  const margin_brl = ml_net_brl - cost_total_brl;
  const margin_pct = cost_total_brl > 0 ? (margin_brl / cost_total_brl) : 0;
  const meets_threshold = margin_brl >= minBRL && margin_pct >= minPct;

  return { cost_total_brl, target_price_brl, ml_net_brl, margin_brl, margin_pct, meets_threshold };
}

/**
 * Main validation function
 * @param {import('puppeteer').Browser} browser
 * @param {AliProduct} ali
 * @param {Params} params
 * @returns {Promise<{ ali: AliProduct, candidates: MLMatch[], price_stats_brl: any, best: MLMatch|null, evaluation: any, decision: 'OK'|'NOK', notes?: string[] }>}
 */
export async function validateAliToML(browser, ali, params) {
  const notes = [];
  const normalized = normalizeAli(ali);

  // Build query variations: base/strict/broad
  const base = gerarTermosDeBusca(normalized.nomeTraduzido || normalized.nome);
  const tokens = (base || '').split(' ').filter(Boolean);
  const strict = tokens.length >= 2 ? '"' + tokens.slice(0, Math.min(4, tokens.length)).join(' ') + '"' : base;
  const broad = tokens.slice(0, Math.min(3, tokens.length)).join(' ');
  const queries = Array.from(new Set([base, strict, broad].filter(Boolean)));

  // HTTP list search first (fast)
  let lite = [];
  try {
    lite = await searchMLB(queries, { maxPages: Math.max(1, Math.min(3, params?.max_pages || 1)) });
  } catch {}

  // If nothing found, fallback to previous buscarMelhorProdutoML
  let raw = [];
  if (lite.length) {
    // Enrich top N by title similarity prefilter (cheap textual)
    // simple prefilter: Jaccard over tokens
    const aliTokens = new Set((base || '').split(' ').filter(t => t.length > 2));
    const prelim = lite.map(x => {
      const mlTokens = new Set(String(x.title || '').toLowerCase().split(/\s+/g).filter(t => t.length > 2));
      const inter = [...aliTokens].filter(t => mlTokens.has(t)).length;
      const jac = aliTokens.size ? inter / new Set([...aliTokens, ...mlTokens]).size : 0;
      return { item: x, jac };
    }).sort((a,b)=>b.jac - a.jac).slice(0, 10);

    // Enrich details/images with Puppeteer for top prelim
    const enriched = [];
    for (const p of prelim) {
      const add = await enrichMLItem(browser, p.item.url);
      enriched.push({ ...p.item, images: add.images || [], attrs: add.attrs || {}, price_brl: p.item.price_brl || add.price_brl });
    }
    raw = enriched;
  } else {
    const result = await buscarMelhorProdutoML(browser, {
      nome: normalized.nome,
      nomeTraduzido: normalized.nomeTraduzido,
      imagemURL: normalized.imagemURL
    });
    raw = Array.isArray(result?.mlTop3Produtos) ? result.mlTop3Produtos.map(r => ({ title: r.nome, price_brl: r.preco, images: r.imagem ? [r.imagem] : [], url: r.link })) : [];
    if (!raw.length) notes.push('Fallback buscarMelhorProdutoML não encontrou candidatos.');
  }

  // Build candidates with scores
  const aliImgs = Array.isArray(ali?.images) ? ali.images : (normalized.imagemURL ? [normalized.imagemURL] : []);
  const candidates = [];
  for (const item of raw) {
    const tScore = await titleSimilarity(ali.title, item?.title || item?.nome);
    const iScore = await imageSimilarity(aliImgs, item?.images || [item?.imagem]);
    const final = 0.6 * iScore + 0.4 * tScore;
    candidates.push({
      ml_item_id: item?.ml_item_id || '',
      title: item?.title || item?.nome || '',
      price_brl: Number(item?.price_brl || item?.preco || 0),
      images: item?.images || (item?.imagem ? [item.imagem] : []),
      score: { image: iScore, title: tScore, final },
      url: item?.url || item?.link || ''
    });
  }

  // Filter and sort
  const approved = candidates.filter(c => c.score.final >= 0.65).sort((a,b) => b.score.final - a.score.final);
  const best = approved.length ? approved[0] : (candidates.sort((a,b)=>b.score.final - a.score.final)[0] || null);

  // Price stats
  const prices = approved.length ? approved.map(c => c.price_brl) : candidates.map(c => c.price_brl);
  const stats = priceStats(prices);

  // Margin evaluation
  const evaluation = evaluateMargin(ali, stats, params);
  let decision = evaluation.meets_threshold ? 'OK' : 'NOK';
  if (!approved.length) notes.push('Sem match acima do limiar 0.65; usando melhor candidato disponível.');

  // Add AliExpress seller reputation notes (does not affect decision by default)
  if (ali?.seller) {
    const pr = typeof ali.seller.positive_rate === 'number' ? ali.seller.positive_rate : undefined;
    const age = typeof ali.seller.store_age_months === 'number' ? ali.seller.store_age_months : undefined;
    if (pr !== undefined) {
      notes.push(`Ali seller positive rate: ${(pr * 100).toFixed(1)}%.`);
      if (pr < 0.9) notes.push('Atenção: reputação do vendedor AliExpress abaixo de 90%.');
    }
    if (age !== undefined) {
      notes.push(`Ali store age: ${age} meses.`);
      if (age < 6) notes.push('Atenção: loja AliExpress com menos de 6 meses.');
    }
  }

  return {
    ali,
    candidates: candidates.sort((a,b)=>b.score.final - a.score.final),
    price_stats_brl: stats,
    best,
    evaluation,
    decision,
  notes
  };
}

export const __internals = { normalizeAli, titleSimilarity, imageSimilarity, priceStats, evaluateMargin };
