import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {
  scrollUntilAllProductsLoaded,
  tirarScreenshot,
  salvarHtmlPesquisa,
  salvarJsonProduto,
  delay,
  randomDelay,
  logInfo,
  logSucesso,
  logErro
} from './utils.js';

import {
  applyQuantitativeFilter
} from '../filters/quantitative.js';

import {
  applyQualitativeFilter
} from '../filters/qualitative.js';

import {
  assessRisk
} from '../filters/riskAssessment.js';

import {
  CATEGORIES,
  MAX_PRODUCTS_RAW,
  TARGET_PRODUCTS_FINAL,
  MAX_PAGES_PER_CATEGORY
} from '../config.js';

puppeteer.use(StealthPlugin());

export async function processCategory(browser, categoria) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  const produtos = [];
  let pagina = 1;

  logInfo(`🔍 Iniciando processamento da categoria: ${categoria}`);

  while (
    produtos.length < MAX_PRODUCTS_RAW &&
    pagina <= MAX_PAGES_PER_CATEGORY
  ) {
    try {
      const searchUrl = `https://pt.aliexpress.com/wholesale?SearchText=${encodeURIComponent(categoria)}&page=${pagina}&sortType=total_tranpro_desc`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      await scrollUntilAllProductsLoaded(page);
      await tirarScreenshot(page, categoria, pagina);
      await salvarHtmlPesquisa(page, categoria, pagina);

      const produtosPagina = await extractProductsFromPage(page, categoria, pagina);

      for (const produto of produtosPagina) {
        await filterAndAppendProduct(produto, produtos, categoria, pagina);
        if (produtos.filter(p => p.aprovado).length >= TARGET_PRODUCTS_FINAL) break;
      }

      logInfo(`📦 Página ${pagina} finalizada. Total acumulado: ${produtos.length}`);
      pagina++;
      await randomDelay();

    } catch (err) {
      logErro(`Erro na página ${pagina} da categoria ${categoria}: ${err.message}`);
      break;
    }
  }

  await page.close();
  return produtos;
}

export async function extractProductsFromPage(page, categoria, pagina) {
  try {
    const produtos = await page.evaluate(() => {
      const cards = document.querySelectorAll('a.search-card-item');
      const lista = [];

      for (const card of cards) {
        const nome = card.querySelector('h1,h2,h3')?.innerText || '';
        const preco = card.querySelector('.search-card-item-price')?.innerText || '';
        const url = card.href || '';
        const vendas = card.innerText.includes('vendido') ? card.innerText : '';
        if (nome && url) {
          lista.push({ nome, preco, url, vendas });
        }
      }

      return lista;
    });

    logSucesso(`✔️ ${produtos.length} produtos extraídos da página ${pagina}.`);
    return produtos;

  } catch (err) {
    logErro(`Erro ao extrair produtos da página ${pagina}: ${err.message}`);
    return [];
  }
}

export async function extractProductDetails(page, url) {
  try {
    const novaAba = await page.browser().newPage();
    await novaAba.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000);

    const detalhes = await novaAba.evaluate(() => {
      const getText = (selector) => document.querySelector(selector)?.innerText || '';
      return {
        vendedor: getText('.store-info .store-name'),
        peso: getText('td:contains("Peso") + td'),
        frete: getText('.dynamic-shipping')
      };
    });

    await novaAba.close();
    return detalhes;

  } catch (err) {
    logErro(`Erro ao acessar detalhes do produto ${url}: ${err.message}`);
    return { vendedor: '', peso: '', frete: '' };
  }
}

export async function filterAndAppendProduct(produto, lista, categoria, pagina) {
  try {
    const page = lista._tempPageRef;
    const detalhes = await extractProductDetails(page, produto.url);
    const produtoCompleto = { ...produto, ...detalhes };

    const aprovadoQuant = applyQuantitativeFilter(produtoCompleto);
    const aprovadoQuali = applyQualitativeFilter(produtoCompleto);
    const risco = assessRisk(produtoCompleto);

    const aprovadoFinal = aprovadoQuant && aprovadoQuali;

    const itemFinal = {
      ...produtoCompleto,
      aprovadoQuant,
      aprovadoQuali,
      risco,
      aprovado: aprovadoFinal
    };

    lista.push(itemFinal);

    if (aprovadoFinal) {
      logSucesso(`👍 Produto aprovado: ${produto.nome}`);
    } else {
      logInfo(`⛔ Produto reprovado: ${produto.nome}`);
    }

    await salvarJsonProduto(itemFinal, categoria, pagina);

  } catch (err) {
    logErro(`Erro ao avaliar produto: ${err.message}`);
  }
}
