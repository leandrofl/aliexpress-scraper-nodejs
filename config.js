import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configurar dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// =================================
// VALIDAÇÃO DE VARIÁVEIS CRÍTICAS
// =================================
function validateEnv() {
    const criticalVars = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };

    for (const [key, value] of Object.entries(criticalVars)) {
        if (!value) {
            console.warn(`⚠️  Variável ${key} não configurada no arquivo .env`);
        }
    }
}

// Executar validação
validateEnv();

// =================================
// CONFIGURAÇÕES DE API
// =================================
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// =================================
// CONFIGURAÇÕES DE PRODUTOS
// =================================
export const CATEGORIES = (process.env.CATEGORIES || 'Casa & Cozinha,Tecnologia,Beleza,Lifestyle,Pets').split(',').map(cat => cat.trim());
export const MIN_SALES = parseInt(process.env.MIN_SALES || '500');
export const MIN_REVIEWS = parseInt(process.env.MIN_REVIEWS || '50');
export const MIN_RATING = parseFloat(process.env.MIN_RATING || '4.5');
export const MIN_ORDERS = parseInt(process.env.MIN_ORDERS || '100');
export const MAX_SHIPPING_COST = parseFloat(process.env.MAX_SHIPPING_COST || '15.0');
export const MIN_PROFIT_MARGIN = parseFloat(process.env.MIN_PROFIT_MARGIN || '0.30');

// =================================
// CONFIGURAÇÕES DE BUSCA
// =================================
export const MAX_PRODUCTS_RAW = parseInt(process.env.MAX_PRODUCTS_RAW || '80');
export const TARGET_PRODUCTS_FINAL = parseInt(process.env.TARGET_PRODUCTS_FINAL || '20');
export const MAX_PAGES_PER_CATEGORY = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '5');

// =================================
// CONFIGURAÇÕES DO PUPPETEER
// =================================
export const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const CHROME_USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR;
export const CHROME_PROFILE = process.env.CHROME_PROFILE;
export const HEADLESS = process.env.HEADLESS !== 'false';
export const SLOW_MO = parseInt(process.env.SLOW_MO || '0');
export const PUPPETEER_PROXY = process.env.PUPPETEER_PROXY || '';

// =================================
// CONFIGURAÇÕES DE TIMEOUT
// =================================
export const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '30000');
export const ELEMENT_TIMEOUT = parseInt(process.env.ELEMENT_TIMEOUT || '5000');
export const NAVIGATION_TIMEOUT = parseInt(process.env.NAVIGATION_TIMEOUT || '30000');

// =================================
// CONFIGURAÇÕES GERAIS
// =================================
export const DEFAULT_ZIPCODE = process.env.DEFAULT_ZIPCODE || '01001-000';
export const DIRETORIO_DEBUG = process.env.DIRETORIO_DEBUG || 'scraper/debug_files';
export const ENABLE_SCREENSHOTS = ['true', '1', 'yes'].includes((process.env.ENABLE_SCREENSHOTS || 'false').toLowerCase());
export const DEBUG = ['true', '1', 'yes'].includes((process.env.DEBUG || 'false').toLowerCase());

// =================================
// EXPORTAR CONFIGURAÇÃO COMPLETA
// =================================
export const CONFIG = {
    // API
    openai: {
        apiKey: OPENAI_API_KEY
    },
    
    // Filtros de produtos
    filters: {
        categories: CATEGORIES,
        minSales: MIN_SALES,
        minReviews: MIN_REVIEWS,
        minRating: MIN_RATING,
        minOrders: MIN_ORDERS,
        maxShippingCost: MAX_SHIPPING_COST,
        minProfitMargin: MIN_PROFIT_MARGIN
    },
    
    // Busca
    search: {
        maxProductsRaw: MAX_PRODUCTS_RAW,
        targetProductsFinal: TARGET_PRODUCTS_FINAL,
        maxPagesPerCategory: MAX_PAGES_PER_CATEGORY
    },
    
    // Puppeteer
    browser: {
        chromePath: CHROME_PATH,
        userDataDir: CHROME_USER_DATA_DIR,
        profile: CHROME_PROFILE,
        headless: HEADLESS,
        proxy: PUPPETEER_PROXY,
        slowMo: SLOW_MO        
    },
    
    // Timeouts
    timeouts: {
        page: PAGE_TIMEOUT,
        element: ELEMENT_TIMEOUT,
        navigation: NAVIGATION_TIMEOUT
    },
    
    // Geral
    general: {
        defaultZipcode: DEFAULT_ZIPCODE,
        debugDir: DIRETORIO_DEBUG,
        screenshots: ENABLE_SCREENSHOTS,
        debug: DEBUG
    }
};

// Log da configuração em modo debug
if (DEBUG) {
    console.log('🔧 Configuração carregada:', {
        categories: CATEGORIES.length,
        debug: DEBUG,
        headless: HEADLESS,
        screenshots: ENABLE_SCREENSHOTS
    });
}
