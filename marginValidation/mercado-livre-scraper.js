/**
 * @fileoverview Busca real de produtos no Mercado Livre com comparação visual
 * @description Implementa busca real no Mercado Livre usando axios/cheerio + comparação visual
 * com tratamento robusto de exceções e integração com sistema de tradução
 * 
 * @author Sistema de Scraping AliExpress - Busca ML v2.0
 * @version 2.0.0 - Versão otimizada com comparação visual
 * @since 2024-01-01
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import { logInfo, logSucesso, logErro } from '../scraper/utils.js';
import { HEADLESS } from '../config.js';
import { compararImagensPorHash } from '../utils/comparador-imagens.js';
import { gerarTermosDeBusca } from '../utils/comparador-produtos.js';
import { produtosSaoCompativeis } from '../utils/comparador-produtos.js';
import { calcularRiscoProduto, determinarMetodoValidacao, permiteValidacaoTextual } from '../utils/calculadora-risco.js';
import { compararSemantica, analisarProdutosSemantico, calcularEstatisticasPreco, calcularDesvioPreco } from '../utils/analisador-semantico.js';

// 🛡 Melhoria 2: Configurar retry automático para falhas de rede
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.response?.status === 429 || 
           error.response?.status >= 500;
  }
});

// Utilitário: normaliza URL de imagem (protocol-relative, espaços, etc.)
function normalizarUrlImagem(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith('//')) return 'https:' + u;
  return u;
}

// Normaliza URL do produto: remove querys longas e tracking
function normalizarUrlProduto(raw) {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    // Mantém apenas caminho base; remove search e hash
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return raw;
  }
}

// Extrai ID MLB do texto/URL
function extrairIdMLB(str) {
  if (!str) return null;
  const m = String(str).match(/MLB-?(\d{5,})/i);
  return m ? `MLB${m[1]}` : null;
}

// Busca __PRELOADED_STATE__ da página
async function obterPreloadedState(page) {
  try {
    const state = await page.evaluate(() => {
      try { return window.__PRELOADED_STATE__ || null; } catch { return null; }
    });
    if (state) return state;
  } catch {}
  try {
    // Tenta extrair de scripts inline, procurando padrão de assignment
    const raw = await page.$$eval('script', els => {
      for (const el of els) {
        const t = el.textContent || '';
        if (t.includes('__PRELOADED_STATE__')) return t;
      }
      return '';
    });
    if (raw) {
      const idx = raw.indexOf('__PRELOADED_STATE__');
      if (idx >= 0) {
        const slice = raw.slice(idx);
        const eq = slice.indexOf('=');
        if (eq >= 0) {
          const after = slice.slice(eq + 1);
          // Heurística: até o primeiro \n;</n> ou fim
          const end = after.lastIndexOf('};');
          const jsonStr = end > 0 ? after.slice(0, end + 1).trim() : after.trim();
          try { return JSON.parse(jsonStr); } catch {}
        }
      }
    }
  } catch {}
  return null;
}

// Varre o objeto em busca de uma lista de produtos com id MLB
function extrairPrintedResults(state) {
  if (!state) return [];
  const resultados = [];
  const visit = (obj, depth = 0) => {
    if (!obj || depth > 4) return;
    if (Array.isArray(obj)) {
      for (const it of obj) visit(it, depth + 1);
      return;
    }
    if (typeof obj !== 'object') return;
    // Candidatos: arrays em propriedades comuns
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) {
        const mapped = v
          .map(x => mapStateItem(x))
          .filter(Boolean);
        if (mapped.length >= 3) resultados.push(mapped);
      } else if (typeof v === 'object') {
        visit(v, depth + 1);
      }
    }
  };

  const mapStateItem = (x) => {
    if (!x || typeof x !== 'object') return null;
    const id = x.id || x.item_id || x.product_id || x.permalink && extrairIdMLB(x.permalink) || null;
    const title = x.title || x.name || x.primary_title || null;
    const permalink = x.permalink || x.url || x.canonical_url || null;
    const price = x.price || x.price_brl || x.prices?.price || null;
    const adType = x.ad_type || x.adType || x.badges?.includes('sponsored') ? 'sponsored' : null;
    if (id && (title || permalink)) {
      return {
        id: extrairIdMLB(id) || id,
        title,
        permalink: permalink ? normalizarUrlProduto(permalink) : '',
        price_brl: typeof price === 'number' ? price : null,
        ad_type: adType || null
      };
    }
    return null;
  };

  visit(state);
  // Escolhe o primeiro conjunto mais longo encontrado
  const best = resultados.sort((a,b) => b.length - a.length)[0] || [];
  // Remove duplicados por id preservando ordem
  const seen = new Set();
  const unique = [];
  for (const it of best) {
    if (!it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    unique.push(it);
  }
  return unique;
}

// Busca os top 5 produtos no ML e retorna o mais parecido visualmente
export async function buscarMelhorProdutoML(browser, produtoAli) {
  const termosBusca = gerarTermosDeBusca(produtoAli.nomeTraduzido || produtoAli.nome);
  const url = `https://lista.mercadolivre.com.br/${encodeURIComponent(termosBusca)}`;

  try {
    if (!browser) throw new Error('Browser Puppeteer não disponível');

    let page = null;
    const itens = [];
    try {
      logInfo(`🟡 ML: abrindo nova aba (headless=${HEADLESS}) para busca: "${termosBusca}"`);
      page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      page.setDefaultNavigationTimeout(45000);
      page.setDefaultTimeout(20000);

      logInfo(`🟡 ML: navegando para ${url}`);
      let navegacaoOk = false;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (page.isClosed()) {
          logErro('⚠️ ML: a aba foi fechada inesperadamente após navegação!');
          throw new Error('A aba do navegador foi fechada.');
        }
        // Artefatos desativados: não salvar HTML/JSON/screenshot
        await page.waitForSelector('li.ui-search-layout__item, .ui-search-result__content-wrapper', { timeout: 15000 });
        navegacaoOk = true;
        logInfo('🟡 ML: resultados carregados');
      } catch (navErr) {
        logErro(`⚠️ ML: falha ao carregar resultados via Puppeteer (${navErr.name || 'Erro'}: ${navErr.message})`);
      }

      // Estado pré-carregado (para enriquecimento/fallback)
      let preState = null;
      let printedList = [];

      if (navegacaoOk) {
        try {
          preState = await obterPreloadedState(page);
          if (preState) printedList = extrairPrintedResults(preState);
        } catch {}

        // 1) DOM primeiro para preservar a ordem visual
        const nodes = await page.$$('li.ui-search-layout__item, .ui-search-layout__item');
        logInfo(`🟡 ML: itens encontrados (DOM): ${nodes.length}`);
        for (let i = 0; i < nodes.length && itens.length < 5; i++) {
          const el = nodes[i];
          let nome = '';
          try { nome = await el.$eval('a.poly-component__title', n => n.textContent.trim()); } catch {}
          if (!nome) { try { nome = await el.$eval('h3.poly-component__title-wrapper a', n => n.textContent.trim()); } catch {} }
          if (!nome) { try { nome = await el.$eval('h2.ui-search-item__title, .ui-search-item__title, .ui-search-result__title', n => n.textContent.trim()); } catch {} }
          if (!nome) { try { nome = await el.$eval('img[alt]', n => n.getAttribute('alt')?.trim() || ''); } catch {} }

          let precoTxt = '';
          try { precoTxt = await el.$eval('.price-tag .price-tag-fraction, .ui-search-price__second-line .price-tag-fraction, .andes-money-amount__fraction', n => n.textContent.trim()); } catch {}

          let imagem = '';
          try { imagem = await el.$eval('img', img => img.getAttribute('data-src') || img.getAttribute('data-srcset') || img.getAttribute('srcset') || img.getAttribute('src')); } catch {}

          let link = '';
          try { link = await el.$eval('a.poly-component__title', a => a.getAttribute('href')); } catch {}
          if (!link) { try { link = await el.$eval('a.ui-search-link, a[href]', a => a.getAttribute('href')); } catch {} }

          const precoNum = precoTxt ? parseFloat(precoTxt.replace(/\./g, '').replace(',', '.')) : 0;
          if (nome && link) {
            const urlNorm = normalizarUrlProduto(link);
            const id = extrairIdMLB(urlNorm);
            const pos = itens.length + 1;
            itens.push({ nome, preco: isFinite(precoNum) ? precoNum : 0, imagem, link: urlNorm, id, position: pos, price_brl: isFinite(precoNum) ? precoNum : null });
          }
        }
        logSucesso(`🟢 ML: coleta (DOM, ${itens.length} itens)`);

        // 2) Enriquecimento via printed_result (ad_type/price_brl) se disponível
        if (itens.length) {
          if (printedList.length) {
            const byId = new Map(printedList.filter(p => p.id).map(p => [p.id, p]));
            for (const it of itens) {
              const pid = it.id || extrairIdMLB(it.link);
              const st = pid ? byId.get(pid) : null;
              if (st) {
                if (st.ad_type && !it.ad_type) it.ad_type = st.ad_type;
                if (it.price_brl == null && typeof st.price_brl === 'number') it.price_brl = st.price_brl;
              } else {
                if (it.price_brl == null) it.price_brl = isFinite(it.preco) ? it.preco : null;
              }
            }
          } else {
            for (const it of itens) if (it.price_brl == null) it.price_brl = isFinite(it.preco) ? it.preco : null;
          }
        }

        // 3) Complemento via ld+json apenas se faltar itens
        if (itens.length < 5) {
          let produtosJson = [];
          try {
            const blocks = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.textContent || ''));
            for (const raw of blocks) {
              try {
                const data = JSON.parse(raw);
                const toArray = (x) => Array.isArray(x) ? x : (x ? [x] : []);
                const pushProduct = (p) => {
                  if (!p) return;
                  const nome = p.name || p.title || '';
                  const precoRaw = p.offers?.price || (Array.isArray(p.offers) ? p.offers[0]?.price : undefined);
                  const imgRaw = Array.isArray(p.image) ? p.image[0] : p.image;
                  const lnk = p.offers?.url || p.url || '';
                  const precoNum2 = precoRaw ? parseFloat(String(precoRaw).replace(/\./g, '').replace(',', '.')) : 0;
                  if (nome && lnk) produtosJson.push({ nome, preco: isFinite(precoNum2) ? precoNum2 : 0, imagem: imgRaw || '', link: lnk });
                };
                if (data['@type'] === 'Product') pushProduct(data);
                if (data['@graph']) {
                  for (const g of toArray(data['@graph'])) {
                    if (g['@type'] === 'Product') pushProduct(g);
                    if (g['@type'] === 'ItemList' && Array.isArray(g.itemListElement)) {
                      for (const it of g.itemListElement) pushProduct(it?.item || it);
                    }
                  }
                }
                if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
                  for (const it of data.itemListElement) pushProduct(it?.item || it);
                }
              } catch {}
            }
          } catch (jsonErr) {
            logErro(`⚠️ ML: erro ao coletar ld+json (${jsonErr.message})`);
          }

          if (produtosJson.length) {
            const seenLinks = new Set(itens.map(x => x.link));
            for (const p of produtosJson) {
              const urlNorm = normalizarUrlProduto(p.link);
              if (!seenLinks.has(urlNorm) && itens.length < 5) {
                const id = extrairIdMLB(urlNorm);
                itens.push({ nome: p.nome, preco: p.preco, imagem: p.imagem, link: urlNorm, id, position: itens.length + 1, price_brl: isFinite(p.preco) ? p.preco : null });
                seenLinks.add(urlNorm);
              }
            }
            logSucesso(`🟢 ML: complementado via ld+json (total ${itens.length})`);
          }
        }
      }

      // 4) Fallback via __PRELOADED_STATE__/printed_result se DOM falhar
      if (!itens.length) {
        try {
          if (!printedList.length) {
            preState = await obterPreloadedState(page);
            if (preState) printedList = extrairPrintedResults(preState);
          }
          if (printedList.length) {
            const max = Math.min(5, printedList.length);
            for (let i = 0; i < max; i++) {
              const pr = printedList[i];
              const permalink = normalizarUrlProduto(pr.permalink || '');
              itens.push({
                nome: pr.title || '',
                preco: typeof pr.price_brl === 'number' ? pr.price_brl : 0,
                imagem: '',
                link: permalink,
                id: pr.id || extrairIdMLB(permalink),
                position: i + 1,
                ad_type: pr.ad_type || null,
                price_brl: typeof pr.price_brl === 'number' ? pr.price_brl : null
              });
            }
            logSucesso(`🟢 ML: fallback via __PRELOADED_STATE__/printed_result coletou ${itens.length} itens`);
          }
        } catch (stErr) {
          logErro(`⚠️ ML: fallback via __PRELOADED_STATE__ falhou (${stErr.name || 'Erro'}: ${stErr.message})`);
        }
      }

      // 5) Fallback: tentar axios/cheerio se ainda não obteve itens
      if (!itens.length) {
        try {
          logInfo('🟡 ML: tentando fallback via axios/cheerio');
          const resp = await axios.get(url, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
            }
          });
          const $ = cheerio.load(resp.data);
          const nodes = $('li.ui-search-layout__item, .ui-search-layout__item');
          nodes.slice(0, 5).each((_, el) => {
            let nome = $(el).find('a.poly-component__title').first().text().trim();
            if (!nome) nome = $(el).find('h3.poly-component__title-wrapper a').first().text().trim();
            if (!nome) nome = $(el).find('h2, .ui-search-item__title, .ui-search-result__title').first().text().trim();
            if (!nome) nome = $(el).find('img[alt]').first().attr('alt')?.trim() || '';
            const precoTxt = $(el).find('.price-tag .price-tag-fraction, .ui-search-price__second-line .price-tag-fraction').first().text().trim();
            const imgEl = $(el).find('img').first();
            const imagem = imgEl.attr('data-src') || imgEl.attr('data-srcset') || imgEl.attr('srcset') || imgEl.attr('src') || '';
            let link = $(el).find('a.poly-component__title').first().attr('href') || '';
            if (!link) link = $(el).find('a.ui-search-link').first().attr('href') || '';
            if (!link) link = $(el).find('a').first().attr('href') || '';
            const precoNum = precoTxt ? parseFloat(precoTxt.replace(/\./g, '').replace(',', '.')) : 0;
            if (nome && link) {
              const urlNorm = normalizarUrlProduto(link);
              const id = extrairIdMLB(urlNorm);
              const pos = itens.length + 1;
              itens.push({ nome, preco: isFinite(precoNum) ? precoNum : 0, imagem, link: urlNorm, id, position: pos, price_brl: isFinite(precoNum) ? precoNum : null });
            }
          });
          logSucesso(`🟢 ML: fallback coletou ${itens.length} itens`);
        } catch (fbErr) {
          logErro(`⚠️ ML: fallback axios/cheerio falhou (${fbErr.name || 'Erro'}: ${fbErr.message})`);
        }
      }
    } finally {
      try {
        if (page && !page.isClosed()) {
          await page.close();
          logSucesso('🟢 ML: aba fechada');
        }
      } catch (e) {
        logErro(`⚠️ ML: erro ao fechar aba: ${e.message}`);
      }
    }

    let melhorProduto = null;
    let maiorSimilaridade = 0;
    const top3Produtos = [];

    for (const item of itens) {
      try {
        const imgAli = normalizarUrlImagem(produtoAli.imagemURL);
        const imgML = normalizarUrlImagem(item.imagem);
        let comp = { similar: false, similaridade: 0 };
        if (imgAli && imgML) comp = await compararImagensPorHash(imgAli, imgML);

        const produtoComSimilaridade = {
          ...item,
          similaridade: comp.similaridade,
          imagemComparada: true,
          fonteDeVerificacao: 'imagem',
          riscoImagem: false
        };
        top3Produtos.push(produtoComSimilaridade);
        if (comp.similar && comp.similaridade > maiorSimilaridade) {
          maiorSimilaridade = comp.similaridade;
          melhorProduto = produtoComSimilaridade;
        }
      } catch (e) {
        console.warn('Erro na comparação de imagem:', e.message);
        top3Produtos.push({
          ...item,
          similaridade: 0,
          imagemComparada: false,
          fonteDeVerificacao: 'erro',
          riscoImagem: true
        });
      }
    }

    // 🎯 FALLBACK TEXTUAL + SEMÂNTICO
    if (!melhorProduto && itens.length > 0) {
      console.log('🔍 Nenhum match por imagem encontrado ou sem imagem. Tentando análise semântica...');
      const top3 = itens.slice(0, 3);
      const estatisticasPreco = calcularEstatisticasPreco(top3);
      console.log(`📊 Preço médio ML (top 3): R$ ${estatisticasPreco.precoMedioML}`);

      const analiseSemantica = await analisarProdutosSemantico(produtoAli, itens);
      if (analiseSemantica.melhorMatch && analiseSemantica.scoreSemantico >= 70) {
        console.log(`🧠 Match semântico encontrado: Score ${analiseSemantica.scoreSemantico}%`);
        const produtoSelecionado = analiseSemantica.melhorMatch;
        const desvioPreco = calcularDesvioPreco(produtoSelecionado.preco, produtoAli.preco);
        if (desvioPreco <= 250) {
          console.log(`✅ Desvio de preço aceitável: ${desvioPreco}%`);
          const dadosParaRisco = {
            ...produtoAli,
            imagem_comparada: false,
            imagem_match: false,
            score_imagem: 0,
            score_semantico: analiseSemantica.scoreSemantico,
            score_texto: analiseSemantica.scoreSemantico,
            match_por_texto: true,
            aprovado_fallback_texto: true,
            desvio_preco: desvioPreco,
            preco_medio_ml: estatisticasPreco.precoMedioML,
            metodo_analise_titulo: analiseSemantica.metodoUsado,
            fonte_de_verificacao: 'semantico'
          };

          const analiseRisco = calcularRiscoProduto(dadosParaRisco);
          const metodoValidacao = determinarMetodoValidacao(dadosParaRisco);
          melhorProduto = {
            ...produtoSelecionado,
            similaridade: analiseSemantica.scoreSemantico,
            imagemComparada: false,
            fonteDeVerificacao: 'semantico',
            riscoImagem: true,
            metodoValidacaoMargem: metodoValidacao,
            scoreImagem: 0,
            imagemMatch: false,
            scoreTexto: analiseSemantica.scoreSemantico,
            scoreSemantico: analiseSemantica.scoreSemantico,
            matchPorTexto: true,
            aprovadoFallbackTexto: true,
            riscoFinal: analiseRisco.riscoFinal,
            pendenteRevisao: analiseRisco.pendenteRevisao,
            desvioPreco: desvioPreco,
            precoMedioML: estatisticasPreco.precoMedioML,
            metodoAnaliseTitulo: analiseSemantica.metodoUsado,
            compatibilidadeTextual: {
              score: analiseSemantica.scoreSemantico,
              motivo: analiseSemantica.analiseCompleta?.motivo || 'Análise semântica',
              detalhesRisco: analiseRisco.detalhesRisco,
              classificacao: analiseRisco.classificacaoRisco,
              metodoAnalise: analiseSemantica.metodoUsado,
              estatisticasPreco: estatisticasPreco
            }
          };
          console.log(`✅ Produto aprovado via análise semântica`);
          console.log(`⚠️ Risco: ${analiseRisco.classificacaoRisco} (${analiseRisco.riscoFinal}%)`);
        } else {
          console.log(`❌ Desvio de preço muito alto: ${desvioPreco}% (máximo 250%)`);
        }
      } else if (analiseSemantica.scoreSemantico > 0) {
        console.log(`❌ Score semântico insuficiente: ${analiseSemantica.scoreSemantico}% (mínimo 70%)`);
      }

      if (!melhorProduto) {
        console.log('🔄 Tentando fallback textual tradicional...');
        let melhorCompatibilidade = null;
        let maiorScore = 0;
        const top3 = itens.slice(0, 3);
        const estatisticasPreco = calcularEstatisticasPreco(top3);
        for (const item of itens) {
          try {
            if (!permiteValidacaoTextual(produtoAli)) {
              console.log('❌ Categoria não permite fallback textual');
              continue;
            }
            const compatibilidade = produtosSaoCompativeis(produtoAli, { nome: item.nome, preco: item.preco });
            if (compatibilidade.compatível && compatibilidade.score >= 60) {
              const desvioPreco = calcularDesvioPreco(item.preco, produtoAli.preco);
              if (desvioPreco <= 250 && compatibilidade.score > maiorScore) {
                maiorScore = compatibilidade.score;
                const dadosParaRisco = {
                  ...produtoAli,
                  imagem_comparada: false,
                  imagem_match: false,
                  score_imagem: 0,
                  score_texto: compatibilidade.score,
                  match_por_texto: true,
                  aprovado_fallback_texto: true,
                  desvio_preco: desvioPreco,
                  preco_medio_ml: estatisticasPreco.precoMedioML,
                  metodo_analise_titulo: 'textual_fallback',
                  fonte_de_verificacao: 'texto'
                };
                const analiseRisco = calcularRiscoProduto(dadosParaRisco);
                const metodoValidacao = determinarMetodoValidacao(dadosParaRisco);
                melhorCompatibilidade = {
                  ...item,
                  similaridade: compatibilidade.score,
                  imagemComparada: false,
                  fonteDeVerificacao: 'texto',
                  riscoImagem: true,
                  metodoValidacaoMargem: metodoValidacao,
                  scoreImagem: 0,
                  imagemMatch: false,
                  scoreTexto: compatibilidade.score,
                  scoreSemantico: 0,
                  matchPorTexto: true,
                  aprovadoFallbackTexto: true,
                  riscoFinal: analiseRisco.riscoFinal,
                  pendenteRevisao: analiseRisco.pendenteRevisao,
                  desvioPreco: desvioPreco,
                  precoMedioML: estatisticasPreco.precoMedioML,
                  metodoAnaliseTitulo: 'textual_fallback',
                  compatibilidadeTextual: {
                    ...compatibilidade,
                    detalhesRisco: analiseRisco.detalhesRisco,
                    classificacao: analiseRisco.classificacaoRisco,
                    estatisticasPreco: estatisticasPreco
                  }
                };
              }
            }
          } catch (compatError) {
            console.warn('Erro na verificação de compatibilidade:', compatError.message);
          }
        }
        if (melhorCompatibilidade) {
          melhorProduto = melhorCompatibilidade;
          console.log(`✅ Fallback textual encontrou match: "${melhorProduto.nome}" (Score: ${maiorScore}%)`);
          console.log('⚠️ ATENÇÃO: Produto marcado com risco para revisão');
        } else {
          console.log('❌ Nenhum produto compatível encontrado (imagem, semântica ou textual)');
        }
      }
    }

    top3Produtos.sort((a, b) => b.similaridade - a.similaridade);
    const top3Final = top3Produtos.slice(0, 3);
    return { melhorProduto, mlTop3Produtos: top3Final, mlTop5Produtos: itens.slice(0, 5), totalEncontrados: itens.length };
  } catch (err) {
    console.error('Erro ao buscar ML:', err.message);
    return null;
  }
}

// Manter compatibilidade com a função original
export async function buscarProdutosCompativeisML(browser, produtoAliExpress, opcoes = {}) {
  console.log('🔄 Usando nova implementação de busca ML com Puppeteer (fallback axios/cheerio)...');
  
  try {
    // Extrair primeira imagem do produto AliExpress (aceita array, string com vírgulas, ou campo imagemURL)
    let imagemURL = null;
    if (Array.isArray(produtoAliExpress.imagens) && produtoAliExpress.imagens.length > 0) {
      imagemURL = produtoAliExpress.imagens[0];
    } else if (typeof produtoAliExpress.imagens === 'string' && produtoAliExpress.imagens.trim()) {
      const parts = produtoAliExpress.imagens.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length) imagemURL = parts[0];
    } else if (produtoAliExpress.imagemURL) {
      imagemURL = produtoAliExpress.imagemURL;
    }
    imagemURL = normalizarUrlImagem(imagemURL);

    // Criar objeto produto compatível com a nova função
    const produtoParaBusca = {
      nome: produtoAliExpress.nome,
      nomeTraduzido: produtoAliExpress.nomeTraduzido || produtoAliExpress.nome,
      imagemURL: imagemURL
    };

  const melhorProduto = await buscarMelhorProdutoML(browser, produtoParaBusca);

    if (melhorProduto && melhorProduto.melhorProduto) {
      return {
        encontrouProdutos: true,
        produtosCompatíveis: melhorProduto.mlTop3Produtos || [],
        melhorMatch: melhorProduto.melhorProduto,
        totalEncontrados: melhorProduto.totalEncontrados || 0,
        termoBusca: gerarTermosDeBusca(produtoParaBusca.nomeTraduzido || produtoParaBusca.nome),
        erro: null
      };
    } else {
      return {
        encontrouProdutos: false,
        produtosCompatíveis: [],
        melhorMatch: null,
        totalEncontrados: 0,
        termoBusca: gerarTermosDeBusca(produtoParaBusca.nomeTraduzido || produtoParaBusca.nome),
        erro: 'Nenhum produto compatível encontrado'
      };
    }

  } catch (error) {
    console.error('❌ Erro na busca ML:', error.message);
    return {
      encontrouProdutos: false,
      produtosCompatíveis: [],
      melhorMatch: null,
      erro: error.message
    };
  }
}

// Função legacy mantida por compatibilidade
export async function buscarProdutosMercadoLivre(browser, termoBusca, opcoes = {}) {
  console.log('🔄 Redirecionando para nova implementação...');
  
  const produtoFake = {
    nome: termoBusca,
    nomeTraduzido: termoBusca,
    imagemURL: null // Será tratado como sem imagem
  };

  const resultado = await buscarMelhorProdutoML(browser, produtoFake);
  
  return {
    produtos: resultado ? [resultado] : [],
    termoBusca: termoBusca,
    paginaAtual: 1,
    totalProdutos: resultado ? 1 : 0
  };
}
