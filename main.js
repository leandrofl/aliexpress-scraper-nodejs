import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CONFIG, CATEGORIES } from './config.js';
import { processCategory } from './scraper/aliexpressScraper.js';
import { exportToExcel } from './export/excelExporter.js';
import { logInfo, logSucesso, logErro } from './scraper/utils.js';

puppeteer.use(StealthPlugin());

const iniciar = async () => {
    logInfo('🚀 Iniciando processo completo de scraping por categoria...');
    
    // 🔴 BREAKPOINT: Configuração inicial
    console.log('🐛 [DEBUG] Configurações carregadas:', {
        categories: CATEGORIES,
        headless: CONFIG.browser.headless,
        debug: CONFIG.general.debug
    });

    const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--lang=pt-BR'
    ];

    if (CONFIG.browser.proxy) {
        launchArgs.push(`--proxy-server=${CONFIG.browser.proxy}`);
    }

    const browser = await puppeteer.launch({
        headless: CONFIG.browser.headless,
        executablePath: CONFIG.browser.chromePath,
        //userDataDir: CONFIG.browser.userDataDir, // Descomente se quiser usar um perfil específico
        slowMo: CONFIG.browser.slowMo,
        args: launchArgs
    });

    // 🔴 BREAKPOINT: Browser iniciado
    console.log('🐛 [DEBUG] Browser iniciado com sucesso');

    if (CONFIG.browser.proxy) {
        launchArgs.push(`--proxy-server=${CONFIG.browser.proxy}`);
    }

    for (const categoria of CATEGORIES) {
        try {
            // 🔴 BREAKPOINT: Início de cada categoria
            logInfo(`📂 Categoria: ${categoria}`);
            console.log('🐛 [DEBUG] Processando categoria:', categoria);
            
            const produtos = await processCategory(browser, categoria);
            
            // 🔴 BREAKPOINT: Produtos encontrados
            console.log('🐛 [DEBUG] Produtos encontrados:', produtos.length);
            
            await exportToExcel(produtos, categoria);
            logSucesso(`📦 Categoria '${categoria}' finalizada com ${produtos.length} produtos salvos.\n`);
        } catch (err) {
            // 🔴 BREAKPOINT: Erro na categoria
            console.log('🐛 [DEBUG] Erro na categoria:', categoria, err.message);
            logErro(`Erro ao processar categoria '${categoria}': ${err.message}`);
        }
    }

    await browser.close();
    logInfo('✅ Processo de scraping finalizado para todas as categorias.');
};

iniciar();
