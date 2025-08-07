#!/usr/bin/env node

/**
 * @fileoverview Script principal para executar o scraper com integração Supabase
 * @description Gerencia setup do banco, execução do scraper e relatórios finais
 * 
 * @author Sistema de Scraping AliExpress - Main Executor v1.0
 */

import { executarSetupBanco } from './database/setup-database.js';
import { setupBrowser, processCategory } from './scraper/aliexpressScraper.js';
import { obterEstatisticasGerais } from './database/database-integration.js';
import { CATEGORIES } from './config.js';

/**
 * Cores para output no terminal
 */
const cores = {
    reset: '\x1b[0m',
    vermelho: '\x1b[31m',
    verde: '\x1b[32m',
    amarelo: '\x1b[33m',
    azul: '\x1b[34m',
    magenta: '\x1b[35m',
    ciano: '\x1b[36m',
    branco: '\x1b[37m'
};

/**
 * Logger colorido para o terminal
 */
function log(cor, emoji, mensagem) {
    console.log(`${cor}${emoji} ${mensagem}${cores.reset}`);
}

/**
 * Exibir banner de início
 */
function exibirBanner() {
    console.clear();
    console.log(`${cores.ciano}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    🚀 ALIEXPRESS SCRAPER + SUPABASE INTEGRATION v3.0        ║
║                                                              ║
║    📊 Sistema Completo de Mineração de Produtos             ║
║    💾 Persistência Automática no Banco de Dados             ║
║    🎯 Análise Inteligente com Machine Learning               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${cores.reset}`);
}

/**
 * Exibir menu de categorias
 */
function exibirMenuCategorias() {
    log(cores.amarelo, '📋', 'CATEGORIAS DISPONÍVEIS:');
    console.log('');
    
    CATEGORIES.forEach((categoria, index) => {
        log(cores.branco, `  ${index + 1}.`, categoria);
    });
    
    log(cores.branco, `  ${CATEGORIES.length + 1}.`, 'TODAS as categorias');
    console.log('');
}

/**
 * Obter escolha do usuário
 */
async function obterEscolhaUsuario() {
    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${cores.verde}🎯 Escolha uma opção (1-${CATEGORIES.length + 1}): ${cores.reset}`, (resposta) => {
            rl.close();
            resolve(parseInt(resposta));
        });
    });
}

/**
 * Executar scraping para uma categoria específica
 */
async function executarScrapingCategoria(browser, categoria) {
    try {
        log(cores.azul, '🔍', `Processando categoria: ${categoria}`);
        
        const produtos = await processCategory(browser, categoria);
        
        log(cores.verde, '✅', `Categoria ${categoria} concluída: ${produtos.length} produtos`);
        
        return produtos;
        
    } catch (error) {
        log(cores.vermelho, '❌', `Erro na categoria ${categoria}: ${error.message}`);
        return [];
    }
}

/**
 * Exibir estatísticas finais do banco
 */
async function exibirEstatisticasFinais() {
    try {
        log(cores.magenta, '📊', 'OBTENDO ESTATÍSTICAS FINAIS DO BANCO...');
        
        const stats = await obterEstatisticasGerais();
        
        console.log(`${cores.ciano}
╔══════════════════════════════════════════════════════════════╗
║                    📊 RELATÓRIO FINAL                        ║
╠══════════════════════════════════════════════════════════════╣
║  📦 Total de Produtos: ${String(stats.totalProdutos).padStart(31)} ║
║  📈 Total de Métricas: ${String(stats.totalMetricas).padStart(31)} ║
║  🏆 Categoria Popular: ${String(stats.categoriaMaisPopular || 'N/A').padStart(31)} ║
║  🎯 Score Médio: ${String(stats.scoreMedia || 'N/A').padStart(37)} ║
║  💎 Produtos Diamante: ${String(stats.produtosDiamante || 0).padStart(30)} ║
║  🥇 Produtos Ouro: ${String(stats.produtosOuro || 0).padStart(34)} ║
║  🥈 Produtos Prata: ${String(stats.produtosPrata || 0).padStart(33)} ║
║  🥉 Produtos Bronze: ${String(stats.produtosBronze || 0).padStart(32)} ║
╚══════════════════════════════════════════════════════════════╝
${cores.reset}`);
        
        if (stats.erro) {
            log(cores.amarelo, '⚠️', `Algumas estatísticas podem estar incompletas: ${stats.erro}`);
        }
        
    } catch (error) {
        log(cores.vermelho, '❌', `Erro ao obter estatísticas: ${error.message}`);
    }
}

/**
 * Função principal
 */
async function main() {
    try {
        // Exibir banner
        exibirBanner();
        
        // 1. SETUP DO BANCO
        log(cores.amarelo, '🔧', 'FASE 1: CONFIGURAÇÃO DO BANCO DE DADOS');
        console.log('');
        
        await executarSetupBanco();
        console.log('');
        
        // 2. ESCOLHA DA CATEGORIA
        log(cores.amarelo, '🎯', 'FASE 2: SELEÇÃO DE CATEGORIAS');
        console.log('');
        
        exibirMenuCategorias();
        const escolha = await obterEscolhaUsuario();
        
        if (escolha < 1 || escolha > CATEGORIES.length + 1) {
            log(cores.vermelho, '❌', 'Opção inválida!');
            process.exit(1);
        }
        
        // 3. SETUP DO BROWSER
        log(cores.amarelo, '🌐', 'FASE 3: INICIALIZANDO BROWSER...');
        console.log('');
        
        const browser = await setupBrowser();
        log(cores.verde, '✅', 'Browser configurado com sucesso!');
        console.log('');
        
        // 4. EXECUÇÃO DO SCRAPING
        log(cores.amarelo, '🚀', 'FASE 4: EXECUÇÃO DO SCRAPING');
        console.log('');
        
        let todosProdutos = [];
        let categoriasProcessadas = 0;
        
        if (escolha === CATEGORIES.length + 1) {
            // Processar TODAS as categorias
            log(cores.magenta, '🎪', 'Processando TODAS as categorias...');
            
            for (const categoria of CATEGORIES) {
                const produtos = await executarScrapingCategoria(browser, categoria);
                todosProdutos.push(...produtos);
                categoriasProcessadas++;
                
                // Pausa entre categorias
                if (categoriasProcessadas < CATEGORIES.length) {
                    log(cores.amarelo, '⏸️', 'Pausa de 30 segundos entre categorias...');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            }
        } else {
            // Processar categoria específica
            const categoriaEscolhida = CATEGORIES[escolha - 1];
            const produtos = await executarScrapingCategoria(browser, categoriaEscolhida);
            todosProdutos.push(...produtos);
            categoriasProcessadas = 1;
        }
        
        // Fechar browser
        await browser.close();
        log(cores.verde, '🔒', 'Browser fechado');
        console.log('');
        
        // 5. RELATÓRIO FINAL
        log(cores.amarelo, '📋', 'FASE 5: RELATÓRIO FINAL');
        console.log('');
        
        log(cores.verde, '🎉', `SCRAPING CONCLUÍDO COM SUCESSO!`);
        log(cores.branco, '📊', `Categorias processadas: ${categoriasProcessadas}`);
        log(cores.branco, '📦', `Total de produtos coletados: ${todosProdutos.length}`);
        console.log('');
        
        // Estatísticas do banco
        await exibirEstatisticasFinais();
        
        // 6. INSTRUÇÕES FINAIS
        console.log(`${cores.verde}
╔══════════════════════════════════════════════════════════════╗
║                      🎯 PRÓXIMOS PASSOS                      ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. 📊 Acesse o Supabase Dashboard para visualizar dados    ║
║  2. 🔍 Use as queries SQL do README para análises           ║
║  3. 📈 Configure alertas para novos produtos                ║
║  4. 🚀 Integre com sua loja para automação                  ║
║                                                              ║
║  💡 Dica: Execute novamente para atualizar dados!           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${cores.reset}`);
        
        process.exit(0);
        
    } catch (error) {
        log(cores.vermelho, '💥', `ERRO CRÍTICO: ${error.message}`);
        
        console.log(`${cores.amarelo}
╔══════════════════════════════════════════════════════════════╗
║                    🔧 DIAGNÓSTICO DE ERRO                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. ✅ Verifique se o arquivo .env existe e está correto    ║
║  2. ✅ Confirme se o Supabase está configurado              ║
║  3. ✅ Execute o setup-database.js separadamente            ║
║  4. ✅ Teste a conexão de internet                          ║
║                                                              ║
║  📞 Suporte: Verifique os logs acima para mais detalhes     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${cores.reset}`);
        
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
