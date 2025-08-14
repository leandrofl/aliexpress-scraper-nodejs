/**
 * CONFIGURAÇÕES CENTRALIZADAS - ALIEXPRESS SCRAPER
 * 
 * Este arquivo centraliza todas as configurações do sistema, carregando
 * variáveis do arquivo .env e aplicando validações e transformações necessárias.
 * 
 * Funcionalidades:
 * - Carregamento automático de variáveis de ambiente
 * - Validação de configurações críticas
 * - Configurações inteligentes (valores auto-calculados)
 * - Tratamento robusto de erros de configuração
 * - Fallbacks para valores padrão seguros
 * 
 * @author LoopStore
 * @version 2.0.0 - Sistema de configuração inteligente
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';

// =================================
// INICIALIZAÇÃO E CARREGAMENTO DO .ENV
// =================================

/**
 * Configura o caminho do arquivo .env e carrega as variáveis
 * Implementa verificação de existência do arquivo
 */
let envLoaded = false;
try {
    // Sempre busca o .env na raiz do projeto
    const envPath = path.resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) {
        console.warn('⚠️  Arquivo .env não encontrado na raiz do projeto. Usando configurações padrão.');
        console.warn(`📁 Procurado em: ${envPath}`);
    } else {
        const result = dotenv.config({ path: envPath });
        if (result.error) {
            throw result.error;
        }
        envLoaded = true;
        console.log('✅ Arquivo .env carregado com sucesso');
    }
} catch (error) {
    console.error(`❌ Erro ao carregar arquivo .env: ${error.message}`);
    console.warn('⚠️  Continuando com configurações padrão...');
}

// =================================
// VALIDAÇÃO DE VARIÁVEIS CRÍTICAS
// =================================

/**
 * Valida configurações críticas que podem impactar o funcionamento
 * Emite alertas para configurações ausentes mas não interrompe execução
 */
function validateEnv() {
    try {
        const criticalVars = {
            OPENAI_API_KEY: {
                value: process.env.OPENAI_API_KEY,
                required: false, // Opcional pois filtros qualitativos estão comentados
                description: 'Chave da API OpenAI para filtros qualitativos'
            },
            CATEGORIES: {
                value: process.env.CATEGORIES,
                required: true,
                description: 'Categorias de produtos para processar'
            },
            CHROME_PATH: {
                value: process.env.CHROME_PATH,
                required: false,
                description: 'Caminho do executável do Chrome'
            }
        };

        let hasErrors = false;
        let hasWarnings = false;

        for (const [key, config] of Object.entries(criticalVars)) {
            if (!config.value || config.value.trim() === '') {
                if (config.required) {
                    console.error(`❌ Variável crítica '${key}' não configurada no arquivo .env`);
                    console.error(`   Descrição: ${config.description}`);
                    hasErrors = true;
                } else {
                    console.warn(`⚠️  Variável '${key}' não configurada no arquivo .env`);
                    console.warn(`   Descrição: ${config.description}`);
                    hasWarnings = true;
                }
            }
        }

        // Validações específicas
        if (process.env.TARGET_PRODUCTS_FINAL) {
            const target = parseInt(process.env.TARGET_PRODUCTS_FINAL);
            if (isNaN(target) || target <= 0) {
                console.warn('⚠️  TARGET_PRODUCTS_FINAL deve ser um número positivo');
                hasWarnings = true;
            }
        }

        // Relatório de validação
        if (hasErrors) {
            throw new Error('Configurações críticas ausentes impedem a execução');
        }
        
        if (hasWarnings) {
            console.warn('⚠️  Algumas configurações opcionais estão ausentes - usando valores padrão');
        } else {
            console.log('✅ Todas as configurações foram validadas com sucesso');
        }

    } catch (error) {
        console.error(`💥 Erro durante validação de configurações: ${error.message}`);
        throw error;
    }
}

// Executar validação com tratamento de erros
try {
    validateEnv();
} catch (validationError) {
    console.error('💥 Falha crítica na validação de configurações');
    console.error('🛠️  Verifique o arquivo .env e corrija os valores obrigatórios');
    process.exit(1);
}

// =================================
// CONFIGURAÇÕES DE API
// =================================

/**
 * Configurações de APIs externas
 */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const TENANT_ID = process.env.TENANT_ID || null;

// =================================
// CONFIGURAÇÕES DE PRODUTOS E FILTROS
// =================================

/**
 * Processa e valida configurações de categorias e filtros
 */
function processProductConfigs() {
    try {
        // Processar categorias com limpeza e validação
        const rawCategories = process.env.CATEGORIES || 'Casa e Cozinha,Tecnologia,Beleza,Lifestyle,Pets';
        const categories = rawCategories
            .split(',')
            .map(cat => cat.trim())
            .filter(cat => cat.length > 0); // Remove categorias vazias
        
        if (categories.length === 0) {
            throw new Error('Nenhuma categoria válida foi configurada');
        }

        // Validar e processar valores numéricos de filtros
        const numericConfigs = {
            MIN_SALES: { default: 500, min: 0, max: 1000000 },
            MIN_REVIEWS: { default: 20, min: 0, max: 100000 },
            MIN_RATING: { default: 4.2, min: 0, max: 5 },
            MIN_ORDERS: { default: 100, min: 0, max: 1000000 },
            MAX_SHIPPING_COST: { default: 20.0, min: 0, max: 1000 },
            MIN_PROFIT_MARGIN: { default: 0.15, min: 0, max: 1 }
        };

        const processedConfigs = {};
        for (const [key, config] of Object.entries(numericConfigs)) {
            try {
                const rawValue = process.env[key];
                let value = key.includes('RATING') || key.includes('MARGIN') || key.includes('COST') 
                    ? parseFloat(rawValue || config.default)
                    : parseInt(rawValue || config.default);
                
                // Validar limites
                if (isNaN(value) || value < config.min || value > config.max) {
                    console.warn(`⚠️  ${key} inválido (${rawValue}). Usando padrão: ${config.default}`);
                    value = config.default;
                }
                
                processedConfigs[key] = value;
            } catch (error) {
                console.warn(`⚠️  Erro ao processar ${key}: ${error.message}. Usando padrão: ${config.default}`);
                processedConfigs[key] = config.default;
            }
        }

        return { categories, ...processedConfigs };
        
    } catch (error) {
        console.error(`❌ Erro ao processar configurações de produtos: ${error.message}`);
        throw error;
    }
}

const productConfigs = processProductConfigs();

export const CATEGORIES = productConfigs.categories;
export const MIN_SALES = productConfigs.MIN_SALES;
export const MIN_REVIEWS = productConfigs.MIN_REVIEWS;
export const MIN_RATING = productConfigs.MIN_RATING;
export const MIN_ORDERS = productConfigs.MIN_ORDERS;
export const MAX_SHIPPING_COST = productConfigs.MAX_SHIPPING_COST;
export const MIN_PROFIT_MARGIN = productConfigs.MIN_PROFIT_MARGIN;

// =================================
// CONFIGURAÇÕES DE BUSCA INTELIGENTES
// =================================

/**
 * Processa configurações de busca com lógica inteligente
 * Implementa auto-cálculo de valores baseado em regras de negócio
 */
function processSearchConfigs() {
    try {
        // Carregar valores brutos com validação
        const rawMaxProducts = process.env.MAX_PRODUCTS_RAW ? parseInt(process.env.MAX_PRODUCTS_RAW) : 100;
        const rawTargetFinal = process.env.TARGET_PRODUCTS_FINAL ? parseInt(process.env.TARGET_PRODUCTS_FINAL) : 20;
        const rawMaxPages = process.env.MAX_PAGES_PER_CATEGORY ? parseInt(process.env.MAX_PAGES_PER_CATEGORY) : 5;

        // Validar valores básicos
        if (isNaN(rawTargetFinal) || rawTargetFinal <= 0) {
            throw new Error('TARGET_PRODUCTS_FINAL deve ser um número positivo');
        }

        if (isNaN(rawMaxProducts) || rawMaxProducts < 0) {
            throw new Error('MAX_PRODUCTS_RAW deve ser um número não-negativo');
        }

        if (isNaN(rawMaxPages) || rawMaxPages < 0) {
            throw new Error('MAX_PAGES_PER_CATEGORY deve ser um número não-negativo');
        }

        // Aplicar lógica de configuração inteligente
        const targetFinal = rawTargetFinal;
        
        // MAX_PRODUCTS_RAW: Se = 0, calcula como 2x TARGET_PRODUCTS_FINAL
        const maxProducts = rawMaxProducts === 0 ? (targetFinal * 2) : rawMaxProducts;
        
        // MAX_PAGES_PER_CATEGORY: Se = 0, ignora limite de páginas (define como 999)
        const maxPages = rawMaxPages === 0 ? 999 : rawMaxPages;

        // Log das configurações aplicadas
        console.log('🎯 Configurações de busca processadas:');
        console.log(`   TARGET_PRODUCTS_FINAL: ${targetFinal}`);
        console.log(`   MAX_PRODUCTS_RAW: ${maxProducts}${rawMaxProducts === 0 ? ' (auto-calculado)' : ''}`);
        console.log(`   MAX_PAGES_PER_CATEGORY: ${maxPages}${rawMaxPages === 0 ? ' (sem limite)' : ''}`);

        return {
            TARGET_PRODUCTS_FINAL: targetFinal,
            MAX_PRODUCTS_RAW: maxProducts,
            MAX_PAGES_PER_CATEGORY: maxPages
        };

    } catch (error) {
        console.error(`❌ Erro ao processar configurações de busca: ${error.message}`);
        throw error;
    }
}

const searchConfigs = processSearchConfigs();

export const TARGET_PRODUCTS_FINAL = searchConfigs.TARGET_PRODUCTS_FINAL;
export const MAX_PRODUCTS_RAW = searchConfigs.MAX_PRODUCTS_RAW;
export const MAX_PAGES_PER_CATEGORY = searchConfigs.MAX_PAGES_PER_CATEGORY;

// =================================
// CONFIGURAÇÕES DO PUPPETEER
// =================================

/**
 * Processa e valida configurações do Puppeteer/Chrome
 */
function processBrowserConfigs() {
    try {
        // Caminho do Chrome com validação de existência
        let chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
        
        // Validar configurações booleanas
        const headless = process.env.HEADLESS !== 'false'; // Padrão: true (headless)
        const screenshots = ['true', '1', 'yes'].includes((process.env.ENABLE_SCREENSHOTS || 'false').toLowerCase());
        
        // Validar SlowMo (velocidade de automação)
        let slowMo = 0;
        try {
            const rawSlowMo = parseInt(process.env.SLOW_MO || '0');
            if (!isNaN(rawSlowMo) && rawSlowMo >= 0 && rawSlowMo <= 5000) {
                slowMo = rawSlowMo;
            } else {
                console.warn('⚠️  SLOW_MO inválido. Usando padrão: 0');
            }
        } catch (error) {
            console.warn(`⚠️  Erro ao processar SLOW_MO: ${error.message}`);
        }

        return {
            chromePath,
            userDataDir: process.env.CHROME_USER_DATA_DIR || '',
            profile: process.env.CHROME_PROFILE || '',
            headless,
            proxy: process.env.PUPPETEER_PROXY || '',
            slowMo,
            screenshots
        };

    } catch (error) {
        console.error(`❌ Erro ao processar configurações do browser: ${error.message}`);
        throw error;
    }
}

const browserConfigs = processBrowserConfigs();

export const CHROME_PATH = browserConfigs.chromePath;
export const CHROME_USER_DATA_DIR = browserConfigs.userDataDir;
export const CHROME_PROFILE = browserConfigs.profile;
export const HEADLESS = browserConfigs.headless;
export const SLOW_MO = browserConfigs.slowMo;
export const PUPPETEER_PROXY = browserConfigs.proxy;
export const ENABLE_SCREENSHOTS = browserConfigs.screenshots;

// =================================
// CONFIGURAÇÕES DE TIMEOUT
// =================================

/**
 * Processa e valida configurações de timeout
 * Garante valores seguros para evitar travamentos
 */
function processTimeoutConfigs() {
    try {
        const timeoutConfigs = {
            PAGE_TIMEOUT: { default: 90000, min: 5000, max: 300000 },
            ELEMENT_TIMEOUT: { default: 30000, min: 1000, max: 120000 },
            NAVIGATION_TIMEOUT: { default: 90000, min: 5000, max: 300000 }
        };

        const processedTimeouts = {};
        
        for (const [key, config] of Object.entries(timeoutConfigs)) {
            try {
                const rawValue = parseInt(process.env[key] || config.default);
                let value = config.default;
                
                if (!isNaN(rawValue) && rawValue >= config.min && rawValue <= config.max) {
                    value = rawValue;
                } else {
                    console.warn(`⚠️  ${key} inválido (${rawValue}). Usando padrão: ${config.default}ms`);
                }
                
                processedTimeouts[key] = value;
            } catch (error) {
                console.warn(`⚠️  Erro ao processar ${key}: ${error.message}. Usando padrão: ${config.default}ms`);
                processedTimeouts[key] = config.default;
            }
        }

        return processedTimeouts;

    } catch (error) {
        console.error(`❌ Erro ao processar configurações de timeout: ${error.message}`);
        throw error;
    }
}

const timeoutConfigs = processTimeoutConfigs();

export const PAGE_TIMEOUT = timeoutConfigs.PAGE_TIMEOUT;
export const ELEMENT_TIMEOUT = timeoutConfigs.ELEMENT_TIMEOUT;
export const NAVIGATION_TIMEOUT = timeoutConfigs.NAVIGATION_TIMEOUT;

// =================================
// CONFIGURAÇÕES GERAIS
// =================================

/**
 * Configurações gerais do sistema
 */
export const DEFAULT_ZIPCODE = process.env.DEFAULT_ZIPCODE || '01001-000';
export const DIRETORIO_DEBUG = process.env.DIRETORIO_DEBUG || 'scraper/debug_files';
export const DEBUG = ['true', '1', 'yes'].includes((process.env.DEBUG || 'false').toLowerCase());

// =================================
// CONFIGURAÇÃO CONSOLIDADA PARA EXPORTAÇÃO
// =================================

/**
 * Objeto de configuração consolidado para fácil acesso em outros módulos
 * Organizado por categorias lógicas
 */
export const CONFIG = {
    // Informações de ambiente
    environment: {
        envLoaded,
        debug: DEBUG
    },

    // API
    api: {
        openaiKey: OPENAI_API_KEY
    },
    

    tenant: { id: TENANT_ID },

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
    
    // Configurações de busca
    search: {
        maxProductsRaw: MAX_PRODUCTS_RAW,
        targetProductsFinal: TARGET_PRODUCTS_FINAL,
        maxPagesPerCategory: MAX_PAGES_PER_CATEGORY
    },
    
    // Configurações do browser
    browser: {
        chromePath: CHROME_PATH,
        userDataDir: CHROME_USER_DATA_DIR,
        profile: CHROME_PROFILE,
        headless: HEADLESS,
        proxy: PUPPETEER_PROXY,
        slowMo: SLOW_MO,
        screenshots: ENABLE_SCREENSHOTS      
    },
    
    // Timeouts
    timeouts: {
        page: PAGE_TIMEOUT,
        element: ELEMENT_TIMEOUT,
        navigation: NAVIGATION_TIMEOUT
    },
    
    // Configurações gerais
    general: {
        defaultZipcode: DEFAULT_ZIPCODE,
        debugDir: DIRETORIO_DEBUG,
        debug: DEBUG
    }
};

// =================================
// LOG DE INICIALIZAÇÃO
// =================================

/**
 * Log resumido das configurações carregadas (apenas em modo debug)
 */
if (DEBUG) {
    try {
        console.log('🔧 Configuração carregada:', {
            categories: CATEGORIES.length,
            debug: DEBUG,
            headless: HEADLESS,
            screenshots: ENABLE_SCREENSHOTS,
            targetProducts: TARGET_PRODUCTS_FINAL,
            maxProducts: MAX_PRODUCTS_RAW,
            maxPages: MAX_PAGES_PER_CATEGORY
        });
    } catch (logError) {
        console.warn(`⚠️  Erro ao exibir log de configuração: ${logError.message}`);
    }
}

// =================================
// VALIDAÇÃO FINAL
// =================================

/**
 * Validação final de consistência das configurações
 */
try {
    // Verificar consistência entre configurações de busca
    if (MAX_PRODUCTS_RAW < TARGET_PRODUCTS_FINAL && MAX_PRODUCTS_RAW > 0) {
        console.warn('⚠️  MAX_PRODUCTS_RAW é menor que TARGET_PRODUCTS_FINAL. Isso pode impedir atingir a meta.');
    }

    // Verificar configurações de proxy
    if (PUPPETEER_PROXY && !PUPPETEER_PROXY.match(/^https?:\/\/.+/)) {
        console.warn('⚠️  Formato de proxy pode estar incorreto. Use: http://host:porta');
    }

    console.log('✅ Configurações carregadas e validadas com sucesso');

} catch (finalValidationError) {
    console.error(`❌ Erro na validação final: ${finalValidationError.message}`);
    console.warn('⚠️  Sistema continuará com as configurações atuais');
}
