// Test runner for Mercado Livre search with mock AliExpress data
import puppeteer from 'puppeteer-extra';
import { buscarMelhorProdutoML } from '../marginValidation/mercado-livre-scraper.js';
import { HEADLESS } from '../config.js';

const mockAliExpressProduct = {
  nome: 'Relógio de parede moderno silencioso',
  nomeTraduzido: 'Relógio de parede moderno silencioso',
  preco: 89.99,
  imagemURL: 'https://ae01.alicdn.com/kf/HTB1K1K1XjDuK1RjSszdq6xGLpXaw.jpg',
};

async function runTest() {
  const browser = await puppeteer.launch({ headless: HEADLESS });
  try {
    console.log('🔍 Testando busca Mercado Livre com produto mockado...');
    const resultado = await buscarMelhorProdutoML(browser, mockAliExpressProduct);
    console.log('Resultado da busca ML:', resultado);
  } catch (err) {
    console.error('Erro no teste ML:', err);
  } finally {
    await browser.close();
  }
}

runTest();
