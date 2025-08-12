/**
 * ml-search.js
 * Lightweight Mercado Livre search via HTTP + Cheerio (list) and Puppeteer for item enrichment.
 */
import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as cheerio from 'cheerio';

axiosRetry(axios, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error) || error?.response?.status >= 500 || error?.response?.status === 429
});

function buildSearchUrl(query, page = 1) {
  const base = `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`;
  // Basic page param; MLB also supports _Desde_ offsets, but this keeps it simple and robust enough.
  return page > 1 ? `${base}_Desde_${(page - 1) * 50 + 1}` : base;
}

function extractPrice(text) {
  if (!text) return 0;
  const cleaned = String(text).replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

export async function searchMLB(queries, opts = { maxPages: 1 }) {
  const maxPages = Math.max(1, Math.min(5, opts?.maxPages || 1));
  const results = [];
  const seen = new Set();

  for (const q of (queries || [])) {
    for (let page = 1; page <= maxPages; page++) {
      const url = buildSearchUrl(q, page);
      try {
        const resp = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        const $ = cheerio.load(resp.data);
        const nodes = $('li.ui-search-layout__item, .ui-search-layout__item');
        nodes.each((_, el) => {
          const $el = $(el);
          const link = $el.find('a[href]').first().attr('href') || '';
          const title = $el.find('h2, .ui-search-item__title, .ui-search-result__title').first().text().trim();
          const priceTxt = $el.find('.price-tag .price-tag-fraction, .ui-search-price__second-line .price-tag-fraction').first().text().trim();
          const thumb = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src') || '';
          const price_brl = extractPrice(priceTxt);

          if (!title || !link) return;
          const idMatch = link.match(/MLB-(\d+)/);
          const ml_item_id = idMatch ? idMatch[1] : '';
          const key = ml_item_id || link;
          if (seen.has(key)) return;
          seen.add(key);

          results.push({
            ml_item_id,
            title,
            price_brl,
            url: link,
            thumb,
            // Optional fields not always available on list page
            seller_reputation: undefined,
            sold_qty: undefined,
            location: undefined
          });
        });
      } catch (e) {
        // Swallow and continue to next page/query
      }
    }
  }
  return results;
}

export async function enrichMLItem(browser, itemUrl) {
  const out = { images: [], attrs: {}, price_brl: undefined };
  if (!browser || !itemUrl) return out;
  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setDefaultNavigationTimeout(45000);
    await page.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (page.isClosed()) return out;
    // images
    try {
      const imgs = await page.$$eval('.ui-pdp-gallery__figure img, img.ui-pdp-image', els => els.map(e => e.getAttribute('src') || e.getAttribute('data-zoom') || e.getAttribute('data-src')).filter(Boolean));
      out.images = Array.from(new Set(imgs));
    } catch {}
    // price
    try {
      const pTxt = await page.$eval('.ui-pdp-price__second-line .andes-money-amount__fraction, .andes-money-amount__fraction', el => el.textContent.trim());
      out.price_brl = Number((pTxt || '').replace(/\./g, '').replace(',', '.')) || undefined;
    } catch {}
    // attributes (best effort)
    try {
      const pairs = await page.$$eval('.ui-pdp-specs__table tr, tr.andes-table__row', rows => rows.map(r => {
        const k = (r.querySelector('th, .andes-table__header')?.textContent || '').trim();
        const v = (r.querySelector('td, .andes-table__column')?.textContent || '').trim();
        return k && v ? [k, v] : null;
      }).filter(Boolean));
      out.attrs = Object.fromEntries(pairs);
    } catch {}
  } catch {
    // ignore
  } finally {
    try { if (page && !page.isClosed()) await page.close(); } catch {}
  }
  return out;
}
