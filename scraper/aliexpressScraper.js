import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { scrollToBottom } from './utils.js';
import { applyQuantitativeFilter } from '../filters/quantitative.js';
import { applyQualitativeFilter } from '../filters/qualitative.js';
import { assessRisk } from '../filters/riskAssessment.js';

puppeteer.use(StealthPlugin());

export async function scrapeAliExpressProducts(config) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=pt-BR',
      '--proxy-server=http://proxy.public.free:8080' // ← altere conforme proxy gratuito disponível
    ]
  });

  const page = await browser.newPage();

  // Spoof de navegador (idioma, timezone, etc.)
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });

  await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded' });

  await page.type('input[name="SearchText"]', config.CATEGORY_KEYWORDS[0]);
  await Promise.all([
    page.keyboard.press('Enter'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  ]);

  await scrollToBottom(page);

  const produtos = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.search-card-item'));
    return items.map(item => {
      const nome = item.querySelector('h1, h2, h3')?.innerText || '';
      const preco = item.querySelector('.price')?.innerText || '';
      const url = item.querySelector('a')?.href || '';
      const vendas = item.innerHTML.includes('vendido') ? item.innerText : '';
      return { nome, preco, url, vendas };
    });
  });

  const produtosFiltrados = [];

  for (const p of produtos) {
    const aprovadoQuant = applyQuantitativeFilter(p);
    const aprovadoQuali = applyQualitativeFilter(p);
    const risco = assessRisk(p);

    produtosFiltrados.push({
      ...p,
      aprovado: aprovadoQuant && aprovadoQuali,
      aprovadoQuant,
      aprovadoQuali,
      risco
    });

    if (
      produtosFiltrados.filter(p => p.aprovado).length >=
      config.MIN_APPROVED_PRODUCTS
    ) {
      break;
    }
  }

  await browser.close();
  return produtosFiltrados;
}
