import { CONFIG, CATEGORIES } from './config.js';
import { setupBrowser, processCategory } from './scraper/aliexpressScraper.js';
import { exportToExcel } from './export/excelExporter.js';
import { logInfo, logSucesso, logErro } from './scraper/utils.js';

const iniciar = async () => {
    logInfo('🚀 Iniciando processo completo de scraping por categoria...');
    
    // Usar a função de setup do aliexpressScraper
    const browser = await setupBrowser();

    for (const categoria of CATEGORIES) {
        try {
            const produtos = await processCategory(browser, categoria);
            
            console.log('🐛 [DEBUG] Produtos encontrados:', produtos.length);
            
            await exportToExcel(produtos, categoria);
            logSucesso(`📦 Categoria '${categoria}' finalizada com ${produtos.length} produtos salvos.\n`);
        } catch (err) {
            // 🔴 BREAKPOINT: Erro na categoria
            console.log('🐛 [DEBUG] Erro na categoria:', categoria, err.message);
            logErro(`Erro ao processar categoria '${categoria}': ${err.message}`);
        }
    }

    try {
        await cleanupBrowser(browser);
        logInfo('✅ Processo de scraping finalizado para todas as categorias.');
    } catch (closeError) {
        // Ignorar erros de fechamento do browser
        logInfo('✅ Processo de scraping finalizado para todas as categorias.');
    }
};

// Função de cleanup robusto
async function cleanupBrowser(browser) {
  try {
    // Fechar todas as páginas abertas primeiro
    const pages = await browser.pages();
    for (const page of pages) {
      try {
        await page.close();
      } catch (error) {
        // Ignora erros ao fechar páginas individuais
      }
    }
    
    // Aguardar um pouco para processos se organizarem
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fechar o browser
    await browser.close();
  } catch (error) {
    console.log('⚠️  Processo do browser finalizado externamente');
    
    // Força encerramento em último caso (Windows)
    try {
      const { spawn } = require('child_process');
      spawn('taskkill', ['/f', '/im', 'chrome.exe'], { stdio: 'ignore' });
    } catch (killError) {
      // Ignora erro se não conseguir forçar encerramento
    }
  }
}

iniciar();
