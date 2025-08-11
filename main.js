/**
 * SCRAPER PRINCIPAL - ALIEXPRESS
 * 
 * Este é o arquivo principal que orquestra todo o processo de scraping do AliExpress.
 * Processa categorias de produtos, aplica filtros de margem e qualidade, e exporta
 * os resultados para planilhas Excel.
 * 
 * Fluxo principal:
 * 1. Configura e inicializa o browser (Puppeteer + Stealth)
 * 2. Para cada categoria configurada:
 *    - Executa scraping com filtros otimizados (margem → quantitativo → qualitativo)
 *    - Exporta produtos aprovados para Excel
 * 3. Realiza cleanup completo do browser
 * 
 * @author LoopStore
 * @version 2.0.0 - Refatorado com validação de margem prioritária
 */

import { CONFIG, CATEGORIES } from './config.js';
import { setupBrowser, processCategory } from './scraper/aliexpressScraper.js';
import { logInfo, logSucesso, logErro } from './scraper/utils.js';
import { salvarProdutoCompleto, obterEstatisticasGerais } from './database/database-integration.js';

const iniciar = async () => {
    let browser = null;
    try {
        logInfo('🚀 Iniciando processo completo de scraping por categoria...');
        try {
            browser = await setupBrowser();
            logInfo('✅ Browser configurado e inicializado com sucesso');
        } catch (browserError) {
            logErro(`❌ Erro crítico ao configurar browser: ${browserError.message}`);
            logErro('💡 Verifique se o Chrome está instalado e as configurações do .env estão corretas');
            throw new Error(`Falha na inicialização do browser: ${browserError.message}`);
        }
        const resultadosGerais = [];
        let totalProdutosSalvos = 0;
        for (let i = 0; i < CATEGORIES.length; i++) {
            const categoria = CATEGORIES[i];
            logInfo(`\n📂 Processando categoria ${i + 1}/${CATEGORIES.length}: '${categoria}'`);
            try {
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout de categoria excedido')), 600000)
                );
                const resultado = await Promise.race([
                    processCategory(browser, categoria),
                    timeoutPromise
                ]);
                if (!resultado || typeof resultado !== 'object') {
                    throw new Error('Resultado inválido retornado pelo processamento da categoria');
                }
                const produtos = resultado.produtosTotalmenteAprovados || resultado;
                if (!Array.isArray(produtos)) {
                    throw new Error('Lista de produtos retornada não é um array válido');
                }
                // Salvar produtos no Supabase
                for (const produto of produtos) {
                    if (!produto || !produto.product_id) {
                        logErro(`⚠️ Produto inválido para salvar no banco: ${JSON.stringify(produto)}`);
                        continue;
                    }
                    try {
                        await salvarProdutoCompleto(produto);
                        totalProdutosSalvos++;
                    } catch (dbError) {
                        logErro(`⚠️ Erro ao salvar produto no banco: ${dbError.message}`);
                    }
                }
                if (CONFIG.debug) {
                    console.log('🐛 [DEBUG] Resultado da categoria:', {
                        categoria: categoria,
                        produtosTotais: produtos.length,
                        comMargem: resultado.produtosComMargemAprovada?.length || 'N/A',
                        estatisticas: resultado.estatisticas || 'N/A',
                        timestamp: new Date().toISOString()
                    });
                }
                logSucesso(`📦 Categoria '${categoria}' finalizada com ${produtos.length} produtos totalmente aprovados salvos.`);
                resultadosGerais.push({
                    categoria,
                    produtos: produtos.length,
                    status: 'sucesso'
                });
            } catch (categoryError) {
                logErro(`❌ Erro ao processar categoria '${categoria}': ${categoryError.message}`);
                if (categoryError.message.includes('Timeout')) {
                    logErro('💡 Categoria excedeu tempo limite. Considere aumentar o timeout ou dividir em subcategorias.');
                } else if (categoryError.message.includes('Navigation')) {
                    logErro('💡 Erro de navegação. Verifique conexão de internet e configurações de proxy.');
                } else if (categoryError.message.includes('Element')) {
                    logErro('💡 Erro ao localizar elementos. Site pode ter mudado estrutura.');
                }
                resultadosGerais.push({
                    categoria,
                    produtos: 0,
                    status: 'erro',
                    erro: categoryError.message
                });
                continue;
            }
            if (i < CATEGORIES.length - 1) {
                logInfo('⏳ Aguardando 2 segundos antes da próxima categoria...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        const sucessos = resultadosGerais.filter(r => r.status === 'sucesso');
        const erros = resultadosGerais.filter(r => r.status === 'erro');
        const totalProdutos = sucessos.reduce((sum, r) => sum + r.produtos, 0);
        logInfo('\n📊 RELATÓRIO FINAL DE EXECUÇÃO:');
        logInfo(`   ✅ Categorias processadas com sucesso: ${sucessos.length}/${CATEGORIES.length}`);
        logInfo(`   ❌ Categorias com erro: ${erros.length}/${CATEGORIES.length}`);
        logInfo(`   📦 Total de produtos processados: ${totalProdutos}`);
        logInfo(`   💾 Total de produtos salvos no banco: ${totalProdutosSalvos}`);
        if (erros.length > 0) {
            logInfo('   🔍 Categorias com erro:');
            erros.forEach(erro => {
                logInfo(`      - ${erro.categoria}: ${erro.erro}`);
            });
        }
        // Estatísticas finais do banco
        try {
            const stats = await obterEstatisticasGerais();
            logInfo('📊 Estatísticas finais do Supabase:');
            logInfo(`   Total Produtos: ${stats.totalProdutos}`);
            logInfo(`   Score Médio: ${stats.scoreMedia}`);
            logInfo(`   Diamante: ${stats.produtosDiamante}, Ouro: ${stats.produtosOuro}, Prata: ${stats.produtosPrata}, Bronze: ${stats.produtosBronze}`);
            logInfo(`   Categoria Popular: ${stats.categoriaMaisPopular}`);
        } catch (statsError) {
            logErro(`⚠️ Erro ao obter estatísticas finais do banco: ${statsError.message}`);
        }
    } catch (error) {
        logErro(`💥 Erro crítico no processo principal: ${error.message}`);
        logErro('🛠️ Verifique logs anteriores para detalhes específicos do erro.');
        if (CONFIG.debug) {
            console.error('🐛 [DEBUG] Stack trace completo:', error.stack);
        }
    } finally {
        try {
            if (browser) {
                await cleanupBrowser(browser);
                logInfo('✅ Processo de scraping finalizado para todas as categorias.');
            }
        } catch (cleanupError) {
            logErro(`⚠️ Erro durante cleanup: ${cleanupError.message}`);
            logInfo('✅ Processo de scraping finalizado (cleanup com problemas).');
        }
    }
};

async function cleanupBrowser(browser) {
    if (!browser) {
        logInfo('⚠️ Browser já foi fechado ou não foi inicializado');
        return;
    }
    try {
        logInfo('🧹 Iniciando cleanup do browser...');
        try {
            const pages = await browser.pages();
            logInfo(`🔄 Fechando ${pages.length} página(s) aberta(s)...`);
            for (const page of pages) {
                try {
                    if (!page.isClosed()) {
                        await page.close();
                    }
                } catch (pageError) {
                    console.warn(`⚠️ Erro ao fechar página individual: ${pageError.message}`);
                }
            }
        } catch (pagesError) {
            console.warn(`⚠️ Erro ao obter lista de páginas: ${pagesError.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!browser.isConnected || !browser.isConnected()) {
            logInfo('ℹ️ Browser já foi desconectado');
        } else {
            await browser.close();
            logInfo('✅ Browser fechado com sucesso');
        }
    } catch (error) {
        logErro(`⚠️ Erro durante cleanup normal do browser: ${error.message}`);
        try {
            logInfo('🔧 Tentando forçar fechamento do Chrome...');
            const { spawn } = require('child_process');
            const killProcess = spawn('taskkill', ['/f', '/im', 'chrome.exe'], { 
                stdio: 'ignore',
                detached: true 
            });
            killProcess.unref();
            logInfo('⚡ Comando de força fechamento executado');
        } catch (killError) {
            logErro(`❌ Falha ao forçar fechamento do Chrome: ${killError.message}`);
            logErro('💡 Chrome pode continuar executando. Feche manualmente se necessário.');
        }
    }
}

process.on('SIGINT', async () => {
    logInfo('\n🛑 Sinal de interrupção recebido (Ctrl+C)');
    logInfo('🧹 Executando cleanup antes de sair...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logInfo('\n🛑 Sinal de terminação recebido');
    logInfo('🧹 Executando cleanup antes de sair...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logErro(`💥 Exceção não capturada: ${error.message}`);
    console.error('🐛 Stack trace:', error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logErro(`💥 Promise rejeitada não tratada: ${reason}`);
    console.error('🐛 Promise:', promise);
    process.exit(1);
});

iniciar().catch((error) => {
    logErro(`💥 Erro fatal na inicialização: ${error.message}`);
    process.exit(1);
});
