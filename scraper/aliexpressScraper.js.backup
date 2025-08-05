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
  logDebug,
  filtrarPorMaisVendidos
} from './utils.js';

import {
  applyQuantitativeFilter
} from '../filters/quantitative.js';

import {
  validarMargemOtimizada
} from '../marginValidation/margin-validator.js';

import {
  assessRisk
} from '../filters/riskAssessment.js';

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

        // Configurar Stealth Plugin com tratamento de erro
        try {
            puppeteer.use(StealthPlugin());
            logDebug('✅ Plugin Stealth configurado com sucesso');
        } catch (stealthError) {
            logErro(`❌ Erro ao configurar plugin stealth: ${stealthError.message}`);
            throw new Error('Falha crítica na configuração stealth');
        }

        // Log de configurações para debug
        logDebug('� Configurações carregadas:', {
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
            headless: false, // Modo visível para debug
            devtools: false,
            slowMo: 150, // Delay entre ações para parecer mais humano
            args: launchArgs,
            defaultViewport: null, // Usar viewport do sistema
            ignoreDefaultArgs: ['--disable-extensions'], // Permitir algumas extensões
            timeout: 60000, // Timeout de 60 segundos para inicialização
        };

        // Adicionar caminho do Chrome se especificado
        const chromePath = process.env.CHROME_PATH;
        if (chromePath) {
            browserConfig.executablePath = chromePath;
            logDebug(`🔧 Usando Chrome customizado: ${chromePath}`);
        }

        // Lançar browser com tratamento de erro
        let browser;
        try {
            browser = await puppeteer.launch(browserConfig);
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
                
                logDebug('✅ Página padrão configurada');
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

        logDebug('✅ Handlers de cleanup configurados');

    } catch (handlerError) {
        logErro(`⚠️ Erro ao configurar handlers de cleanup: ${handlerError.message}`);
        // Não é crítico, continuar
    }
}

// =================================
// PROCESSAMENTO DE CATEGORIAS
// =================================

/**
 * Processa uma categoria específica extraindo produtos com análise completa
 * Implementa fluxo margin-first com filtros quantitativos e qualitativos
 * 
 * @param {Browser} browser - Instância do browser
 * @param {string} categoria - Nome da categoria a ser processada
 * @returns {Promise<Array>} Lista de produtos processados e analisados
 */
export async function processCategory(browser, categoria) {
export async function processCategory(browser, categoria) {
    try {
        // Validação de entrada
        if (!browser) {
            throw new Error('Browser é obrigatório');
        }

        if (!categoria || typeof categoria !== 'string') {
            throw new Error('Categoria deve ser uma string válida');
        }

        logInfo(`🔍 Iniciando processamento robusto da categoria: ${categoria}`);

        // Usar a primeira aba disponível com tratamento de erro
        let page;
        try {
            const pages = await browser.pages();
            if (pages.length === 0) {
                // Se não há páginas, criar uma nova
                page = await browser.newPage();
                logDebug('📄 Nova página criada');
            } else {
                page = pages[0];
                logDebug('📄 Usando página existente');
            }
        } catch (pageError) {
            logErro(`❌ Erro ao obter página: ${pageError.message}`);
            throw new Error(`Falha ao configurar página: ${pageError.message}`);
        }

        // Configurar página com tratamento de erro
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

            logDebug('✅ Configuração de página aplicada com sucesso');

        } catch (configError) {
            logErro(`⚠️ Erro na configuração da página: ${configError.message}`);
            // Continuar mesmo com erro de configuração
        }

        // Inicializar variáveis de controle
        const produtos = [];
        const produtosComMargemAprovada = [];
        let pagina = 1;
        let tentativasConsecutivasSemSucesso = 0;
        const MAX_TENTATIVAS_SEM_SUCESSO = 3;
        let produtosProcessadosNestaPagina = 0;

        logInfo(`🎯 Meta: ${TARGET_PRODUCTS_FINAL} produtos finais aprovados`);
        logInfo(`📦 Buscar: ${MAX_PRODUCTS_RAW} produtos com margem aprovada`);
        logInfo(`📄 Máximo: ${MAX_PAGES_PER_CATEGORY} páginas por categoria`);

        // Loop principal de processamento com controle robusto
        while (
            produtosComMargemAprovada.length < MAX_PRODUCTS_RAW &&
            pagina <= MAX_PAGES_PER_CATEGORY &&
            tentativasConsecutivasSemSucesso < MAX_TENTATIVAS_SEM_SUCESSO
        ) {
            try {
                logInfo(`📄 Processando página ${pagina} de ${categoria}...`);
                produtosProcessadosNestaPagina = 0;

                // Primeira página: busca inicial
                if (pagina === 1) {
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
                                    logDebug(`✅ Campo de busca encontrado: ${selector}`);
                                    break;
                                }
                            } catch (selectorError) {
                                continue;
                            }
                        }

                        if (searchBox) {
                            await searchBox.click();
                            await page.waitForTimeout(500);
                            await searchBox.type(categoria, { delay: 100 });
                            await page.keyboard.press('Enter');
                            await page.waitForTimeout(3000);
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
                        tentativasConsecutivasSemSucesso++;
                        continue;
                    }

                } else {
                    // Páginas seguintes: navegar pelos botões
                    try {
                        logInfo(`➡️ Navegando para página ${pagina}...`);
                        
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
                                        logDebug(`✅ Botão de próxima página encontrado: ${selector}`);
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
                            await page.waitForTimeout(3000);
                        } else {
                            logInfo(`⚠️ Botão de próxima página não encontrado, finalizando...`);
                            break;
                        }

                    } catch (navigationError) {
                        logErro(`❌ Erro na navegação para página ${pagina}: ${navigationError.message}`);
                        tentativasConsecutivasSemSucesso++;
                        continue;
                    }
                }

                // Aguardar produtos carregarem com múltiplas tentativas
                try {
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
                            logDebug(`✅ Produtos encontrados com seletor: ${selector}`);
                            break;
                        } catch (selectorError) {
                            continue;
                        }
                    }

                    if (!selectorEncontrado) {
                        logErro(`⚠️ Nenhum produto encontrado na página ${pagina}`);
                        tentativasConsecutivasSemSucesso++;
                        continue;
                    }

                } catch (waitError) {
                    logErro(`⚠️ Timeout aguardando produtos na página ${pagina}: ${waitError.message}`);
                    tentativasConsecutivasSemSucesso++;
                    continue;
                }

                // Fazer scroll para carregar todos os produtos
                try {
                    await scrollUntilAllProductsLoaded(page);
                    logDebug('✅ Scroll realizado com sucesso');
                } catch (scrollError) {
                    logErro(`⚠️ Erro no scroll: ${scrollError.message}`);
                    // Continuar mesmo com erro de scroll
                }

                // Extrair produtos da página
                let produtosPagina = [];
                try {
                    produtosPagina = await extractProductsFromPage(page, categoria, pagina, produtos);
                    logInfo(`📦 Extraídos ${produtosPagina.length} produtos da página ${pagina}`);
                } catch (extractError) {
                    logErro(`❌ Erro na extração de produtos: ${extractError.message}`);
                    tentativasConsecutivasSemSucesso++;
                    continue;
                }

                if (produtosPagina.length === 0) {
                    logErro(`⚠️ Nenhum produto extraído da página ${pagina}`);
                    tentativasConsecutivasSemSucesso++;
                    continue;
                }

                // Processar produtos com análise de margem (MARGIN-FIRST FLOW)
                const produtosOriginais = produtosPagina.filter(p => !p.is_bundle);
                logInfo(`🔄 Processando ${produtosOriginais.length} produtos originais (ignorando bundles)`);

                for (let i = 0; i < produtosOriginais.length; i++) {
                    const produto = produtosOriginais[i];

                    try {
                        logInfo(`🔍 Analisando produto ${i + 1}/${produtosOriginais.length}: ${produto.product_id}`);

                        // PASSO 1: Validação de margem (filtro primário)
                        const validacaoMargem = await validarMargemOtimizada(produto);
                        
                        if (!validacaoMargem.sucesso || !validacaoMargem.recomendacao.viavel) {
                            logInfo(`⛔ Produto rejeitado por margem inadequada: ${produto.product_id}`);
                            continue;
                        }

                        logSucesso(`💰 Produto aprovado na análise de margem: ${produto.product_id}`);
                        
                        // Adicionar dados de margem ao produto
                        produto.analiseMargem = validacaoMargem;
                        produtosComMargemAprovada.push(produto);
                        produtosProcessadosNestaPagina++;

                        // Verificar se atingiu a meta de produtos com margem
                        if (produtosComMargemAprovada.length >= MAX_PRODUCTS_RAW) {
                            logSucesso(`✅ Meta de ${MAX_PRODUCTS_RAW} produtos com margem aprovada atingida!`);
                            break;
                        }

                    } catch (productError) {
                        logErro(`❌ Erro ao processar produto ${produto.product_id}: ${productError.message}`);
                        continue;
                    }
                }

                // Verificar se houve progresso nesta página
                if (produtosProcessadosNestaPagina > 0) {
                    tentativasConsecutivasSemSucesso = 0; // Reset contador
                    logSucesso(`🟢 Página ${pagina} concluída: +${produtosProcessadosNestaPagina} produtos aprovados`);
                } else {
                    tentativasConsecutivasSemSucesso++;
                    logErro(`🔴 Página ${pagina} sem produtos aprovados`);
                }

                // Log de progresso
                logInfo(`📊 Progresso: ${produtosComMargemAprovada.length}/${MAX_PRODUCTS_RAW} produtos com margem aprovada`);
                
                pagina++;
                await randomDelay();

            } catch (pageError) {
                logErro(`💥 Erro na página ${pagina} da categoria ${categoria}: ${pageError.message}`);
                tentativasConsecutivasSemSucesso++;
                break;
            }
        }

        // PASSO 2: Aplicar filtros quantitativos e qualitativos nos produtos com margem aprovada
        logInfo(`🔄 Aplicando filtros finais em ${produtosComMargemAprovada.length} produtos...`);
        
        for (const produto of produtosComMargemAprovada) {
            try {
                // Extrair detalhes adicionais se necessário
                const detalhes = await extractProductDetails(browser, produto);
                const produtoCompleto = { ...produto, ...detalhes };

                // Aplicar filtros
                const aprovadoQuant = applyQuantitativeFilter(produtoCompleto);
                const risco = assessRisk(produtoCompleto);

                const itemFinal = {
                    ...produtoCompleto,
                    aprovadoQuant,
                    aprovadoQuali: true, // Placeholder - margem já validada
                    risco,
                    aprovado: aprovadoQuant // Produto final aprovado
                };

                produtos.push(itemFinal);

                if (aprovadoQuant) {
                    logSucesso(`👍 Produto final aprovado: ${produto.product_id}`);
                } else {
                    logInfo(`⛔ Produto reprovado nos filtros finais: ${produto.product_id}`);
                }

                // Parar se atingir a meta final
                if (produtos.filter(p => p.aprovado).length >= TARGET_PRODUCTS_FINAL) {
                    logSucesso(`✅ Meta final de ${TARGET_PRODUCTS_FINAL} produtos aprovados atingida!`);
                    break;
                }

            } catch (filterError) {
                logErro(`❌ Erro ao aplicar filtros finais: ${filterError.message}`);
                continue;
            }
        }

        const produtosFinaisAprovados = produtos.filter(p => p.aprovado).length;
        logSucesso(`🎯 Categoria ${categoria} finalizada:`);
        logSucesso(`   📦 ${produtos.length} produtos processados`);
        logSucesso(`   ✅ ${produtosFinaisAprovados} produtos aprovados`);
        logSucesso(`   💰 ${produtosComMargemAprovada.length} produtos com margem viável`);

        return produtos;

    } catch (error) {
        logErro(`💥 Erro crítico no processamento da categoria ${categoria}: ${error.message}`);
        
        // Retornar lista vazia em caso de erro crítico
        return [];
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
        logDebug(`🔍 Extraindo produtos da página ${pagina}...`);

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

        } else {
          throw new Error('Caixa de busca não encontrada');
        }
      } else {
        // Páginas seguintes: tentar navegar pelos botões
        logInfo(`➡️ Navegando para página ${pagina}...`);
        const nextButton = await page.$('button[aria-label="next"], .next-btn, .comet-pagination-next, .comet-pagination-item:last-child');
        if (nextButton) {
          await nextButton.click();
          await page.waitForTimeout(3000);
        } else {
          logInfo(`⚠️ Botão de próxima página não encontrado, finalizando...`);
          break;
        }
      }

      // Aguardar produtos carregarem
      try {
        await page.waitForSelector('a.search-card-item, .item, .product, [data-pl="product-list"] a', { timeout: 30000 });
      } catch (selectorError) {
        logInfo(`⚠️ Produtos não encontrados na página ${pagina}, tentando aguardar mais...`);
        await delay(5000);
      }

      await scrollUntilAllProductsLoaded(page);
      //await tirarScreenshot(page, categoria, pagina);
      //await salvarHtmlPesquisa(page, categoria, pagina);

      const produtosPagina = await extractProductsFromPage(page, categoria, pagina, produtos);

      // Separar produtos originais e bundles
      const produtosOriginais = produtosPagina.filter(p => !p.is_bundle);
      const produtosBundle = produtosPagina.filter(p => p.is_bundle);

      logInfo(`Página ${pagina} | Total encontrados: ${produtosPagina.length} | Originais: ${produtosOriginais.length} | Bundles: ${produtosBundle.length}`);

      let produtosMargemAprovadaEstasPagina = 0;

      // NOVO FLUXO: Processar cada produto com validação de margem PRIMEIRO
      for (let i = 0; i < produtosPagina.length; i++) {
        const produto = produtosPagina[i];
        
        // Pular bundles
        if (produto.is_bundle) {
          logInfo(`⚠️ Produto bundle ignorado: ${produto.href}`);
          continue;
        }

        try {
          logInfo(`� [1/3] Validando margem do produto ${i + 1}/${produtosPagina.length}: ${produto.product_id}`);
          
          // PASSO 1: Extrair detalhes do produto
          const detalhes = await extractProductDetails(browser, produto);
          const produtoCompleto = { ...produto, ...detalhes, categoria };

          // PASSO 2: VALIDAÇÃO DE MARGEM PRIMEIRO (novo fluxo)
          const validacaoMargem = await validarMargemOtimizada(produtoCompleto);
          
          if (!validacaoMargem.sucesso || !validacaoMargem.recomendacao.viavel) {
            logInfo(`⛔ Produto rejeitado por margem insuficiente: ${produto.product_id}`);
            continue; // Pula para o próximo produto
          }

          logSucesso(`✅ [1/3] Margem aprovada: ${validacaoMargem.recomendacao.cenario} (${validacaoMargem.analiseMargens.realista.margemPercentual.toFixed(1)}%)`);

          // PASSO 3: FILTROS QUANTITATIVOS (apenas para produtos com margem aprovada)
          logInfo(`📊 [2/3] Aplicando filtros quantitativos...`);
          const aprovadoQuant = applyQuantitativeFilter(produtoCompleto);

          // PASSO 4: FILTROS QUALITATIVOS (comentados para evitar custos OpenAI)
          // logInfo(`🎯 [3/3] Aplicando filtros qualitativos...`);
          // const aprovadoQuali = applyQualitativeFilter(produtoCompleto);
          const aprovadoQuali = true; // Temporariamente aprovado

          // PASSO 5: ANÁLISE DE RISCO
          const risco = assessRisk(produtoCompleto);

          // PASSO 6: APROVAÇÃO FINAL
          const aprovadoFinal = aprovadoQuant.aprovado && aprovadoQuali;

          const itemFinal = {
            ...produtoCompleto,
            validacaoMargem,
            aprovadoQuant,
            aprovadoQuali,
            risco,
            aprovado: aprovadoFinal
          };

          // Adicionar à lista de produtos com margem aprovada
          produtosComMargemAprovada.push(itemFinal);
          produtosMargemAprovadaEstasPagina++;

          if (aprovadoFinal) {
            produtos.push(itemFinal);
            logSucesso(`👍 [FINAL] Produto TOTALMENTE aprovado: ${produto.product_id}`);
            
            // Parar se atingir o alvo de produtos finais aprovados
            if (produtos.length >= TARGET_PRODUCTS_FINAL) {
              logInfo(`🎯 Meta de ${TARGET_PRODUCTS_FINAL} produtos finais aprovados atingida!`);
              break;
            }
          } else {
            logInfo(`⚠️ [FINAL] Produto aprovado em margem mas reprovado nos filtros: ${produto.product_id}`);
          }

          logSucesso(`� Página ${pagina} | Produto processado ${i + 1}/${produtosPagina.length}: ${produto.product_id}`);
          
          // Parar se atingir o alvo de produtos com margem aprovada
          if (produtosComMargemAprovada.length >= MAX_PRODUCTS_RAW) {
            logInfo(`📦 Meta de ${MAX_PRODUCTS_RAW} produtos com margem aprovada atingida!`);
            break;
          }

        } catch (err) {
          logErro(`🔴 Página ${pagina} | Erro no produto ${i + 1}/${produtosPagina.length}: ${produto.product_id} - ${err.message}`);
        }
      }

      // Atualizar contadores de tentativas
      if (produtosMargemAprovadaEstasPagina === 0) {
        tentativasConsecutivasSemSucesso++;
        logInfo(`⚠️ Página ${pagina} sem produtos com margem aprovada. Tentativas consecutivas: ${tentativasConsecutivasSemSucesso}/${MAX_TENTATIVAS_SEM_SUCESSO}`);
      } else {
        tentativasConsecutivasSemSucesso = 0; // Reset contador
      }

      logInfo(`📦 Página ${pagina} finalizada. Margem aprovada: ${produtosComMargemAprovada.length}/${MAX_PRODUCTS_RAW} | Totalmente aprovados: ${produtos.length}/${TARGET_PRODUCTS_FINAL}`);
      pagina++;
      await randomDelay();

    } catch (err) {
      logErro(`Erro na página ${pagina} da categoria ${categoria}: ${err.message}`);
      tentativasConsecutivasSemSucesso++;
      if (tentativasConsecutivasSemSucesso >= MAX_TENTATIVAS_SEM_SUCESSO) {
        logErro(`❌ Máximo de tentativas consecutivas sem sucesso atingido. Finalizando categoria ${categoria}.`);
        break;
      }
    }
  }

  // Log final com estatísticas detalhadas
  logInfo(`📊 CATEGORIA ${categoria} FINALIZADA:`);
  logInfo(`   • Produtos com margem aprovada: ${produtosComMargemAprovada.length}/${MAX_PRODUCTS_RAW}`);
  logInfo(`   • Produtos totalmente aprovados: ${produtos.length}/${TARGET_PRODUCTS_FINAL}`);
  logInfo(`   • Taxa de conversão: ${((produtos.length / Math.max(1, produtosComMargemAprovada.length)) * 100).toFixed(1)}%`);
  logInfo(`   • Páginas processadas: ${pagina - 1}`);

  // Não fechar a página pois é a aba principal
  return {
    produtosTotalmenteAprovados: produtos,
    produtosComMargemAprovada: produtosComMargemAprovada,
    estatisticas: {
      totalComMargem: produtosComMargemAprovada.length,
      totalAprovados: produtos.length,
      paginasProcessadas: pagina - 1,
      taxaConversao: ((produtos.length / Math.max(1, produtosComMargemAprovada.length)) * 100).toFixed(1)
    }
  };
}

export async function extractProductsFromPage(page, categoria, pagina, produtosExistentes = []) {
  try {
    const produtos = await page.evaluate((categoria) => {
      // Aguardar elementos aparecerem
      const selectors = [
        'a[class*="search-card-item"][href*="/item/"]',
        'a[class*="search-card-item"][href*="BundleDeals"]'
      ];

      let elementos = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        elementos = [...elementos, ...Array.from(found)];
      }

      console.log(`🔎 Total de elementos <a> encontrados no DOM: ${elementos.length}`);

      const lista = [];
      let totalOriginal = 0;
      let totalBundle = 0;

      for (const el of elementos) {
        const href = el.href || '';
        
        // Verificar se é produto original
        const matchOriginal = href.match(/\/item\/(\d+)\.html/);
        // Verificar se é bundle
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
          productId = null; // Bundles não têm product_id único
          isBundle = true;
          totalBundle++;
        }

        const produto = {
          product_id: productId,
          categoria: categoria,
          aprovado: false,
          is_bundle: isBundle,
          href: href,
          // Campos adicionais do DOM para compatibilidade
          nome: el.querySelector('h1,h2,h3,.item-title,.product-title')?.innerText || '',
          preco: el.querySelector('.search-card-item-price,.price,.item-price')?.innerText || '',
          url: href,
          vendas: el.innerText.includes('vendido') ? el.innerText : ''
        };

        lista.push(produto);
      }

      console.log(`[DEBUG] Produtos extraídos do DOM nesta página: ${lista.length} (Originais: ${totalOriginal}, Bundles: ${totalBundle})`);
      return lista;
    }, categoria);

    // Filtrar duplicatas baseado no Python
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

    // logSucesso(`✔️ ${produtosFiltrados.length} produtos únicos extraídos da página ${pagina}.`);
    return produtosFiltrados;

  } catch (err) {
    logErro(`Erro ao extrair produtos da página ${pagina}: ${err.message}`);
    return [];
  }
}

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

export async function extractProductDetails(browser, produto) {
  try {
    // Usar product_id se disponível, senão extrair da URL
    let productId = produto.product_id;
    let urlProduto = produto.url || produto.href;
    
    if (!productId) {
      const productIdMatch = urlProduto.match(/\/item\/(\d+)\.html/);
      if (!productIdMatch) {
        logErro(`URL inválida para extração de product_id: ${urlProduto}`);
        return { vendedor: '', peso: '', frete: '' };
      }
      productId = productIdMatch[1];
    }
    
    // Garantir URL padrão
    if (!urlProduto.startsWith('https://pt.aliexpress.com/item/')) {
      urlProduto = `https://pt.aliexpress.com/item/${productId}.html`;
    }
    
    // logInfo(`🔍 Acessando PDP direta: ${urlProduto}`);
    
    const novaAba = await browser.newPage();
    
    let dadosAPI = null;
    
    // Interceptar resposta da API antes de navegar
    novaAba.on('response', async (response) => {
      if (response.url().includes('mtop.aliexpress.pdp.pc.query') && response.status() === 200) {
        try {
          const rawText = await response.text();
          // logInfo(`📡 Raw response recebida: ${rawText.substring(0, 100)}...`);
          
          // Múltiplas tentativas de limpeza do wrapper JSONP
          let cleanText = rawText;
          
          // Método 1: Remover wrapper mtopjsonp padrão
          cleanText = cleanText.replace(/^mtopjsonp\d*\(/, '').replace(/\)\s*$/, '');
          
          // Método 2: Se ainda tem caracteres estranhos no início, tentar encontrar o {
          const firstBrace = cleanText.indexOf('{');
          if (firstBrace > 0) {
            cleanText = cleanText.substring(firstBrace);
          }
          
          // Método 3: Se ainda tem caracteres no final, encontrar o último }
          const lastBrace = cleanText.lastIndexOf('}');
          if (lastBrace > 0 && lastBrace < cleanText.length - 1) {
            cleanText = cleanText.substring(0, lastBrace + 1);
          }
          
          // logInfo(`📡 JSON limpo: ${cleanText.substring(0, 100)}...`);
          
          const jsonData = JSON.parse(cleanText);
          dadosAPI = jsonData?.data?.result || {};
          logSucesso(`✅ API interceptada com sucesso para produto ${productId}`);
        } catch (e) {
          logErro(`Erro ao processar JSON da API: ${e.message}`);
          logErro(`Raw text: ${rawText.substring(0, 200)}...`);
        }
      }
    });
    
    // Navegar para a página do produto
    await novaAba.goto(urlProduto, { 
      waitUntil: 'domcontentloaded', 
      timeout: 40000 
    });
    
    // Aguardar um pouco para garantir que a API foi chamada
    await delay(3000);
    
    let detalhes = { vendedor: '', peso: '', frete: '', reviews: 0, rating: 0, vendas: 0 };
    
    if (dadosAPI) {
      // Parse dos dados da API seguindo a lógica do Python
      detalhes = parseProductJson(dadosAPI, productId);
    } else {
      // Fallback: tentar extrair dados do DOM
      logInfo(`⚠️ API não interceptada, tentando fallback DOM para ${productId}`);
      detalhes = await novaAba.evaluate(() => {
        const getText = (selector) => document.querySelector(selector)?.innerText || '';
        return {
          vendedor: getText('.store-info .store-name, .shop-name'),
          peso: getText('td:contains("Peso") + td'),
          frete: getText('.dynamic-shipping'),
          reviews: parseInt(getText('.reviews-num, .rating-num') || '0'),
          rating: parseFloat(getText('.rating-value, .stars-rating') || '0'),
          vendas: 0
        };
      });
    }
    
    try {
        await novaAba.close();
    } catch (closeError) {
        // Ignorar erros de fechamento da aba
    }
    return detalhes;

  } catch (err) {
    logErro(`Erro ao acessar detalhes do produto ${url}: ${err.message}`);
    return { vendedor: '', peso: '', frete: '', reviews: 0, rating: 0, vendas: 0 };
  }
}

// Função para fazer parse do JSON da API (adaptada do Python)
function parseProductJson(data, productId) {
  try {
    const detalhes = {
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

    // Título
    const title = data?.GLOBAL_DATA?.globalData?.subject || '';
    
    // Preço
    const priceStr = data?.PRICE?.targetSkuPriceInfo?.salePriceString || '';
    if (priceStr) {
      const priceMatch = priceStr.match(/R\$\s*([\d,.]+)/);
      if (priceMatch) {
        detalhes.preco = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
      }
    }
    
    // Vendas
    const otherText = data?.PC_RATING?.otherText || '';
    if (otherText && otherText.includes('vendidos')) {
      const salesMatch = otherText.match(/(\d+)/);
      if (salesMatch) {
        detalhes.vendas = parseInt(salesMatch[1]);
      }
    }
    
    // Imagens
    const images = data?.HEADER_IMAGE_PC?.imagePathList || [];
    detalhes.imagens = images.join(', ');
    
    // Reviews e Rating
    const ratingInfo = data?.PC_RATING || {};
    detalhes.reviews = parseInt(ratingInfo.totalValidNum || 0);
    detalhes.rating = parseFloat(ratingInfo.rating || 0);
    
    // Informações de frete
    const logisticsList = data?.SHIPPING?.originalLayoutResultList || [];
    if (logisticsList.length > 0) {
      const logistics = logisticsList[0]?.bizData || {};
      const additionLayout = logisticsList[0]?.additionLayout || [];
      
      detalhes.custoFrete = parseFloat(logistics.displayAmount || 0);
      detalhes.tipoFrete = logistics.deliveryOptionCode || '';
      detalhes.tempoEntrega = parseFloat(logistics.guaranteedDeliveryTime || 0);
      
      // Rastreamento
      if (additionLayout.length > 0) {
        detalhes.rastreamento = additionLayout[0]?.content === 'Rastreamento Disponível';
      }
    }
    
    // Informações do vendedor
    const supplier = data?.SHOP_CARD_PC || {};
    detalhes.vendedor = supplier.storeName || '';
    detalhes.avaliacaoVendedor = supplier.sellerPositiveRate ? (parseFloat(supplier.sellerPositiveRate) / 20) : 0;
    detalhes.tempoAbertura = supplier.sellerInfo?.openTime || '';
    
    logSucesso(`✅ Parse completo do produto ${productId}`);
    return detalhes;
    
  } catch (err) {
    logErro(`Erro ao fazer parse do JSON: ${err.message}`);
    return { vendedor: '', peso: '', frete: '', reviews: 0, rating: 0, vendas: 0 };
  }
}

// Função filterAndAppendProduct removida - fluxo integrado diretamente no processCategory
