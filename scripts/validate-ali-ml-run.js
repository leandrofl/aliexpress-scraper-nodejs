// Runner for validateAliToML end-to-end
import puppeteer from 'puppeteer-extra';
import { validateAliToML } from '../marginValidation/validate-ali-ml.js';
import { HEADLESS } from '../config.js';

const ali = {
  url: 'https://www.aliexpress.com/item/xxx',
  title: 'Relógio de parede moderno silencioso',
  price_original: 19.99,
  price_current: 14.99,
  shipping_usd: 3.5,
  images: ['https://ae01.alicdn.com/kf/HTB1K1K1XjDuK1RjSszdq6xGLpXaw.jpg']
};

const params = {
  fx_usd_brl: 5.2,
  tax_rate: 0.12,
  ml_fee_rate: 0.16,
  min_margin_brl: 20,
  min_margin_pct: 0.25,
  max_pages: 1
};

async function main() {
  const browser = await puppeteer.launch({ headless: HEADLESS });
  try {
    const out = await validateAliToML(browser, ali, params);
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('Runner error:', e);
  } finally {
    await browser.close();
  }
}

main();
