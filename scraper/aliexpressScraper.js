/**
 * ALIEXPRESS SCRAPER - SISTEMA ROBUSTO DE MINERAÇÃO DE PRODUTOS
 * 
 * Este módulo implementa um sistema completo de web scraping para o AliExpress
 * com foco em evasão de detecção, tratamento robusto de erros e análise
 * inteligente de produtos para dropshipping.
 * 
 * Funcionalidades principais:
 * - Navegação stealth com puppeteer-extra
 * - Extração inteligente de dados via DOM e API
 * - Sistema de filtros quantitativos e qualitativos
 * - Análise de margem de lucro integrada
 * - Gestão robusta de browser e recursos
 * - Sistema de recuperação de falhas
 * 
 * @author LoopStore
 * @version 3.0.0 - Sistema robusto com margin-first flow
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CHROME_PATH, HEADLESS } from '../config.js';
import {
  scrollUntilAllProductsLoaded,
  tirarScreenshot,
  salvarHtmlPesquisa,
  salvarJsonProduto,
  delay,
  randomDelay,
  logInfo,
  logSucesso,
  logErro,
  filtrarPorMaisVendidos
} from './utils.js';

import {
  applyQuantitativeFilter
} from '../filters/quantitative.js';

import {
  applyQualitativeFilter
} from '../filters/qualitative.js';

import {
  validarMargemOtimizada
} from '../marginValidation/margin-validator.js';

import {
  buscarProdutosCompativeisML,
  buscarMelhorProdutoML
} from '../marginValidation/mercado-livre-scraper.js';

import {
  assessRisk
} from '../filters/riskAssessment.js';

import {
  configurarPersistenciaCookies,
  iniciarLimpezaAutomaticaCookies
} from '../utils/persistencia-cookies.js';

import {
  iniciarLimpezaAutomatica
} from '../utils/gerenciador-temporarios.js';

import {
  calcularScoreTotal,
  ordenarPorScore,
  gerarRelatorioScores
} from '../scoring/product-scorer.js';

import {
    verificarDuplicidade,
    marcarComoProcessado,
    filtrarDuplicados
} from '../utils/duplicate-checker.js';

import {
  iniciarMetricas,
  metricas
} from '../metrics/scraping-metrics.js';

import {
  salvarProdutoCompleto,
  salvarMetricasSessao,
  verificarDuplicidadeDB,
  obterEstatisticasGerais
} from '../database/database-integration.js';

import {
  CATEGORIES,
  MAX_PRODUCTS_RAW,
  TARGET_PRODUCTS_FINAL,
  MAX_PAGES_PER_CATEGORY
} from '../config.js';

// =================================
// CONFIGURAÇÃO E INICIALIZAÇÃO DO BROWSER
// =================================

/**
 * Configura e inicializa o browser com configurações otimizadas
 * para evasão de detecção e performance estável
 * 
 * @returns {Promise<Browser>} Instância do browser configurado
 */
export async function setupBrowser() {
    try {
        logInfo('🚀 Iniciando configuração do browser stealth...');

        // 🧠 Melhoria 5: Iniciar limpeza automática de cookies
        iniciarLimpezaAutomaticaCookies();
        
        // 🗂 Melhoria 3: Iniciar limpeza automática de temporários
        iniciarLimpezaAutomatica();

        // Configurar Stealth Plugin com tratamento de erro
        try {
            puppeteer.use(StealthPlugin());
            logInfo('✅ Plugin Stealth configurado com sucesso');
        } catch (stealthError) {
            logErro(`❌ Erro ao configurar plugin stealth: ${stealthError.message}`);
            throw new Error('Falha crítica na configuração stealth');
        }

        // Log de configurações para debug
        logInfo('🐛 Configurações carregadas:', {
            categories: CATEGORIES,
            maxProducts: MAX_PRODUCTS_RAW,
            targetProducts: TARGET_PRODUCTS_FINAL,
            maxPages: MAX_PAGES_PER_CATEGORY
        });

        // Configurações de launch otimizadas para Windows
        const launchArgs = [
            // Segurança e sandbox
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            
            // Evasão de detecção
            '--disable-blink-features=AutomationControlled',
            '--disable-features=VizDisplayCompositor',
            '--disable-web-security',
            '--disable-features=site-per-process',
            '--disable-ipc-flooding-protection',
            
            // Performance e estabilidade
            '--no-first-run',
            '--disable-infobars',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-accelerated-2d-canvas',
            '--single-process',
            '--no-zygote',
            
            // Localização
            '--lang=pt-BR',
            '--accept-lang=pt-BR,pt,en'
        ];

        // Configurações do browser
        const browserConfig = {
            headless: HEADLESS,
            devtools: false,
            slowMo: 150, // Delay entre ações para parecer mais humano
            args: launchArgs,
            defaultViewport: null, // Usar viewport do sistema
            ignoreDefaultArgs: ['--disable-extensions'], // Permitir algumas extensões
            timeout: 60000, // Timeout de 60 segundos para inicialização
        };

        // Adicionar caminho do Chrome se especificado
        // Usar CHROME_PATH processado pelo config.js
        if (CHROME_PATH) {
            browserConfig.executablePath = CHROME_PATH;
            logInfo(`🔧 Usando Chrome customizado: ${CHROME_PATH}`);
        }

        // 🧠 Melhoria 5: Configurar persistência de cookies
        const configComCookies = configurarPersistenciaCookies(browserConfig);

        // Lançar browser com tratamento de erro
        let browser;
        try {
            browser = await puppeteer.launch(configComCookies);
            logSucesso('✅ Browser iniciado com sucesso');
        } catch (launchError) {
            logErro(`❌ Erro ao lançar browser: ${launchError.message}`);
            
            // Tentar fallback sem algumas configurações problemáticas
            logInfo('🔄 Tentando configuração de fallback...');
            
            const fallbackConfig = {
                ...browserConfig,
                args: launchArgs.filter(arg => 
                    !arg.includes('single-process') && 
                    !arg.includes('no-zygote')
                ),
                slowMo: 0
            };
            
            browser = await puppeteer.launch(fallbackConfig);
            logSucesso('✅ Browser iniciado com configuração de fallback');
        }

        // Verificar se o browser foi inicializado corretamente
        if (!browser) {
            throw new Error('Browser não foi inicializado');
        }

        // Configurar handlers para cleanup automático
        setupBrowserCleanupHandlers(browser);

        // Configurar página padrão
        try {
            const pages = await browser.pages();
            if (pages.length > 0) {
                const firstPage = pages[0];
                
                // Configurar viewport padrão
                await firstPage.setViewport({ width: 1920, height: 1080 });
                
                // User agent realístico
                await firstPage.setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                );
                
                logInfo('✅ Página padrão configurada');
            }
        } catch (pageSetupError) {
            logErro(`⚠️ Erro na configuração da página padrão: ${pageSetupError.message}`);
            // Não é crítico, continuar
        }

        logSucesso('🎯 Browser completamente configurado e pronto para uso');
        return browser;

    } catch (error) {
        logErro(`💥 Erro crítico na configuração do browser: ${error.message}`);
        throw new Error(`Falha na inicialização do browser: ${error.message}`);
    }
}

/**
 * Configura handlers para limpeza automática do browser
 * Garante que recursos sejam liberados em caso de erro ou interrupção
 * 
 * @param {Browser} browser - Instância do browser
 */
function setupBrowserCleanupHandlers(browser) {
    try {
        // Handler para SIGINT (Ctrl+C)
        process.on('SIGINT', async () => {
            logInfo('🛑 Interrupção detectada (SIGINT), finalizando browser...');
            await cleanupBrowser(browser);
            process.exit(0);
        });

        // Handler para SIGTERM (kill)
        process.on('SIGTERM', async () => {
            logInfo('🛑 Terminação detectada (SIGTERM), finalizando browser...');
            await cleanupBrowser(browser);
            process.exit(0);
        });

        // Handler para erros não capturados
        process.on('uncaughtException', async (error) => {
            logErro(`💥 Erro não capturado: ${error.message}`);
            await cleanupBrowser(browser);
            process.exit(1);
        });

        // Handler para promises rejeitadas
        process.on('unhandledRejection', async (reason, promise) => {
            logErro(`💥 Promise rejeitada não tratada: ${reason}`);
            await cleanupBrowser(browser);
            process.exit(1);
        });

        logInfo('✅ Handlers de cleanup configurados');

    } catch (handlerError) {
        logErro(`⚠️ Erro ao configurar handlers de cleanup: ${handlerError.message}`);
        // Não é crítico, continuar
    }
}

// =================================
// PROCESSAMENTO DE CATEGORIAS
// =================================

/**
 * Processa uma categoria específica seguindo o fluxo completo de coleta e validação
 * NOVO FLUXO: Coleta primeiro, valida depois
 * 
 * @param {Browser} browser - Instância do browser
 * @param {string} categoria - Nome da categoria a ser processada
 * @returns {Promise<Array>} Lista de produtos processados e analisados
 */
export async function processCategory(browser, categoria) {
    try {
        // 📊 INICIALIZAR MÉTRICAS DA SESSÃO
        const sessionMetrics = iniciarMetricas({
            categoria: categoria,
            maxProdutos: MAX_PRODUCTS_RAW,
            maxPaginas: MAX_PAGES_PER_CATEGORY,
            targetProdutos: TARGET_PRODUCTS_FINAL,
            filtrosAtivos: ['quantitativo', 'qualitativo', 'margem', 'duplicidade']
        });

        // Validação de entrada
        if (!browser) {
            throw new Error('Browser é obrigatório');
        }

        if (!categoria || typeof categoria !== 'string') {
            throw new Error('Categoria deve ser uma string válida');
        }

        logInfo(`🔍 Iniciando processamento da categoria: ${categoria}`);
        logInfo(`📋 FLUXO: Coleta → Detalhes → ML → Validações → Export`);

        // Usar a primeira aba disponível com tratamento de erro
        let page;
        try {
            const pages = await browser.pages();
            if (pages.length === 0) {
                page = await browser.newPage();
                logInfo('📄 Nova página criada');
            } else {
                page = pages[0];
                logInfo('📄 Usando página existente');
            }
        } catch (pageError) {
            logErro(`❌ Erro ao obter página: ${pageError.message}`);
            throw new Error(`Falha ao configurar página: ${pageError.message}`);
        }

        // Configurar página
        await configurarPagina(page);

        // Inicializar variáveis de controle
        const todosProdutosColetados = [];
        let pagina = 1;
        let tentativasConsecutivasSemSucesso = 0;
        const MAX_TENTATIVAS_SEM_SUCESSO = 3;

        logInfo(`🎯 Metas: ${MAX_PRODUCTS_RAW} produtos coletados | ${MAX_PAGES_PER_CATEGORY} páginas máx`);

        // =================================
        // FASE 1: BUSCA + FILTROS + PAGINAÇÃO + COLETA DE DETALHES
        // =================================
        
        logSucesso(`🚀 FASE 1: Coletando produtos básicos da categoria`);
        
        while (
            todosProdutosColetados.length < MAX_PRODUCTS_RAW &&
            pagina <= MAX_PAGES_PER_CATEGORY &&
            tentativasConsecutivasSemSucesso < MAX_TENTATIVAS_SEM_SUCESSO
        ) {
            try {
                logInfo(`📄 Processando página ${pagina}/${MAX_PAGES_PER_CATEGORY}...`);

                // PASSO 1: Busca inicial ou navegação para próxima página
                if (pagina === 1) {
                    await realizarBuscaInicial(page, categoria);
                } else {
                    const navegouComSucesso = await navegarProximaPagina(page, pagina);
                    if (!navegouComSucesso) {
                        logInfo(`⚠️ Não foi possível navegar para página ${pagina}, finalizando...`);
                        break;
                    }
                }

                // PASSO 2: Aguardar carregamento e fazer scroll
                const produtosCarregados = await aguardarECarregarProdutos(page, pagina);
                if (!produtosCarregados) {
                    tentativasConsecutivasSemSucesso++;
                    pagina++;
                    continue;
                }

                // PASSO 3: Extrair produtos básicos da página
                const produtosPagina = await extractProductsFromPage(page, categoria, pagina, todosProdutosColetados);
                
                if (produtosPagina.length === 0) {
                    logErro(`⚠️ Nenhum produto extraído da página ${pagina}`);
                    tentativasConsecutivasSemSucesso++;
                    pagina++;
                    continue;
                }

                // PASSO 4: Para cada produto, extrair detalhes em nova aba
                logInfo(`🔍 Extraindo detalhes de ${produtosPagina.length} produtos...`);
                
                for (let i = 0; i < produtosPagina.length; i++) {
                    const produto = produtosPagina[i];
                    
                    // Ignorar bundles na coleta de detalhes
                    if (produto.is_bundle) {
                        todosProdutosColetados.push(produto);
                        continue;
                    }

                    try {
                        logInfo(`🔍 Detalhes ${i + 1}/${produtosPagina.length}: ${produto.product_id}`);
                        
                        // Extrair detalhes completos
                        const detalhes = await extractProductDetails(browser, produto);
                        const produtoCompleto = { ...produto, ...detalhes };
                        
                        todosProdutosColetados.push(produtoCompleto);
                        
                        // Monitorar abas após cada extração para evitar acúmulo
                        if (i % 3 === 0) { // A cada 3 produtos
                            await monitorarELimparAbas(browser);
                        }
                        
                        // Parar se atingir limite
                        if (todosProdutosColetados.length >= MAX_PRODUCTS_RAW) {
                            logSucesso(`✅ Limite de ${MAX_PRODUCTS_RAW} produtos atingido!`);
                            break;
                        }

                    } catch (detailError) {
                        logErro(`❌ Erro ao extrair detalhes: ${detailError.message}`);
                        // Adicionar produto sem detalhes
                        todosProdutosColetados.push(produto);
                    }
                }

                // Reset contador de falhas
                tentativasConsecutivasSemSucesso = 0;
                
                logSucesso(`✅ Página ${pagina} concluída: ${todosProdutosColetados.length}/${MAX_PRODUCTS_RAW} produtos coletados`);
                
                pagina++;
                await randomDelay();

            } catch (pageError) {
                logErro(`💥 Erro na página ${pagina}: ${pageError.message}`);
                tentativasConsecutivasSemSucesso++;
                pagina++;
            }
        }

        logSucesso(`🎯 FASE 1 CONCLUÍDA: ${todosProdutosColetados.length} produtos coletados`);

        // =================================
        // FASE 1.5: VALIDAÇÃO DE DUPLICIDADE
        // =================================
        
        logSucesso(`🔍 FASE 1.5: Validando duplicidade de produtos`);
        
        const resultadoDuplicidade = await filtrarDuplicados(todosProdutosColetados);
        const produtosSemDuplicatas = resultadoDuplicidade.produtosUnicos;
        
        metricas.registrarErro('duplicidade', `${resultadoDuplicidade.stats.duplicados} produtos duplicados removidos`, {
            totalInput: resultadoDuplicidade.stats.totalInput,
            novos: resultadoDuplicidade.stats.novos,
            duplicados: resultadoDuplicidade.stats.duplicados
        });

        if (resultadoDuplicidade.stats.duplicados > 0) {
            logInfo(`🔄 Removidos ${resultadoDuplicidade.stats.duplicados} produtos duplicados`);
            logInfo(`✅ Restaram ${produtosSemDuplicatas.length} produtos únicos para processamento`);
        }

        // =================================
        // FASE 2: BUSCA NO MERCADO LIVRE
        // =================================
        
        logSucesso(`🛒 FASE 2: Buscando preços no Mercado Livre`);
        
        const produtosComML = [];
        const produtosOriginais = produtosSemDuplicatas.filter(p => !p.is_bundle);
        
        for (let i = 0; i < produtosOriginais.length; i++) {
            const produto = produtosOriginais[i];

            try {
                logInfo(`🔍 ML ${i + 1}/${produtosOriginais.length}: ${produto.nome || produto.product_id}`);

                // Buscar dados reais do Mercado Livre (passando o produto inteiro)
                // Protegemos com timeout local para não travar a categoria
                const ML_TIMEOUT_MS = 45000;
                const dadosML = await Promise.race([
                    buscarDadosMercadoLivre(browser, produto),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ML por produto')), ML_TIMEOUT_MS))
                ]);

                // Adicionar dados ML ao produto
                produto.dadosMercadoLivre = dadosML;
                produtosComML.push(produto);

            } catch (mlError) {
                logErro(`❌ Erro na busca ML: ${mlError.message}`);
                // Adicionar produto sem dados ML
                produtosComML.push(produto);
            }
        }

        // Adicionar bundles sem busca ML
        const bundles = todosProdutosColetados.filter(p => p.is_bundle);
        produtosComML.push(...bundles);

        logSucesso(`🎯 FASE 2 CONCLUÍDA: ${produtosComML.length} produtos com dados ML`);

        // =================================
        // FASE 3: VALIDAÇÕES QUANTITATIVAS
        // =================================
        
        logSucesso(`📊 FASE 3: Aplicando filtros quantitativos`);
        
        const produtosComQuantitativo = [];
        
        for (const produto of produtosComML) {
            try {
                const aprovadoQuant = applyQuantitativeFilter(produto);
                produto.aprovadoQuantitativo = aprovadoQuant;
                produto.filtros = produto.filtros || {};
                produto.filtros.quantitativo = { aprovado: aprovadoQuant };
                
                produtosComQuantitativo.push(produto);
                
                if (aprovadoQuant) {
                    logInfo(`✅ Quantitativo OK: ${produto.product_id}`);
                } else {
                    logInfo(`⛔ Quantitativo REJEITADO: ${produto.product_id}`);
                }
                
            } catch (quantError) {
                logErro(`❌ Erro no filtro quantitativo: ${quantError.message}`);
                produto.aprovadoQuantitativo = false;
                produtosComQuantitativo.push(produto);
            }
        }

        const aprovadosQuant = produtosComQuantitativo.filter(p => p.aprovadoQuantitativo).length;
        logSucesso(`🎯 FASE 3 CONCLUÍDA: ${aprovadosQuant}/${produtosComQuantitativo.length} aprovados quantitativamente`);

        // =================================
        // FASE 4: VALIDAÇÕES QUALITATIVAS + MARGEM
        // =================================
        
        logSucesso(`🎨 FASE 4: Aplicando filtros qualitativos e margem`);
        
        const produtosFinal = [];
        
        for (const produto of produtosComQuantitativo) {
            try {
                // 🧠 Melhoria 4: Aplicar filtro qualitativo automático
                const resultadoQualitativo = await applyQualitativeFilter(produto);
                produto.qualitativeScore = resultadoQualitativo;
                
                // Validação de margem com dados ML
                let validacaoMargem = null;
                if (produto.dadosMercadoLivre && !produto.is_bundle) {
                    validacaoMargem = await validarMargemComDadosML(produto);
                    produto.analiseMargem = validacaoMargem;
                }
                
                // Avaliação de risco
                const risco = assessRisk(produto);
                produto.avaliacaoRisco = risco;
                
                // Aprovação final (agora considera qualitativo + margem)
                const aprovadoQualitativo = resultadoQualitativo.score >= 50; // Score mínimo 50%
                const aprovadoMargem = validacaoMargem ? validacaoMargem.recomendacao?.viavel : true;
                const aprovadoFinal = produto.aprovadoQuantitativo && aprovadoQualitativo && aprovadoMargem;
                
                produto.aprovadoQualitativo = aprovadoQualitativo;
                produto.aprovadoFinal = aprovadoFinal;
                produto.filtros.qualitativo = { 
                    aprovado: aprovadoQualitativo,
                    score: resultadoQualitativo.score,
                    detalhes: resultadoQualitativo.analysis 
                };
                produto.filtros.margem = validacaoMargem;
                
                // 🎯 CALCULAR SCORE TOTAL DO PRODUTO
                const scoreTotal = calcularScoreTotal(produto);
                produto.scoreTotal = scoreTotal;
                
                // 📊 REGISTRAR PRODUTO NAS MÉTRICAS
                const trackingId = metricas.iniciarProduto(produto);
                metricas.finalizarProduto(trackingId, produto);
                
                // 🗂 MARCAR COMO PROCESSADO (ANTI-DUPLICIDADE)
                await marcarComoProcessado(produto, {
                    scoreTotal: scoreTotal.total,
                    categoria: scoreTotal.categoria,
                    sessaoId: sessionMetrics.sessionId
                });
                
                produtosFinal.push(produto);
                
                if (aprovadoFinal) {
                    logSucesso(`✅ APROVADO FINAL: ${produto.product_id}`);
                } else {
                    logInfo(`⛔ REPROVADO FINAL: ${produto.product_id}`);
                }
                
            } catch (qualError) {
                logErro(`❌ Erro no filtro qualitativo: ${qualError.message}`);
                produto.aprovadoQualitativo = false;
                produto.aprovadoFinal = false;
                produtosFinal.push(produto);
            }
        }

        const aprovadosFinal = produtosFinal.filter(p => p.aprovadoFinal).length;
        logSucesso(`🎯 FASE 4 CONCLUÍDA: ${aprovadosFinal}/${produtosFinal.length} produtos aprovados finalmente`);

        // =================================
        // FASE 5: ORDENAÇÃO E RELATÓRIOS FINAIS
        // =================================
        
        logSucesso(`📊 FASE 5: Gerando relatórios e ordenação final`);
        
        // Ordenar produtos por score total (melhores primeiro)
        const produtosOrdenados = ordenarPorScore(produtosFinal);
        
        // Gerar relatório de scores
        const relatorioScores = gerarRelatorioScores(produtosOrdenados);
        
        // Finalizar métricas e gerar relatório
        const relatorioMetricas = await metricas.finalizar();
        
        // =================================
        // FASE 6: PERSISTÊNCIA NO BANCO DE DADOS
        // =================================
        
        logSucesso(`💾 FASE 6: Salvando dados no banco Supabase`);
        
        let produtosSalvos = 0;
        let errosSalvamento = 0;
        
        // Salvar cada produto no banco
        for (const produto of produtosOrdenados) {
            try {
                // Verificar se já existe (dupla verificação DB)
                const verifDB = await verificarDuplicidadeDB(produto);
                if (verifDB && verifDB.isDuplicado) {
                        logInfo(`⚠️ Produto ${produto.nome} já existe no banco - pulando`);
                    continue;
                }
                
                // Preparar dados para o banco
                const dadosBanco = {
                    product_id_aliexpress: produto.product_id,
                    nome: produto.nome,
                    categoria: categoria,
                    preco_aliexpress: produto.preco,
                    descricao: produto.descricao || '',
                    url_imagem: produto.imagem || produto.imagemURL || (Array.isArray(produto.imagens) ? produto.imagens[0] : undefined),
                    url_aliexpress: produto.url || produto.href,
                    avaliacoes: produto.avaliacoes || 0,
                    rating: produto.rating || 0,
                    vendidos: produto.vendidos || 0,
                    shipping_info: produto.shipping || '',
                    dados_ml: produto.dadosMercadoLivre || null,
                    metricas_qualidade: {
                        riskLevel: produto.riskLevel,
                        qualitativeFilters: produto.qualitativeFilters,
                        quantitativeFilters: produto.quantitativeFilters,
                        marginValidation: produto.marginValidation
                    },
                    score_total: produto.scoreTotal || 0,
                    score_categoria: produto.scoreCategoria || 'bronze',
                    status: 'novo'
                };
                
                const resultado = await salvarProdutoCompleto(dadosBanco);
                
                if (resultado.sucesso) {
                    produtosSalvos++;
                    logInfo(`✅ Produto ${produto.nome} salvo no banco`);
                } else {
                    errosSalvamento++;
                    logErro(`❌ Erro ao salvar ${produto.nome}: ${resultado.erro}`);
                }
                
                // Pequeno delay entre salvamentos
                await delay(100);
                
            } catch (dbError) {
                errosSalvamento++;
                logErro(`💥 Erro no banco para ${produto.nome}: ${dbError.message}`);
            }
        }
        
        // Salvar métricas da sessão
        try {
            const metricasSessao = {
                categoria: categoria,
                total_produtos: todosProdutosColetados.length,
                produtos_salvos: produtosSalvos,
                produtos_duplicados: todosProdutosColetados.length - produtosFinal.length,
                tempo_execucao: Math.round((Date.now() - sessionMetrics.inicioSessao) / 1000),
                taxa_sucesso: produtosSalvos > 0 ? (produtosSalvos / produtosFinal.length) * 100 : 0,
                configuracao_usada: {
                    maxProdutos: MAX_PRODUCTS_RAW,
                    maxPaginas: MAX_PAGES_PER_CATEGORY,
                    filtrosAtivos: ['quantitativo', 'qualitativo', 'margem', 'duplicidade'],
                    versaoScraper: '3.0.0'
                }
            };
            
            await salvarMetricasSessao(metricasSessao);
            logSucesso(`📊 Métricas da sessão salvas no banco`);
            
        } catch (metricsError) {
            logErro(`❌ Erro ao salvar métricas: ${metricsError.message}`);
        }
        
        logSucesso(`💾 BANCO DE DADOS: ${produtosSalvos} produtos salvos, ${errosSalvamento} erros`);
        
        // =================================
        // RESULTADO FINAL
        // =================================
        
        logSucesso(`🎉 CATEGORIA ${categoria} FINALIZADA:`);
        logSucesso(`   📦 ${produtosFinal.length} produtos processados`);
        logSucesso(`   ✅ ${aprovadosFinal} produtos aprovados`);
        logSucesso(`   🛒 ${produtosComML.filter(p => p.dadosMercadoLivre).length} produtos com dados ML`);
        logSucesso(`   🎯 Produtos por categoria: 💎${relatorioScores.diamante} 🥇${relatorioScores.ouro} 🥈${relatorioScores.prata} 🥉${relatorioScores.bronze}`);
        logSucesso(`   📊 Score médio: ${relatorioScores.scoresMedios.geral}`);
        
        // Exibir relatório de métricas
        console.log(relatorioMetricas);

        return produtosOrdenados;

    } catch (error) {
        logErro(`💥 Erro crítico no processamento da categoria ${categoria}: ${error.message}`);
        return [];
    }
}

// =================================
// FUNÇÕES AUXILIARES DO NOVO FLUXO  
// =================================

/**
 * Configura a página com configurações stealth
 * @param {Page} page - Página do puppeteer
 */
async function configurarPagina(page) {
    try {
        await page.setViewport({ width: 1920, height: 1080 });

        // User Agent realístico
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Configurar página para ser stealth
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            window.chrome = {
                runtime: {},
            };

            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
        });

        // Headers realísticos
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        });

        logInfo('✅ Configuração de página aplicada com sucesso');

    } catch (configError) {
        logErro(`⚠️ Erro na configuração da página: ${configError.message}`);
        throw configError;
    }
}

/**
 * Realiza busca inicial no AliExpress
 * @param {Page} page - Página do puppeteer
 * @param {string} categoria - Categoria para buscar
 */
async function realizarBuscaInicial(page, categoria) {
    try {
        logInfo(`🌐 Acessando página inicial do AliExpress...`);
        
        await page.goto('https://pt.aliexpress.com', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await delay(2000);

        // Buscar categoria com tratamento de erro
        logInfo(`🔍 Buscando por: ${categoria}`);
        
        const searchSelectors = [
            'input[placeholder*="busca"]',
            'input[name="SearchText"]', 
            '#search-words',
            'input[type="search"]',
            '.search-bar input'
        ];

        let searchBox = null;
        for (const selector of searchSelectors) {
            try {
                searchBox = await page.$(selector);
                if (searchBox) {
                    logInfo(`✅ Campo de busca encontrado: ${selector}`);
                    break;
                }
            } catch (selectorError) {
                continue;
            }
        }

        if (searchBox) {
            await searchBox.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            await searchBox.type(categoria, { delay: 100 });
            await page.keyboard.press('Enter');
            await new Promise(resolve => setTimeout(resolve, 3000));
            logSucesso(`✅ Busca realizada com sucesso!`);

            // Aplicar filtro de mais vendidos com tratamento de erro
            try {
                await filtrarPorMaisVendidos(page);
            } catch (filterError) {
                logErro(`⚠️ Erro ao aplicar filtro de mais vendidos: ${filterError.message}`);
                // Continuar sem o filtro
            }

        } else {
            throw new Error('Campo de busca não encontrado em nenhum seletor');
        }

    } catch (searchError) {
        logErro(`❌ Erro na busca inicial: ${searchError.message}`);
        throw searchError;
    }
}

/**
 * Navega para próxima página de resultados
 * @param {Page} page - Página do puppeteer
 * @param {number} numeroPagina - Número da página de destino
 * @returns {boolean} True se navegou com sucesso
 */
async function navegarProximaPagina(page, numeroPagina) {
    try {
        logInfo(`➡️ Navegando para página ${numeroPagina}...`);
        
        const nextButtonSelectors = [
            'button[aria-label="next"]',
            '.next-btn',
            '.comet-pagination-next',
            '.comet-pagination-item:last-child',
            '.pagination-next'
        ];

        let nextButton = null;
        for (const selector of nextButtonSelectors) {
            try {
                nextButton = await page.$(selector);
                if (nextButton) {
                    const isEnabled = await page.evaluate(el => !el.disabled && !el.classList.contains('disabled'), nextButton);
                    if (isEnabled) {
                        logInfo(`✅ Botão de próxima página encontrado: ${selector}`);
                        break;
                    }
                }
                nextButton = null;
            } catch (buttonError) {
                continue;
            }
        }

        if (nextButton) {
            await nextButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
            return true;
        } else {
            logInfo(`⚠️ Botão de próxima página não encontrado`);
            return false;
        }

    } catch (navigationError) {
        logErro(`❌ Erro na navegação para página ${numeroPagina}: ${navigationError.message}`);
        return false;
    }
}

/**
 * Aguarda produtos carregarem e faz scroll
 * @param {Page} page - Página do puppeteer
 * @param {number} numeroPagina - Número da página atual
 * @returns {boolean} True se produtos foram carregados
 */
async function aguardarECarregarProdutos(page, numeroPagina) {
    try {
        // Aguardar produtos carregarem com múltiplas tentativas
        const productSelectors = [
            'a.search-card-item',
            '.item',
            '.product',
            '[data-pl="product-list"] a'
        ];

        let selectorEncontrado = false;
        for (const selector of productSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 15000 });
                selectorEncontrado = true;
                logInfo(`✅ Produtos encontrados com seletor: ${selector}`);
                break;
            } catch (selectorError) {
                continue;
            }
        }

        if (!selectorEncontrado) {
            logErro(`⚠️ Nenhum produto encontrado na página ${numeroPagina}`);
            return false;
        }

        // Fazer scroll para carregar todos os produtos
        try {
            await scrollUntilAllProductsLoaded(page);
            logInfo('✅ Scroll realizado com sucesso');
        } catch (scrollError) {
            logErro(`⚠️ Erro no scroll: ${scrollError.message}`);
            // Continuar mesmo com erro de scroll
        }

        return true;

    } catch (waitError) {
        logErro(`⚠️ Timeout aguardando produtos na página ${numeroPagina}: ${waitError.message}`);
        return false;
    }
}

/**
 * Busca dados do Mercado Livre para um produto
 * @param {Browser} browser - Instância do browser
 * @param {string} nomeProduto - Nome do produto para buscar
 * @returns {Object} Dados do Mercado Livre
 */
async function buscarDadosMercadoLivre(browser, produtoAli) {
    try {
        // Validar entrada
        if (!produtoAli || typeof produtoAli !== 'object') {
            throw new Error('Produto completo é obrigatório');
        }

        // Extrair imagens do AliExpress
        let imagensAli = [];
        if (Array.isArray(produtoAli.imagens)) {
            imagensAli = produtoAli.imagens;
        } else if (typeof produtoAli.imagens === 'string') {
            imagensAli = produtoAli.imagens.split(',').map(img => img.trim()).filter(Boolean);
        } else if (produtoAli.imagemURL) {
            imagensAli = [produtoAli.imagemURL];
        }

        // Buscar produtos compatíveis no ML
        const resultadoBusca = await buscarProdutosCompativeisML(browser, produtoAli, {
            maxResults: 15,
            maxPages: 2
        });

        if (!resultadoBusca.encontrouProdutos || !resultadoBusca.produtosCompatíveis.length) {
            throw new Error(resultadoBusca.erro || 'Nenhum produto compatível encontrado no ML');
        }

        // Carregar imghash e compareHashes
        const imghash = require('imghash');
        const { compareHashes } = require('imghash/lib/hamming');

        // Gerar hashes das imagens do AliExpress
        async function getHashesFromImages(imageUrls) {
            const hashes = [];
            for (const url of imageUrls) {
                try {
                    const hash = await imghash.hash(url, 16); // 16 = 64 bits
                    hashes.push(hash);
                } catch (err) {
                    console.warn(`❌ Erro ao gerar hash da imagem: ${url}`, err.message);
                }
            }
            return hashes;
        }

        // Função para comparar N x N hashes
        function getMenorDistanciaHash(hashesAli, hashesML) {
            let menorDistancia = Infinity;
            for (const hashAli of hashesAli) {
                for (const hashML of hashesML) {
                    const dist = compareHashes(hashAli, hashML); // retorna 0 a 64
                    if (dist < menorDistancia) menorDistancia = dist;
                }
            }
            const similaridade = 1 - menorDistancia / 64;
            return {
                menorDistancia,
                similaridade: Number(similaridade.toFixed(2))
            };
        }

        // Gerar hashes das imagens do AliExpress
        const hashesAli = await getHashesFromImages(imagensAli);

        // Para cada candidato ML, comparar N x N imagens
        const produtosML = [];
        for (const candidato of resultadoBusca.produtosCompatíveis) {
            let imagensML = [];
            if (Array.isArray(candidato.imagens)) {
                imagensML = candidato.imagens;
            } else if (typeof candidato.imagens === 'string') {
                imagensML = candidato.imagens.split(',').map(img => img.trim()).filter(Boolean);
            } else if (candidato.imagem) {
                imagensML = [candidato.imagem];
            }

            const hashesML = await getHashesFromImages(imagensML);
            let similaridade_visual = 0;
            if (hashesAli.length && hashesML.length) {
                const { similaridade } = getMenorDistanciaHash(hashesAli, hashesML);
                similaridade_visual = similaridade;
            }
            candidato.similaridade_visual = similaridade_visual;
            candidato.metodoValidacaoImagem = 'pHash_NvsN';
            candidato.aprovadoVisualmente = similaridade_visual >= 0.80;
            produtosML.push(candidato);
        }

        // Encontrar melhor match visual
        const melhorMatch = produtosML.reduce((best, curr) => {
            return (curr.similaridade_visual > (best?.similaridade_visual || 0)) ? curr : best;
        }, null);

        logInfo(`✅ ML: ${produtosML.length} produtos comparados visualmente`);
        return {
            sucesso: true,
            produtosEncontrados: produtosML.length,
            precos: produtosML.map(p => p.preco),
            produtos: produtosML,
            melhorMatch,
            fonte: 'Mercado Livre Real v2.0',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logErro(`❌ Erro na busca ML: ${error.message}`);
        // Retornar dados de fallback
        return {
            sucesso: false,
            erro: error.message,
            fonte: 'Fallback - Erro na busca',
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Valida margem usando dados já coletados do ML
 * @param {Object} produto - Produto com dados ML
 * @returns {Object} Resultado da validação
 */
async function validarMargemComDadosML(produto) {
    try {
        if (!produto.dadosMercadoLivre || !produto.dadosMercadoLivre.sucesso) {
            // Usar validação padrão se não tem dados ML
            return {
                sucesso: false,
                erro: 'Dados ML não disponíveis',
                recomendacao: { viavel: false }
            };
        }

        // Simular validação de margem com dados ML
        const precoAliExpress = parseFloat(produto.preco?.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        const precoML = produto.dadosMercadoLivre.precos?.media || 0;
        
        if (precoAliExpress > 0 && precoML > 0) {
            const margemPercentual = ((precoML - precoAliExpress) / precoML) * 100;
            const viavel = margemPercentual >= 30; // 30% margem mínima
            
            return {
                sucesso: true,
                recomendacao: { viavel },
                analiseMargens: {
                    realista: { margemPercentual }
                },
                dadosMercado: produto.dadosMercadoLivre
            };
        }

        return {
            sucesso: false,
            erro: 'Preços inválidos para cálculo',
            recomendacao: { viavel: false }
        };

    } catch (error) {
        logErro(`❌ Erro na validação de margem: ${error.message}`);
        return {
            sucesso: false,
            erro: error.message,
            recomendacao: { viavel: false }
        };
    }
}

// =================================
// EXTRAÇÃO DE PRODUTOS DE PÁGINA
// =================================

/**
 * Extrai produtos de uma página de resultados de busca
 * Utiliza múltiplos seletores para máxima compatibilidade
 * 
 * @param {Page} page - Página do puppeteer
 * @param {string} categoria - Categoria sendo processada
 * @param {number} pagina - Número da página atual
 * @param {Array} produtosExistentes - Produtos já coletados (para evitar duplicatas)
 * @returns {Promise<Array>} Lista de produtos extraídos
 */
export async function extractProductsFromPage(page, categoria, pagina, produtosExistentes = []) {
    try {
        logInfo(`🔍 Extraindo produtos da página ${pagina}...`);

        // Executar extração no contexto da página com tratamento robusto
        const produtos = await page.evaluate((categoria) => {
            try {
                // Múltiplos seletores para máxima compatibilidade
                const selectors = [
                    'a[class*="search-card-item"][href*="/item/"]',
                    'a[class*="search-card-item"][href*="BundleDeals"]'
                ];

                let elementos = [];
                for (const selector of selectors) {
                    try {
                        const found = document.querySelectorAll(selector);
                        elementos = [...elementos, ...Array.from(found)];
                    } catch (selectorError) {
                        console.log(`Erro no seletor ${selector}:`, selectorError.message);
                    }
                }

                console.log(`🔎 Total de elementos encontrados: ${elementos.length}`);

                const lista = [];
                let totalOriginal = 0;
                let totalBundle = 0;

                for (const el of elementos) {
                    try {
                        const href = el.href || '';
                        
                        if (!href) {
                            continue;
                        }

                        // Verificar se é produto original
                        const matchOriginal = href.match(/\/item\/(\d+)\.html/);
                        const matchBundle = href.match(/BundleDeals\d?\?productIds=([0-9:]+)/);
                        
                        if (!matchOriginal && !matchBundle) {
                            continue;
                        }

                        let productId = null;
                        let isBundle = false;

                        if (matchOriginal) {
                            productId = matchOriginal[1];
                            isBundle = false;
                            totalOriginal++;
                        } else if (matchBundle) {
                            productId = null;
                            isBundle = true;
                            totalBundle++;
                        }

                        // Extrair dados básicos do DOM
                        const produto = {
                            product_id: productId,
                            categoria: categoria,
                            aprovado: false,
                            is_bundle: isBundle,
                            href: href,
                            nome: '',
                            preco: '',
                            url: href,
                            vendas: ''
                        };

                        // Tentar extrair informações adicionais do DOM
                        try {
                            const titleSelectors = ['h1', 'h2', 'h3', '.item-title', '.product-title', '[title]'];
                            for (const selector of titleSelectors) {
                                const titleEl = el.querySelector(selector);
                                if (titleEl && titleEl.innerText) {
                                    produto.nome = titleEl.innerText.trim();
                                    break;
                                }
                            }

                            const priceSelectors = ['.search-card-item-price', '.price', '.item-price', '[data-spm-anchor-id*="price"]'];
                            for (const selector of priceSelectors) {
                                const priceEl = el.querySelector(selector);
                                if (priceEl && priceEl.innerText) {
                                    produto.preco = priceEl.innerText.trim();
                                    break;
                                }
                            }

                            // Extrair informações de vendas se disponível
                            if (el.innerText && el.innerText.includes('vendido')) {
                                produto.vendas = el.innerText;
                            }
                        } catch (domError) {
                            console.log(`Erro ao extrair dados do DOM:`, domError.message);
                        }

                        lista.push(produto);

                    } catch (elementError) {
                        console.log(`Erro ao processar elemento:`, elementError.message);
                        continue;
                    }
                }

                console.log(`[DEBUG] Produtos extraídos: ${lista.length} (Originais: ${totalOriginal}, Bundles: ${totalBundle})`);
                return lista;

            } catch (evaluateError) {
                console.log(`Erro na avaliação da página:`, evaluateError.message);
                return [];
            }
        }, categoria);

        if (!produtos || produtos.length === 0) {
            logErro(`⚠️ Nenhum produto extraído da página ${pagina}`);
            return [];
        }

        // Filtrar duplicatas baseado em product_id e href
        const idsExistentes = new Set(
            produtosExistentes
                .filter(p => p.product_id)
                .map(p => p.product_id)
        );
        
        const hrefsExistentes = new Set(
            produtosExistentes
                .filter(p => p.href)
                .map(p => p.href)
        );

        const produtosFiltrados = produtos.filter(produto => {
            if (produto.product_id && idsExistentes.has(produto.product_id)) {
                return false;
            }
            if (produto.href && hrefsExistentes.has(produto.href)) {
                return false;
            }
            return true;
        });

        logSucesso(`✔️ ${produtosFiltrados.length} produtos únicos extraídos da página ${pagina}`);
        return produtosFiltrados;

    } catch (error) {
        logErro(`💥 Erro ao extrair produtos da página ${pagina}: ${error.message}`);
        return [];
    }
}

// =================================
// EXTRAÇÃO DE DETALHES DE PRODUTO
// =================================

/**
 * Extrai detalhes específicos de um produto acessando sua página individual
 * Utiliza interceptação de API e fallback para DOM quando necessário
 * 
 * @param {Browser} browser - Instância do browser
 * @param {Object} produto - Dados básicos do produto
 * @returns {Promise<Object>} Detalhes extraídos do produto
 */
export async function extractProductDetails(browser, produto) {
    // Variáveis compartilhadas no escopo da função para permitir limpeza em finally
    let novaAba = null;
    let apiConfig = null;
    let detalhes = getDefaultProductDetails();
    let dadosAPI = null;
    let popupsAbertos = [];

    try {
        // Validação de entrada
        if (!browser || !produto) {
            throw new Error('Browser e produto são obrigatórios');
        }

        // Usar product_id se disponível, senão extrair da URL
        let productId = produto.product_id;
        let urlProduto = produto.url || produto.href;
        
        if (!productId && urlProduto) {
            // Suporta tanto /item/{id}.html quanto /i/{id}.html
            const productIdMatch = urlProduto.match(/\/(?:item|i)\/(\d+)\.html/);
            if (productIdMatch) {
                productId = productIdMatch[1];
            }
        }

        if (!productId) {
            logErro(`❌ Product ID não encontrado para ${urlProduto}`);
            return getDefaultProductDetails();
        }
        
        // Novo fluxo: abrir página principal, buscar pelo product_id e clicar para abrir detalhes
        logInfo(`🔍 Abrindo página principal do AliExpress para buscar produto ${productId}`);
        try {
            // Verificar se o browser ainda está conectado
            const isConnected = browser.isConnected();
            if (!isConnected) {
                logErro(`❌ Browser desconectado, não é possível criar nova aba`);
                return getDefaultProductDetails();
            }

            // Fechar abas about:blank extras que podem estar abertas
            const pages = await browser.pages();
            logInfo(`📊 Abas abertas antes de criar nova: ${pages.length}`);
            for (const page of pages) {
                const url = page.url();
                if (url === 'about:blank' && pages.length > 2) {
                    try {
                        await page.close();
                        logInfo(`🗑️ Aba about:blank desnecessária fechada`);
                    } catch (closeError) {
                        // Ignora erro ao fechar
                    }
                }
            }

            novaAba = await browser.newPage();
            // Capturar popups eventualmente abertos para garantir limpeza posterior
            try {
                novaAba.on('popup', (p) => {
                    popupsAbertos.push(p);
                });
            } catch (_) { /* ambiente pode não suportar */ }
            logInfo(`✅ Nova aba criada com sucesso para produto ${productId}`);
        } catch (pageError) {
            logErro(`❌ Erro ao criar nova aba: ${pageError.message}`);
            return getDefaultProductDetails();
        }

        try {
            // Configurar interceptação melhorada da API
            apiConfig = await configurarInterceptacaoAPI(novaAba, productId);

            // Abrir página principal do AliExpress
            await novaAba.goto('https://pt.aliexpress.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });
            await delay(1500);

            // Buscar pelo product_id no campo de busca
            const searchSelectors = [
                'input[placeholder*="busca"]',
                'input[name="SearchText"]',
                '#search-words',
                'input[type="search"]',
                '.search-bar input'
            ];
            let searchBox = null;
            for (const selector of searchSelectors) {
                try {
                    searchBox = await novaAba.$(selector);
                    if (searchBox) {
                        logInfo(`✅ Campo de busca encontrado: ${selector}`);
                        break;
                    }
                } catch (selectorError) {
                    continue;
                }
            }
            if (searchBox) {
                await searchBox.click();
                await delay(200);
                await searchBox.type(productId, { delay: 10 }); // digitação rápida
                await novaAba.keyboard.press('Enter');
                await delay(2000);
            } else {
                logErro(`❌ Campo de busca não encontrado para produto ${productId}`);
                return getDefaultProductDetails();
            }

            // Esperar resultados carregarem
            await delay(2000);

            // Tentar encontrar link do produto correto e navegar na MESMA aba (evita abrir nova guia)
            let produtoEncontrado = false;
            try {
                const candidateSelectors = [
                    `a[href*="/item/${productId}.html"]`,
                    `a[href*="/i/${productId}.html"]`,
                    `a[data-product-id="${productId}"]`,
                    // genérico: qualquer âncora cujo href contenha o id
                    `a[href*="${productId}"]`
                ];

                let navigated = false;
                for (const sel of candidateSelectors) {
                    try {
                        const handle = await novaAba.waitForSelector(sel, { timeout: 4000 });
                        if (handle) {
                            // Obter href absoluto do link e navegar diretamente
                            const href = await novaAba.evaluate((el) => {
                                try {
                                    const link = el.getAttribute('href') || '';
                                    if (!link) return '';
                                    const a = document.createElement('a');
                                    a.href = link;
                                    // Converter para URL absoluta baseada no origin atual
                                    const urlAbs = new URL(a.href, location.origin).href;
                                    return urlAbs;
                                } catch { return ''; }
                            }, handle);
                            if (href && typeof href === 'string') {
                                await novaAba.goto(href, { waitUntil: 'domcontentloaded', timeout: 25000 });
                                navigated = true;
                                break;
                            }
                        }
                    } catch (_eSel) { /* tenta próximo seletor */ }
                }

                // Última tentativa: procurar via evaluate e navegar com href absoluto
                if (!navigated) {
                    const hrefEval = await novaAba.evaluate((id) => {
                        const anchor = Array.from(document.querySelectorAll('a')).find(a => (a.getAttribute('href') || '').includes(id));
                        if (!anchor) return '';
                        try {
                            const urlAbs = new URL(anchor.getAttribute('href'), location.origin).href;
                            return urlAbs;
                        } catch { return anchor.getAttribute('href') || ''; }
                    }, productId);
                    if (hrefEval) {
                        await novaAba.goto(hrefEval, { waitUntil: 'domcontentloaded', timeout: 25000 });
                        navigated = true;
                    }
                    if (!navigated) throw new Error('Nenhum seletor compatível encontrado para o produto');
                }

                produtoEncontrado = true;
                logInfo(`✅ Produto ${productId} encontrado e clicado nos resultados de busca.`);
            } catch (clickError) {
                logErro(`❌ Produto ${productId} não encontrado nos resultados de busca: ${clickError.message}`);
                // Fallback: tentar abrir diretamente a PDP do produto com múltiplas variações
                const fallbackCandidates = [];
                if (urlProduto) fallbackCandidates.push(urlProduto);
                fallbackCandidates.push(
                    `https://pt.aliexpress.com/item/${productId}.html`,
                    `https://www.aliexpress.com/item/${productId}.html`,
                    `https://pt.aliexpress.com/i/${productId}.html`,
                    `https://www.aliexpress.com/i/${productId}.html`
                );

                let abriu = false;
                let ultimoErro = null;
                for (const url of fallbackCandidates) {
                    try {
                        await novaAba.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                        await delay(1500);
                        abriu = true;
                        logInfo(`🔗 PDP aberta via fallback: ${url}`);
                        break;
                    } catch (err) {
                        ultimoErro = err;
                        continue;
                    }
                }
                if (!abriu) {
                    logErro(`❌ Falha no fallback de abertura da PDP para ${productId}: ${ultimoErro?.message || 'sem detalhe'}`);
                    return getDefaultProductDetails();
                }
                produtoEncontrado = true;
            }

            // Esperar a navegação para a página de detalhes
            await delay(3500);
        } catch (navigationError) {
            logErro(`❌ Erro ao buscar produto ${productId} via busca: ${navigationError.message}`);
            return getDefaultProductDetails();
        }

    // ...continua fluxo normal de interceptação de API e extração de dados...
    // detalhes já foi declarado anteriormente, apenas atribuir
    dadosAPI = apiConfig.getDadosAPI();

    if (dadosAPI && apiConfig.isInterceptada()) {
            // Parse dos dados da API seguindo a lógica otimizada
            if (typeof dadosAPI === 'object' && dadosAPI !== null && Object.keys(dadosAPI).length > 0) {
                try {
                    detalhes = parseProductJson(dadosAPI, productId);
                    logSucesso(`📊 Dados extraídos via API para produto ${productId}`);
                } catch (parseError) {
                    logErro(`❌ Erro ao fazer parse do JSON do produto ${productId}: ${parseError.message}`);
                }
            } else {
                logErro(`❌ Dados da API inválidos ou vazios para produto ${productId}`);
            }
        } else {
            // Fallback melhorado: tentar extrair dados do DOM
            logInfo(`⚠️ API não interceptada (${apiConfig.getTentativas()} tentativas), usando fallback DOM para ${productId}`);
            try {
                await delay(2000);
                await novaAba.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight / 2);
                });
                await delay(1000);
                const detalhesDom = await novaAba.evaluate(() => {
                    const getText = (selector) => {
                        try {
                            return document.querySelector(selector)?.innerText || '';
                        } catch {
                            return '';
                        }
                    };
                    return {
                        vendedor: getText('.store-info .store-name, .shop-name'),
                        peso: getText('td:contains("Peso") + td'),
                        frete: getText('.dynamic-shipping'),
                        reviews: parseInt(getText('.reviews-num, .rating-num') || '0'),
                        rating: parseFloat(getText('.rating-value, .stars-rating') || '0'),
                        vendas: 0
                    };
                });
                detalhes = detalhesDom;
            } catch (domError) {
                logErro(`❌ Erro no fallback DOM: ${domError.message}`);
            }
        }

    return detalhes;

    } catch (error) {
        logErro(`💥 Erro ao extrair detalhes do produto: ${error.message}`);
        return getDefaultProductDetails();
    } finally {
        // Limpeza garantida de listeners da API
        try {
            if (apiConfig && typeof apiConfig.cleanup === 'function') {
                apiConfig.cleanup();
                logInfo('🧹 Listeners de API removidos (finally)');
            }
        } catch (_) { /* noop */ }

        // Fechar quaisquer popups capturados
        try {
            for (const p of popupsAbertos) {
                if (p && !p.isClosed()) {
                    await p.close();
                }
            }
        } catch (_) { /* noop */ }

        // Fechamento garantido da aba mesmo em retornos antecipados
        try {
            if (novaAba && !novaAba.isClosed()) {
                await novaAba.close();
                logInfo('✅ Aba de produto fechada (finally)');
            }
        } catch (e) {
            logErro(`⚠️ Erro ao fechar aba no finally: ${e.message}`);
        }
    }
}

/**
 * Retorna estrutura padrão de detalhes de produto
 * @returns {Object} Detalhes padrão
 */
function getDefaultProductDetails() {
    return {
        vendedor: '',
        peso: '',
        frete: '',
        reviews: 0,
        rating: 0,
        vendas: 0,
        preco: 0,
        imagens: '',
        rastreamento: false,
        custoFrete: 0,
        tipoFrete: '',
        tempoEntrega: 0,
        avaliacaoVendedor: 0,
        tempoAbertura: ''
    };
}

/**
 * Faz parse do JSON da API seguindo lógica otimizada
 * @param {Object} data - Dados da API
 * @param {string} productId - ID do produto
 * @returns {Object} Detalhes extraídos
 */
function parseProductJson(data, productId) {
    const detalhes = getDefaultProductDetails();

    // ⚠️ Validação de entrada
    if (!data || typeof data !== 'object') {
        logErro(`❌ JSON inválido ou vazio para produto ${productId}`);
        return detalhes;
    }

    try {
        // Título
        try {
            detalhes.titulo = data?.GLOBAL_DATA?.globalData?.subject || '';
        } catch (e) {
            logErro(`❌ Erro ao extrair título do produto ${productId}: ${e.message}`);
        }

        // Preço
        try {
            const priceStr = data?.PRICE?.targetSkuPriceInfo?.salePriceString || '';
            if (priceStr) {
                const priceMatch = priceStr.match(/R\$\s*([\d,.]+)/);
                if (priceMatch) {
                    detalhes.preco = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
                }
            }
        } catch (e) {
            logErro(`❌ Erro ao extrair preço do produto ${productId}: ${e.message}`);
        }

        // Vendas
        try {
            const otherText = data?.PC_RATING?.otherText || '';
            if (otherText && otherText.includes('vendidos')) {
                const salesMatch = otherText.match(/(\d+)/);
                if (salesMatch) {
                    detalhes.vendas = parseInt(salesMatch[1]);
                }
            }
        } catch (e) {
            logErro(`❌ Erro ao extrair vendas do produto ${productId}: ${e.message}`);
        }

        // Imagens
        try {
            const images = data?.HEADER_IMAGE_PC?.imagePathList || [];
            detalhes.imagens = Array.isArray(images) ? images.join(', ') : '';
        } catch (e) {
            logErro(`❌ Erro ao extrair imagens do produto ${productId}: ${e.message}`);
        }

        // Reviews e Rating
        try {
            const ratingInfo = data?.PC_RATING || {};
            detalhes.reviews = parseInt(ratingInfo.totalValidNum || 0);
            detalhes.rating = parseFloat(ratingInfo.rating || 0);
        } catch (e) {
            logErro(`❌ Erro ao extrair reviews/rating do produto ${productId}: ${e.message}`);
        }

        // Informações de frete
        try {
            const logisticsList = data?.SHIPPING?.originalLayoutResultList || [];
            if (Array.isArray(logisticsList) && logisticsList.length > 0) {
                const logistics = logisticsList[0]?.bizData || {};
                const additionLayout = logisticsList[0]?.additionLayout || [];
                detalhes.custoFrete = parseFloat(logistics.displayAmount || 0);
                detalhes.tipoFrete = logistics.deliveryOptionCode || '';
                detalhes.tempoEntrega = parseFloat(logistics.guaranteedDeliveryTime || 0);
                if (additionLayout.length > 0) {
                    detalhes.rastreamento = additionLayout[0]?.content === 'Rastreamento Disponível';
                }
            }
        } catch (e) {
            logErro(`❌ Erro ao extrair frete do produto ${productId}: ${e.message}`);
        }

        // Informações do vendedor
        try {
            const supplier = data?.SHOP_CARD_PC || {};
            detalhes.vendedor = supplier.storeName || '';
            detalhes.avaliacaoVendedor = supplier.sellerPositiveRate ? (parseFloat(supplier.sellerPositiveRate) / 20) : 0;
            detalhes.tempoAbertura = supplier.sellerInfo?.openTime || '';
        } catch (e) {
            logErro(`❌ Erro ao extrair vendedor do produto ${productId}: ${e.message}`);
        }

        logSucesso(`✅ Parse completo do produto ${productId}`);
        return detalhes;

    } catch (error) {
        logErro(`❌ Erro inesperado no parse do produto ${productId}: ${error.message}`);
        return getDefaultProductDetails();
    }
}


// =================================
// LIMPEZA E FINALIZAÇÃO
// =================================

/**
 * Função auxiliar para melhorar interceptação da API
 * Implementa múltiplas estratégias para garantir captura dos dados
 */
async function configurarInterceptacaoAPI(novaAba, productId) {
    let dadosAPI = null;
    let apiInterceptada = false;
    let tentativasAPI = 0;
    const alvo = String(productId || '').trim();

    const responseHandler = async (response) => {
        const url = response.url();
        const status = response.status();

        if (url.includes('mtop.aliexpress.pdp.pc.query') && status === 200) {
            try {
                tentativasAPI++;
                logInfo(`📡 Interceptando API para produto ${productId} (tentativa ${tentativasAPI})`);

                const rawText = await response.text();

                // 🔒 Validação: se o conteúdo não começar com JSON válido, abortar
                if (!rawText.trim().startsWith('{') && !rawText.includes('mtopjsonp')) {
                    logErro(`⚠️ Resposta não parece ser JSON válido para produto ${productId}`);
                    return;
                }

                // 🔧 Limpeza do wrapper JSONP
                let cleanText = rawText.replace(/^mtopjsonp\d*\(/, '').replace(/\)\s*$/, '');

                const firstBrace = cleanText.indexOf('{');
                if (firstBrace > 0) {
                    cleanText = cleanText.substring(firstBrace);
                }

                const lastBrace = cleanText.lastIndexOf('}');
                if (lastBrace > 0 && lastBrace < cleanText.length - 1) {
                    cleanText = cleanText.substring(0, lastBrace + 1);
                }

                // 🚨 Tentativa segura de parse
                let jsonData;
                try {
                    jsonData = JSON.parse(cleanText);
                } catch (e) {
                    logErro(`❌ Erro ao fazer JSON.parse para produto ${productId}: ${e.message}`);
                    return;
                }

                // 🔍 Verificação da estrutura esperada
                if (!jsonData?.data?.result || typeof jsonData.data.result !== 'object') {
                    logErro(`⚠️ JSON parseado mas sem estrutura esperada (data.result) para produto ${productId}`);
                    return;
                }

                // 🔐 Checagem de correspondência de productId
                const result = jsonData.data.result;
                // Tenta capturar productId por múltiplos caminhos
                let idFromResult = String(
                    result?.priceModule?.productId ||
                    result?.skuModule?.productId ||
                    result?.infoModule?.productId ||
                    result?.productId || ''
                ).trim();
                if (!idFromResult && result?.pageUrl) {
                    const m = String(result.pageUrl).match(/\/(?:item|i)\/(\d+)\.html/);
                    if (m) idFromResult = m[1];
                }

                // Regras de aceitação:
                // - Se ambos existirem e forem diferentes, ignore
                // - Se um dos dois estiver vazio, aceite (pode ser página carregada via fallback)
                if (alvo && idFromResult && idFromResult !== alvo) {
                    logErro(`⚠️ Interceptado productId diferente: esperado=${alvo} recebido=${idFromResult}. Ignorando esta resposta.`);
                    return;
                }

                dadosAPI = result;
                apiInterceptada = true;
                logSucesso(`✅ API interceptada com sucesso para produto ${productId}`);
            } catch (e) {
                logErro(`❌ Erro inesperado ao processar resposta da API para produto ${productId}: ${e.message}`);
            }
        }
    };

    const requestHandler = (request) => {
        const url = request.url();
        if (url.includes('mtop.aliexpress.pdp.pc.query')) {
            logInfo(`📤 Requisição API detectada para produto ${productId}: ${url.substring(0, 100)}...`);
        }
    };

    novaAba.on('response', responseHandler);
    novaAba.on('request', requestHandler);

    return {
        getDadosAPI: () => dadosAPI,
        isInterceptada: () => apiInterceptada,
        getTentativas: () => tentativasAPI,
        cleanup: () => {
            novaAba.off('response', responseHandler);
            novaAba.off('request', requestHandler);
        }
    };
}

/**
 * Monitora e limpa abas desnecessárias do browser
 * @param {Browser} browser - Instância do browser
 */
async function monitorarELimparAbas(browser) {
    try {
        const pages = await browser.pages();
        const abasParaFechar = [];
        
        for (const page of pages) {
            const url = page.url();
            
            // Identificar abas about:blank extras (manter apenas uma)
            if (url === 'about:blank') {
                abasParaFechar.push(page);
            }
            
            // Identificar abas duplicadas ou órfãs
            if (url.includes('aliexpress.com') && pages.length > 3) {
                // Se temos mais de 3 abas e alguma é do AliExpress, pode ser duplicata
                const urlCount = pages.filter(p => p.url().includes('aliexpress.com')).length;
                if (urlCount > 2) {
                    logInfo(`⚠️ Detectadas ${urlCount} abas do AliExpress, limpando extras`);
                }
            }
        }
        
        // Fechar abas about:blank extras (manter pelo menos uma)
        if (abasParaFechar.length > 1) {
            for (let i = 1; i < abasParaFechar.length; i++) {
                try {
                    await abasParaFechar[i].close();
                    logInfo(`🗑️ Aba about:blank extra removida`);
                } catch (error) {
                    // Ignora erro
                }
            }
        }
        
        const finalPages = await browser.pages();
        logInfo(`📊 Monitoramento de abas: ${pages.length} → ${finalPages.length}`);
        
    } catch (error) {
        logErro(`⚠️ Erro no monitoramento de abas: ${error.message}`);
    }
}

/**
 * Limpa recursos do browser de forma segura
 * @param {Browser} browser - Instância do browser
 */
async function cleanupBrowser(browser) {
    try {
        if (!browser) {
            return;
        }

        logInfo('🧹 Iniciando limpeza do browser...');

        // Fechar todas as páginas abertas primeiro
        try {
            const pages = await browser.pages();
            logInfo(`📊 Total de abas para fechar: ${pages.length}`);
            
            for (const page of pages) {
                try {
                    const url = page.url();
                    logInfo(`🗑️ Fechando aba: ${url}`);
                    
                    if (!page.isClosed()) {
                        await page.close();
                    }
                } catch (pageCloseError) {
                    // Ignora erros ao fechar páginas individuais
                    logErro(`⚠️ Erro ao fechar página individual: ${pageCloseError.message}`);
                }
            }
            logSucesso('✅ Todas as páginas foram processadas para fechamento');
        } catch (pagesError) {
            logErro(`⚠️ Erro ao listar/fechar páginas: ${pagesError.message}`);
        }
        
        // Aguardar um pouco para processos se organizarem
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Fechar o browser
        try {
            await browser.close();
            logSucesso('✅ Browser fechado com sucesso');
        } catch (browserCloseError) {
            logErro(`⚠️ Erro ao fechar browser: ${browserCloseError.message}`);
            
            // Força encerramento em último caso (Windows)
            try {
                const { spawn } = require('child_process');
                spawn('taskkill', ['/f', '/im', 'chrome.exe'], { stdio: 'ignore' });
                logInfo('🔄 Forçado encerramento do Chrome');
            } catch (killError) {
                logErro(`⚠️ Erro ao forçar encerramento: ${killError.message}`);
            }
        }

    } catch (error) {
        logErro(`💥 Erro crítico na limpeza do browser: ${error.message}`);
    }
}
