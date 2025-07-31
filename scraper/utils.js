import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Delay fixo
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Delay aleatório (entre 1.2 e 2.5s)
export const randomDelay = async () => {
  const time = Math.random() * (2500 - 1200) + 1200;
  await delay(time);
};

// Scroll até carregar todos os produtos
export async function scrollUntilAllProductsLoaded(page, maxAttempts = 2, intervalo = 500) {
  let previousCount = 0;
  let stableAttempts = 0;

  while (stableAttempts < maxAttempts) {
    const elementos = await page.$$(`a.search-card-item`);
    const currentCount = elementos.length;

    const fimResultados = await page.$(`.comet-pagination__no-more`);
    const fimVisivel = fimResultados ? await fimResultados.isIntersectingViewport() : false;

    if (currentCount === previousCount) {
      stableAttempts++;
    } else {
      stableAttempts = 0;
    }

    if (fimVisivel && currentCount === previousCount) break;

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await delay(intervalo);
    previousCount = currentCount;
  }
}

// Slug simples
export const slugify = (str) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '')
    .toLowerCase();

// Parse de preço (ex: "R$ 15,90")
export function parsePrice(str) {
  try {
    const clean = str.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(clean);
  } catch {
    return null;
  }
}

// Limpa tags e espaços
export const limparTexto = (texto) => texto?.replace(/\s+/g, ' ').replace(/[\n\r]+/g, '').trim() || '';

// Formata moeda
export const formatarMoeda = (valor) =>
  typeof valor === 'number' ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : valor;

// Logs
export const logInfo = (msg) => console.log(`ℹ️ ${msg}`);
export const logSucesso = (msg) => console.log(`✅ ${msg}`);
export const logErro = (msg) => console.log(`❌ ${msg}`);

// Screenshot
export async function tirarScreenshot(page, categoria, pagina, fullPage = true) {
  try {
    await fs.ensureDir(config.DIRETORIO_DEBUG);
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
    const nomeArquivo = `screenshot_${slugify(categoria)}_p${pagina}_${timestamp}.png`;
    const caminho = path.join(config.DIRETORIO_DEBUG, nomeArquivo);
    await page.screenshot({ path: caminho, fullPage });
    logSucesso(`Screenshot salvo em ${caminho}`);
  } catch (e) {
    logErro(`Erro ao salvar screenshot: ${e.message}`);
  }
}

// Salva JSON bruto
export async function salvarJsonProduto(json, categoria, pagina) {
  try {
    await fs.ensureDir(config.DIRETORIO_DEBUG);
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
    const nome = `json_${slugify(categoria)}_p${pagina}_${timestamp}.json`;
    const caminho = path.join(config.DIRETORIO_DEBUG, nome);
    await fs.writeJson(caminho, json, { spaces: 2 });
    logSucesso(`Dados salvos em ${caminho}`);
  } catch (e) {
    logErro(`Erro ao salvar JSON: ${e.message}`);
  }
}

// Salva HTML da pesquisa
export async function salvarHtmlPesquisa(page, categoria, pagina) {
  try {
    await fs.ensureDir(config.DIRETORIO_DEBUG);
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
    const nome = `html_${slugify(categoria)}_p${pagina}_${timestamp}.html`;
    const caminho = path.join(config.DIRETORIO_DEBUG, nome);
    const html = await page.content();
    await fs.writeFile(caminho, html, 'utf-8');
    logSucesso(`HTML salvo em ${caminho}`);
  } catch (e) {
    logErro(`Erro ao salvar HTML: ${e.message}`);
  }
}
