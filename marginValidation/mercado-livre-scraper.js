/**
 * @fileoverview Busca real de produtos no Mercado Livre
 * @description Implementa busca real no Mercado Livre usando Puppeteer para validação de margem
 * com tratamento robusto de exceções e múltiplas abas para não interferir no scraping do AliExpress
 * 
 * @author Sistema de Scraping AliExpress - Busca ML
 * @version 1.0.0
 * @since 2024-01-01
 */

import { delay, randomDelay, logInfo, logSucesso, logErro, limparTexto, parsePrice } from '../scraper/utils.js';
import { produtosSaoCompativeis, gerarTermoBuscaML, compararProdutosComImagens } from '../utils/comparador-produtos.js';

/**
 * Configurações específicas para busca no Mercado Livre
 */
const ML_CONFIG = {
    baseUrl: 'https://lista.mercadolivre.com.br',
    searchPath: '/search?q=',
    maxResults: 20,
    maxPages: 2,
    timeout: 30000,
    retryAttempts: 3,
    delayBetweenPages: 2000,
    selectors: {
        searchResults: '.ui-search-results .ui-search-result',
        productTitle: '.ui-search-item__title',
        productPrice: '.ui-search-price__second-line .andes-money-amount__fraction',
        productCurrency: '.ui-search-price__second-line .andes-money-amount__currency-symbol',
        productLink: '.ui-search-item__group__element .ui-search-link',
        nextPage: '.andes-pagination__button--next',
        noResults: '.ui-search-rescue',
        priceRange: '.ui-search-price-filter',
        shipping: '.ui-search-item__shipping',
        rating: '.ui-search-reviews__rating',
        sales: '.ui-search-item__condition'
    }
};

/**
 * Busca inteligente de produtos compatíveis no Mercado Livre
 * Usa o comparador de produtos para encontrar apenas itens realmente similares
 * 
 * @param {Browser} browser - Instância do browser Puppeteer
 * @param {Object} produtoAliExpress - Produto do AliExpress para comparar
 * @param {Object} opcoes - Opções de busca
 * @returns {Promise<Object>} Dados dos produtos compatíveis encontrados
 */
export async function buscarProdutosCompativeisML(browser, produtoAliExpress, opcoes = {}) {
    try {
        // Validação de entrada
        if (!browser || !produtoAliExpress?.nome) {
            throw new Error('Browser e produto do AliExpress são obrigatórios');
        }

        // Gerar termo de busca otimizado com sistema de tradução
        const termoBusca = await gerarTermoBuscaML(produtoAliExpress.nome);
        if (!termoBusca) {
            throw new Error('Não foi possível gerar termo de busca válido');
        }

        logInfo(`🎯 Busca inteligente ML para: "${produtoAliExpress.nome}"`);
        logInfo(`🔍 Termo otimizado: "${termoBusca}"`);

        // Configuração específica para busca inteligente
        const configBusca = {
            maxResults: 30, // Buscar mais para ter opções de comparação
            maxPages: 2,
            incluirFrete: true,
            filtrarPorCondicao: true,
            ...opcoes
        };

        // Fazer busca padrão no ML
        const resultadoBusca = await buscarProdutosMercadoLivre(browser, termoBusca, configBusca);

        if (!resultadoBusca.sucesso || resultadoBusca.produtos.length === 0) {
            return {
                ...resultadoBusca,
                produtosCompativeis: [],
                comparacoes: [],
                melhorMatch: null
            };
        }

        // Analisar compatibilidade de cada produto encontrado
        const comparacoes = [];
        const produtosCompativeis = [];

        for (const produtoML of resultadoBusca.produtos) {
            const comparacao = produtosSaoCompativeis(produtoAliExpress, produtoML);
            
            comparacoes.push({
                produtoML,
                comparacao,
                compativel: comparacao.compativel
            });

            if (comparacao.compativel) {
                produtosCompativeis.push({
                    ...produtoML,
                    scoreCompatibilidade: comparacao.scoreFinal,
                    confianca: comparacao.confianca,
                    analise: comparacao
                });
            }
        }

        // Ordenar produtos compatíveis por score
        produtosCompativeis.sort((a, b) => b.scoreCompatibilidade - a.scoreCompatibilidade);

        // Encontrar melhor match
        const melhorMatch = produtosCompativeis.length > 0 ? produtosCompativeis[0] : null;

        // Estatísticas dos produtos compatíveis
        const estatisticasCompativeis = produtosCompativeis.length > 0 
            ? calcularEstatisticasCompativeis(produtosCompativeis)
            : null;

        const resultado = {
            ...resultadoBusca,
            termoBuscaOtimizado: termoBusca,
            produtoAliExpress: {
                nome: produtoAliExpress.nome,
                preco: produtoAliExpress.preco
            },
            totalAnalisados: resultadoBusca.produtos.length,
            produtosCompativeis,
            comparacoes,
            melhorMatch,
            estatisticasCompativeis,
            resumoCompatibilidade: {
                total: comparacoes.length,
                compativeis: produtosCompativeis.length,
                taxaCompatibilidade: Math.round((produtosCompativeis.length / comparacoes.length) * 100),
                confiancaAlta: produtosCompativeis.filter(p => p.confianca === 'alta').length,
                confiancaMedia: produtosCompativeis.filter(p => p.confianca === 'media').length
            }
        };

        logSucesso(`✅ Busca inteligente concluída: ${produtosCompativeis.length}/${comparacoes.length} produtos compatíveis`);
        
        if (melhorMatch) {
            logSucesso(`🎯 Melhor match: "${melhorMatch.titulo}" (score: ${melhorMatch.scoreCompatibilidade})`);
            logInfo(`💰 Preços: Ali R$ ${produtoAliExpress.preco} → ML R$ ${melhorMatch.preco}`);
        } else {
            logInfo(`⚠️ Nenhum produto compatível encontrado`);
        }

        return resultado;

    } catch (error) {
        logErro(`❌ Erro na busca inteligente ML: ${error.message}`);
        
        return {
            sucesso: false,
            erro: error.message,
            termoBuscaOtimizado: '',
            produtoAliExpress: produtoAliExpress || {},
            totalAnalisados: 0,
            produtosCompativeis: [],
            comparacoes: [],
            melhorMatch: null,
            resumoCompatibilidade: {
                total: 0,
                compativeis: 0,
                taxaCompatibilidade: 0
            }
        };
    }
}

/**
 * Busca inteligente com análise visual de imagens
 * Combina comparação textual e visual para encontrar produtos realmente similares
 * 
 * @param {Browser} browser - Instância do browser Puppeteer
 * @param {Object} produtoAliExpress - Produto do AliExpress para comparar (deve incluir imagens)
 * @param {Object} opcoes - Opções de busca
 * @returns {Promise<Object>} Dados dos produtos compatíveis com análise visual
 */
export async function buscarProdutosCompativeisComImagens(browser, produtoAliExpress, opcoes = {}) {
    try {
        // Validação específica para análise visual
        if (!browser || !produtoAliExpress?.nome) {
            throw new Error('Browser e produto do AliExpress são obrigatórios');
        }

        if (!produtoAliExpress.imagens || produtoAliExpress.imagens.length === 0) {
            logAviso(`⚠️ Produto sem imagens, usando busca inteligente padrão`);
            return await buscarProdutosCompativeisML(browser, produtoAliExpress, opcoes);
        }

        logInfo(`🔍🖼️ Busca inteligente COM ANÁLISE VISUAL para: "${produtoAliExpress.nome}"`);
        logInfo(`📸 Total de imagens Ali: ${produtoAliExpress.imagens.length}`);

        const config = {
            maxResults: 30,
            maxPages: 2,
            incluirAnaliseVisual: true,
            extrairImagensML: true, // Extrair imagens dos top 5
            ...opcoes
        };

        // 1. Fazer busca padrão no ML
        const termoBusca = await gerarTermoBuscaML(produtoAliExpress.nome);
        const resultadoBusca = await buscarProdutosMercadoLivre(browser, termoBusca, config);

        if (!resultadoBusca.sucesso || resultadoBusca.produtos.length === 0) {
            return {
                ...resultadoBusca,
                analiseVisual: null,
                produtosCompativeis: [],
                melhorMatch: null
            };
        }

        logSucesso(`✅ Busca padrão: ${resultadoBusca.produtos.length} produtos encontrados`);

        // 2. Extrair imagens dos top 5 produtos ML
        const produtosComImagens = await extrairImagensTop5(browser, resultadoBusca.produtos, config);

        // 3. Executar comparação avançada (textual + visual)
        const resultadoAvancado = await compararProdutosComImagens(
            produtoAliExpress,
            produtosComImagens,
            browser,
            {
                incluirAnaliseVisual: config.incluirAnaliseVisual,
                configImagens: {
                    limiarSimilaridade: opcoes.limiarSimilaridadeVisual || 75,
                    maxImagensPorProduto: opcoes.maxImagensPorProduto || 3
                }
            }
        );

        // 4. Processar resultados finais
        const resultadoFinal = processarResultadosComAnaliseVisual(
            resultadoBusca,
            resultadoAvancado,
            produtoAliExpress
        );

        logSucesso(`🎯 Busca com análise visual concluída`);
        if (resultadoFinal.melhorMatch) {
            logSucesso(`🏆 Melhor match: ${resultadoFinal.melhorMatch.titulo.substring(0, 50)}...`);
            logInfo(`📊 Score final: ${resultadoFinal.melhorMatch.scoreFinal}% (Texto: ${resultadoFinal.melhorMatch.scoreTextual}% | Visual: ${resultadoFinal.melhorMatch.scoreVisual}%)`);
        }

        return resultadoFinal;

    } catch (error) {
        logErro(`❌ Erro na busca com análise visual: ${error.message}`);
        
        // Fallback para busca padrão
        logInfo(`🔄 Executando fallback para busca padrão`);
        return await buscarProdutosCompativeisML(browser, produtoAliExpress, opcoes);
    }
}

/**
 * Extrai imagens dos top 5 produtos do ML
 * 
 * @param {Browser} browser - Instância do browser
 * @param {Array} produtos - Lista de produtos do ML
 * @param {Object} config - Configurações
 * @returns {Promise<Array>} Produtos com imagens extraídas
 */
async function extrairImagensTop5(browser, produtos, config) {
    try {
        const top5 = produtos.slice(0, 5);
        const produtosComImagens = [];

        logInfo(`🖼️ Extraindo imagens dos top 5 produtos ML`);

        for (let i = 0; i < top5.length; i++) {
            const produto = top5[i];
            
            try {
                logInfo(`📸 Extraindo imagens produto ${i + 1}/5: "${produto.titulo.substring(0, 30)}..."`);
                
                const imagens = await extrairImagensProdutoML(browser, produto, {
                    maxImagens: config.maxImagensPorProduto || 3,
                    timeout: 15000
                });

                produtosComImagens.push({
                    ...produto,
                    imagens,
                    totalImagens: imagens.length
                });

                logSucesso(`✅ ${imagens.length} imagens extraídas para produto ${i + 1}`);

            } catch (imagemError) {
                logErro(`❌ Erro ao extrair imagens produto ${i + 1}: ${imagemError.message}`);
                
                // Adicionar produto sem imagens extras (apenas a principal)
                produtosComImagens.push({
                    ...produto,
                    imagens: produto.imagemPrincipal ? [produto.imagemPrincipal] : [],
                    totalImagens: produto.imagemPrincipal ? 1 : 0
                });
            }

            // Delay entre extrações para não sobrecarregar o servidor
            if (i < top5.length - 1) {
                await delay(2000);
            }
        }

        const totalImagensExtraidas = produtosComImagens.reduce((acc, p) => acc + p.totalImagens, 0);
        logSucesso(`📸 Extração concluída: ${totalImagensExtraidas} imagens de ${produtosComImagens.length} produtos`);

        return produtosComImagens;

    } catch (error) {
        logErro(`❌ Erro na extração de imagens top 5: ${error.message}`);
        // Retornar produtos sem imagens extras
        return produtos.slice(0, 5).map(p => ({
            ...p,
            imagens: p.imagemPrincipal ? [p.imagemPrincipal] : [],
            totalImagens: p.imagemPrincipal ? 1 : 0
        }));
    }
}

/**
 * Processa resultados combinando busca tradicional com análise visual
 * 
 * @param {Object} resultadoBusca - Resultado da busca tradicional
 * @param {Object} resultadoAvancado - Resultado da análise avançada
 * @param {Object} produtoAliExpress - Produto original do AliExpress
 * @returns {Object} Resultado consolidado
 */
function processarResultadosComAnaliseVisual(resultadoBusca, resultadoAvancado, produtoAliExpress) {
    try {
        // Processar produtos com scores combinados
        const produtosCompativeis = [];
        
        if (resultadoAvancado.sucesso && resultadoAvancado.resultados) {
            for (const resultado of resultadoAvancado.resultados) {
                if (resultado.compativel) {
                    produtosCompativeis.push({
                        ...resultado.produtoML,
                        // Scores
                        scoreTextual: resultado.scoreTextual,
                        scoreVisual: resultado.scoreVisual,
                        scoreFinal: resultado.scoreFinal,
                        confianca: resultado.confianca,
                        // Análises detalhadas
                        analiseTextual: resultado.analiseTextual,
                        analiseVisual: resultado.analiseVisual,
                        metodosUsados: resultado.metodosUsados,
                        // Compatibilidade
                        compativel: true
                    });
                }
            }
        }

        // Ordenar por score final
        produtosCompativeis.sort((a, b) => b.scoreFinal - a.scoreFinal);

        // Melhor match
        const melhorMatch = produtosCompativeis.length > 0 ? produtosCompativeis[0] : null;

        // Estatísticas dos produtos compatíveis
        const estatisticasCompativeis = produtosCompativeis.length > 0 
            ? calcularEstatisticasCompativeisVisual(produtosCompativeis)
            : null;

        return {
            ...resultadoBusca,
            // Sobrescrever com dados avançados
            analiseVisual: resultadoAvancado.analiseVisual,
            produtosCompativeis,
            melhorMatch,
            estatisticasCompativeis,
            resumoCompatibilidade: {
                total: resultadoAvancado.analise?.totalProdutos || 0,
                compativeis: produtosCompativeis.length,
                taxaCompatibilidade: Math.round((produtosCompativeis.length / (resultadoAvancado.analise?.totalProdutos || 1)) * 100),
                confiancaAlta: produtosCompativeis.filter(p => p.confianca === 'alta').length,
                confiancaMedia: produtosCompativeis.filter(p => p.confianca === 'media').length,
                comAnaliseVisual: produtosCompativeis.filter(p => p.metodosUsados?.analiseVisual).length,
                scoreVisualMedio: produtosCompativeis.length > 0 
                    ? Math.round((produtosCompativeis.reduce((acc, p) => acc + (p.scoreVisual || 0), 0) / produtosCompativeis.length) * 100) / 100
                    : 0
            },
            configuracaoAvancada: {
                analiseVisualUsada: true,
                totalImagensAli: produtoAliExpress.imagens?.length || 0,
                algoritmoHash: 'pHash',
                pesoTexto: 70,
                pesoVisual: 30
            }
        };

    } catch (error) {
        logErro(`❌ Erro ao processar resultados com análise visual: ${error.message}`);
        
        // Retornar resultado básico em caso de erro
        return {
            ...resultadoBusca,
            analiseVisual: null,
            produtosCompativeis: [],
            melhorMatch: null,
            erro: error.message
        };
    }
}

/**
 * Calcula estatísticas específicas para produtos com análise visual
 * 
 * @param {Array} produtosCompativeis - Produtos compatíveis com scores visuais
 * @returns {Object} Estatísticas calculadas
 */
function calcularEstatisticasCompativeisVisual(produtosCompativeis) {
    try {
        const scores = {
            textuais: produtosCompativeis.map(p => p.scoreTextual).sort((a, b) => b - a),
            visuais: produtosCompativeis.map(p => p.scoreVisual || 0).filter(s => s > 0).sort((a, b) => b - a),
            finais: produtosCompativeis.map(p => p.scoreFinal).sort((a, b) => b - a)
        };

        const comAnaliseVisual = produtosCompativeis.filter(p => p.metodosUsados?.analiseVisual);

        return {
            scores: {
                textual: {
                    minimo: scores.textuais[scores.textuais.length - 1] || 0,
                    maximo: scores.textuais[0] || 0,
                    media: scores.textuais.reduce((acc, s) => acc + s, 0) / scores.textuais.length || 0
                },
                visual: scores.visuais.length > 0 ? {
                    minimo: scores.visuais[scores.visuais.length - 1],
                    maximo: scores.visuais[0],
                    media: scores.visuais.reduce((acc, s) => acc + s, 0) / scores.visuais.length
                } : null,
                final: {
                    minimo: scores.finais[scores.finais.length - 1] || 0,
                    maximo: scores.finais[0] || 0,
                    media: scores.finais.reduce((acc, s) => acc + s, 0) / scores.finais.length || 0
                }
            },
            analiseVisual: {
                produtosComAnaliseVisual: comAnaliseVisual.length,
                taxaAnaliseVisual: Math.round((comAnaliseVisual.length / produtosCompativeis.length) * 100),
                melhoriaMediaPorVisual: comAnaliseVisual.length > 0
                    ? Math.round((comAnaliseVisual.reduce((acc, p) => acc + (p.scoreFinal - p.scoreTextual), 0) / comAnaliseVisual.length) * 100) / 100
                    : 0
            },
            distribuicaoConfianca: {
                alta: produtosCompativeis.filter(p => p.confianca === 'alta').length,
                media: produtosCompativeis.filter(p => p.confianca === 'media').length,
                baixa: produtosCompativeis.filter(p => p.confianca === 'baixa').length
            }
        };

    } catch (error) {
        return null;
    }
}

/**
 * Calcula estatísticas específicas dos produtos compatíveis
 * @param {Array} produtosCompativeis - Lista de produtos compatíveis
 * @returns {Object} Estatísticas calculadas
 */
function calcularEstatisticasCompativeis(produtosCompativeis) {
    try {
        const precos = produtosCompativeis.map(p => p.preco).sort((a, b) => a - b);
        const scores = produtosCompativeis.map(p => p.scoreCompatibilidade).sort((a, b) => b - a);
        
        return {
            precos: {
                minimo: precos[0],
                maximo: precos[precos.length - 1],
                media: precos.reduce((acc, p) => acc + p, 0) / precos.length,
                mediana: precos[Math.floor(precos.length / 2)]
            },
            compatibilidade: {
                scoreMinimo: scores[scores.length - 1],
                scoreMaximo: scores[0],
                scoreMedia: scores.reduce((acc, s) => acc + s, 0) / scores.length
            },
            distribuicaoConfianca: {
                alta: produtosCompativeis.filter(p => p.confianca === 'alta').length,
                media: produtosCompativeis.filter(p => p.confianca === 'media').length,
                baixa: produtosCompativeis.filter(p => p.confianca === 'baixa').length
            }
        };
    } catch (error) {
        return null;
    }
}

/**
 * Busca produtos no Mercado Livre usando nova aba
 * Esta função abre uma nova aba para não interferir na navegação do AliExpress
 * 
 * @param {Browser} browser - Instância do browser Puppeteer
 * @param {string} termoBusca - Termo para buscar no Mercado Livre
 * @param {Object} opcoes - Opções de busca
 * @returns {Promise<Object>} Dados dos produtos encontrados
 * 
 * @example
 * const resultado = await buscarProdutosMercadoLivre(browser, "smartwatch fitness tracker");
 * console.log(`Encontrados ${resultado.produtosEncontrados} produtos`);
 * console.log(`Preço médio: R$ ${resultado.precos.media}`);
 */
export async function buscarProdutosMercadoLivre(browser, termoBusca, opcoes = {}) {
    // Configuração final com merge de opções
    const config = {
        maxResults: ML_CONFIG.maxResults,
        maxPages: ML_CONFIG.maxPages,
        incluirFrete: true,
        filtrarPorCondicao: true, // Apenas produtos novos
        ordenarPor: 'relevance', // relevance, price_asc, price_desc
        ...opcoes
    };

    let mlPage = null;
    
    try {
        // Validação de entrada
        if (!browser || !termoBusca || typeof termoBusca !== 'string') {
            throw new Error('Browser e termo de busca são obrigatórios');
        }

        const termoLimpo = limparTexto(termoBusca).trim();
        if (termoLimpo.length < 3) {
            throw new Error('Termo de busca deve ter pelo menos 3 caracteres');
        }

        logInfo(`🔍 Iniciando busca no Mercado Livre: "${termoLimpo}"`);

        // Criar nova aba para o Mercado Livre
        try {
            mlPage = await browser.newPage();
            logInfo('✅ Nova aba criada para Mercado Livre');
        } catch (pageError) {
            throw new Error(`Falha ao criar nova aba: ${pageError.message}`);
        }

        // Configurar nova aba
        await configurarPaginaMercadoLivre(mlPage);

        // Construir URL de busca
        const urlBusca = construirUrlBusca(termoLimpo, config);
        logInfo(`🔗 URL de busca: ${urlBusca}`);

        // Navegar para página de busca
        await navegarParaPaginaBusca(mlPage, urlBusca);

        // Extrair produtos de múltiplas páginas
        const produtos = await extrairProdutosTodasPaginas(mlPage, config);

        // Processar e analisar resultados
        const resultado = processarResultadosBusca(produtos, termoLimpo);

        logSucesso(`✅ Busca no ML concluída: ${resultado.produtosEncontrados} produtos encontrados`);
        logInfo(`💰 Faixa de preços: R$ ${resultado.precos.minimo} - R$ ${resultado.precos.maximo}`);
        
        return resultado;

    } catch (error) {
        logErro(`❌ Erro na busca do Mercado Livre: ${error.message}`);
        
        // Retornar estrutura de erro padronizada
        return {
            sucesso: false,
            erro: error.message,
            termoBuscado: termoBusca,
            produtosEncontrados: 0,
            produtos: [],
            precos: {
                minimo: 0, maximo: 0, media: 0, mediana: 0,
                quartil1: 0, quartil3: 0, quantidade: 0
            },
            metadados: {
                fonte: 'Mercado Livre',
                erro: true,
                tentativas: config.maxPages || 1,
                timestamp: new Date().toISOString()
            }
        };

    } finally {
        // Sempre fechar a aba do Mercado Livre
        if (mlPage && !mlPage.isClosed()) {
            try {
                await mlPage.close();
                logInfo('🗂️ Aba do Mercado Livre fechada');
            } catch (closeError) {
                logErro(`⚠️ Erro ao fechar aba ML: ${closeError.message}`);
            }
        }
    }
}

/**
 * Configura a página do Mercado Livre com headers e configurações específicas
 * @param {Page} page - Página do Puppeteer
 */
async function configurarPaginaMercadoLivre(page) {
    try {
        // Configurar viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Headers realísticos para o Mercado Livre
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        });

        // User Agent específico para Brasil
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Configurar timeouts
        page.setDefaultTimeout(ML_CONFIG.timeout);
        page.setDefaultNavigationTimeout(ML_CONFIG.timeout);

        logInfo('⚙️ Página ML configurada com sucesso');

    } catch (error) {
        throw new Error(`Falha na configuração da página ML: ${error.message}`);
    }
}

/**
 * Constrói URL de busca otimizada para o Mercado Livre
 * @param {string} termo - Termo de busca limpo
 * @param {Object} config - Configurações de busca
 * @returns {string} URL completa de busca
 */
function construirUrlBusca(termo, config) {
    try {
        // Encoding seguro do termo
        const termoEncoded = encodeURIComponent(termo);
        
        // URL base
        let url = `${ML_CONFIG.baseUrl}${ML_CONFIG.searchPath}${termoEncoded}`;
        
        // Adicionar filtros
        const filtros = [];
        
        // Apenas produtos novos
        if (config.filtrarPorCondicao) {
            filtros.push('condition=new');
        }
        
        // Ordenação
        if (config.ordenarPor && config.ordenarPor !== 'relevance') {
            filtros.push(`sort=${config.ordenarPor}`);
        }
        
        // Aplicar filtros na URL
        if (filtros.length > 0) {
            url += '&' + filtros.join('&');
        }
        
        return url;
        
    } catch (error) {
        throw new Error(`Erro ao construir URL de busca: ${error.message}`);
    }
}

/**
 * Navega para a página de busca do Mercado Livre com tratamento de erros
 * @param {Page} page - Página do Puppeteer
 * @param {string} url - URL de busca
 */
async function navegarParaPaginaBusca(page, url) {
    try {
        logInfo('🚀 Navegando para página de busca ML');
        
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: ML_CONFIG.timeout
        });
        
        // Aguardar elementos carregarem
        await delay(2000);
        
        // Verificar se a página carregou corretamente
        const title = await page.title();
        if (!title || title.includes('erro') || title.includes('error')) {
            throw new Error('Página de busca não carregou corretamente');
        }
        
        // Verificar se existem resultados
        const temResultados = await page.$(ML_CONFIG.selectors.searchResults);
        const temErroSemResultados = await page.$(ML_CONFIG.selectors.noResults);
        
        if (temErroSemResultados && !temResultados) {
            throw new Error('Nenhum resultado encontrado para a busca');
        }
        
        logSucesso('✅ Página de busca ML carregada com sucesso');
        
    } catch (error) {
        throw new Error(`Falha ao navegar para busca ML: ${error.message}`);
    }
}

/**
 * Extrai produtos de todas as páginas especificadas na configuração
 * @param {Page} page - Página do Puppeteer
 * @param {Object} config - Configurações de busca
 * @returns {Promise<Array>} Lista de produtos extraídos
 */
async function extrairProdutosTodasPaginas(page, config) {
    const todosProdutos = [];
    let paginaAtual = 1;
    
    try {
        while (paginaAtual <= config.maxPages && todosProdutos.length < config.maxResults) {
            logInfo(`📄 Processando página ${paginaAtual}/${config.maxPages} do ML`);
            
            // Extrair produtos da página atual
            const produtosPagina = await extrairProdutosPagina(page);
            
            if (produtosPagina.length === 0) {
                logInfo('📄 Página sem produtos, finalizando busca');
                break;
            }
            
            // Adicionar produtos únicos
            for (const produto of produtosPagina) {
                if (todosProdutos.length >= config.maxResults) break;
                
                // Evitar duplicatas por título
                const jaExiste = todosProdutos.some(p => 
                    p.titulo.toLowerCase() === produto.titulo.toLowerCase()
                );
                
                if (!jaExiste) {
                    todosProdutos.push(produto);
                }
            }
            
            logInfo(`📦 Página ${paginaAtual}: ${produtosPagina.length} produtos, total: ${todosProdutos.length}`);
            
            // Tentar ir para próxima página
            if (paginaAtual < config.maxPages && todosProdutos.length < config.maxResults) {
                const proximaPagina = await navegarParaProximaPagina(page);
                if (!proximaPagina) {
                    logInfo('🔚 Não há mais páginas disponíveis');
                    break;
                }
                paginaAtual++;
                await delay(config.delayBetweenPages || ML_CONFIG.delayBetweenPages);
            } else {
                break;
            }
        }
        
        logSucesso(`✅ Extração completa: ${todosProdutos.length} produtos únicos`);
        return todosProdutos;
        
    } catch (error) {
        logErro(`❌ Erro na extração de produtos: ${error.message}`);
        return todosProdutos; // Retornar produtos coletados até o erro
    }
}

/**
 * Extrai produtos da página atual do Mercado Livre
 * @param {Page} page - Página do Puppeteer
 * @returns {Promise<Array>} Lista de produtos da página
 */
async function extrairProdutosPagina(page) {
    try {
        const produtos = await page.evaluate((selectors) => {
            const items = document.querySelectorAll(selectors.searchResults);
            const produtosList = [];
            
            for (const item of items) {
                try {
                    // Extrair título
                    const titleEl = item.querySelector(selectors.productTitle);
                    const titulo = titleEl ? titleEl.textContent.trim() : '';
                    
                    if (!titulo) continue;
                    
                    // Extrair preço
                    const priceEl = item.querySelector(selectors.productPrice);
                    const currencyEl = item.querySelector(selectors.productCurrency);
                    
                    let precoTexto = '';
                    let precoNumerico = 0;
                    
                    if (priceEl) {
                        const currency = currencyEl ? currencyEl.textContent.trim() : 'R$';
                        const priceText = priceEl.textContent.trim();
                        precoTexto = `${currency} ${priceText}`;
                        
                        // Converter para número
                        const numeroLimpo = priceText.replace(/\./g, '').replace(',', '.');
                        precoNumerico = parseFloat(numeroLimpo) || 0;
                    }
                    
                    // Extrair link
                    const linkEl = item.querySelector(selectors.productLink);
                    const link = linkEl ? linkEl.href : '';
                    
                    // Extrair informações de frete
                    const shippingEl = item.querySelector(selectors.shipping);
                    const frete = shippingEl ? shippingEl.textContent.trim() : '';
                    
                    // Extrair avaliação
                    const ratingEl = item.querySelector(selectors.rating);
                    const avaliacao = ratingEl ? ratingEl.textContent.trim() : '';
                    
                    // Extrair condição/vendas
                    const conditionEl = item.querySelector(selectors.sales);
                    const condicao = conditionEl ? conditionEl.textContent.trim() : '';
                    
                    // Extrair imagem principal
                    const imagemEl = item.querySelector('img');
                    const imagemPrincipal = imagemEl ? imagemEl.src || imagemEl.dataset.src : '';
                    
                    produtosList.push({
                        titulo,
                        precoTexto,
                        precoNumerico,
                        link,
                        frete,
                        avaliacao,
                        condicao,
                        imagemPrincipal,
                        fonte: 'MercadoLivre'
                    });
                    
                } catch (itemError) {
                    console.log('Erro ao processar item ML:', itemError.message);
                    continue;
                }
            }
            
            return produtosList;
            
        }, ML_CONFIG.selectors);
        
        // Filtrar produtos com preço válido
        const produtosValidos = produtos.filter(p => p.precoNumerico > 0);
        
        logInfo(`🔍 Extraídos ${produtosValidos.length}/${produtos.length} produtos válidos da página`);
        
        return produtosValidos;
        
    } catch (error) {
        logErro(`❌ Erro ao extrair produtos da página: ${error.message}`);
        return [];
    }
}

/**
 * Navega para a próxima página de resultados
 * @param {Page} page - Página do Puppeteer
 * @returns {Promise<boolean>} true se navegou com sucesso, false caso contrário
 */
async function navegarParaProximaPagina(page) {
    try {
        // Procurar botão de próxima página
        const nextButton = await page.$(ML_CONFIG.selectors.nextPage);
        
        if (!nextButton) {
            logInfo('🔚 Botão "próxima página" não encontrado');
            return false;
        }
        
        // Verificar se o botão está ativo
        const isDisabled = await page.evaluate(btn => {
            return btn.hasAttribute('disabled') || btn.classList.contains('disabled');
        }, nextButton);
        
        if (isDisabled) {
            logInfo('🔚 Botão "próxima página" está desabilitado');
            return false;
        }
        
        // Clicar no botão
        await nextButton.click();
        
        // Aguardar navegação
        await page.waitForNavigation({
            waitUntil: 'domcontentloaded',
            timeout: ML_CONFIG.timeout
        });
        
        // Aguardar carregamento da página
        await delay(2000);
        
        logInfo('➡️ Navegou para próxima página com sucesso');
        return true;
        
    } catch (error) {
        logInfo(`⚠️ Erro ao navegar para próxima página: ${error.message}`);
        return false;
    }
}

/**
 * Processa e analisa os resultados da busca
 * @param {Array} produtos - Lista de produtos extraídos
 * @param {string} termoBuscado - Termo original da busca
 * @returns {Object} Análise estatística dos resultados
 */
function processarResultadosBusca(produtos, termoBuscado) {
    try {
        if (!produtos || produtos.length === 0) {
            return {
                sucesso: true,
                termoBuscado,
                produtosEncontrados: 0,
                produtos: [],
                precos: {
                    minimo: 0, maximo: 0, media: 0, mediana: 0,
                    quartil1: 0, quartil3: 0, quantidade: 0
                },
                metadados: {
                    fonte: 'Mercado Livre',
                    algoritmo: 'Busca Real v1.0',
                    timestamp: new Date().toISOString()
                }
            };
        }
        
        // Extrair apenas preços válidos
        const precos = produtos
            .map(p => p.precoNumerico)
            .filter(p => p > 0)
            .sort((a, b) => a - b);
        
        if (precos.length === 0) {
            throw new Error('Nenhum produto com preço válido encontrado');
        }
        
        // Calcular estatísticas
        const estatisticas = calcularEstatisticasPrecos(precos);
        
        // Preparar produtos para retorno (top 10 mais relevantes)
        const produtosRetorno = produtos
            .filter(p => p.precoNumerico > 0)
            .slice(0, 10)
            .map(p => ({
                titulo: p.titulo,
                preco: p.precoNumerico,
                precoFormatado: p.precoTexto,
                link: p.link,
                frete: p.frete,
                avaliacao: p.avaliacao,
                condicao: p.condicao
            }));
        
        return {
            sucesso: true,
            termoBuscado,
            produtosEncontrados: produtos.length,
            produtos: produtosRetorno,
            precos: {
                minimo: estatisticas.minimo,
                maximo: estatisticas.maximo,
                media: estatisticas.media,
                mediana: estatisticas.mediana,
                quartil1: estatisticas.quartil1,
                quartil3: estatisticas.quartil3,
                quantidade: precos.length
            },
            metadados: {
                fonte: 'Mercado Livre',
                algoritmo: 'Busca Real v1.0',
                paginasProcessadas: Math.ceil(produtos.length / 48), // ~48 produtos por página
                timestamp: new Date().toISOString()
            }
        };
        
    } catch (error) {
        throw new Error(`Erro ao processar resultados: ${error.message}`);
    }
}

/**
 * Calcula estatísticas detalhadas dos preços encontrados
 * @param {Array} precos - Array de preços ordenados
 * @returns {Object} Estatísticas calculadas
 */
function calcularEstatisticasPrecos(precos) {
    try {
        const quantidade = precos.length;
        
        if (quantidade === 0) {
            throw new Error('Array de preços vazio');
        }
        
        // Estatísticas básicas
        const minimo = precos[0];
        const maximo = precos[quantidade - 1];
        const soma = precos.reduce((acc, p) => acc + p, 0);
        const media = soma / quantidade;
        
        // Mediana
        let mediana;
        if (quantidade % 2 === 0) {
            mediana = (precos[quantidade / 2 - 1] + precos[quantidade / 2]) / 2;
        } else {
            mediana = precos[Math.floor(quantidade / 2)];
        }
        
        // Quartis
        const q1Index = Math.floor(quantidade * 0.25);
        const q3Index = Math.floor(quantidade * 0.75);
        const quartil1 = precos[q1Index];
        const quartil3 = precos[q3Index];
        
        return {
            minimo: Math.round(minimo * 100) / 100,
            maximo: Math.round(maximo * 100) / 100,
            media: Math.round(media * 100) / 100,
            mediana: Math.round(mediana * 100) / 100,
            quartil1: Math.round(quartil1 * 100) / 100,
            quartil3: Math.round(quartil3 * 100) / 100
        };
        
    } catch (error) {
        throw new Error(`Erro no cálculo de estatísticas: ${error.message}`);
    }
}

/**
 * Extrai URLs de imagens de um produto específico do Mercado Livre
 * Navega para a página do produto e extrai todas as imagens da galeria
 * 
 * @param {Browser} browser - Instância do browser Puppeteer
 * @param {Object} produtoML - Produto do ML com link
 * @param {Object} opcoes - Opções de extração
 * @returns {Promise<Array>} URLs das imagens extraídas
 */
export async function extrairImagensProdutoML(browser, produtoML, opcoes = {}) {
    let produtoPage = null;
    
    try {
        const config = {
            maxImagens: 5,
            timeout: 15000,
            tentativas: 2,
            ...opcoes
        };

        // Validação
        if (!browser || !produtoML?.link) {
            throw new Error('Browser e link do produto são obrigatórios');
        }

        // Se já tem imagem principal, começar com ela
        const imagens = [];
        if (produtoML.imagemPrincipal) {
            imagens.push(produtoML.imagemPrincipal);
        }

        logInfo(`🖼️ Extraindo imagens do produto ML: "${produtoML.titulo.substring(0, 50)}..."`);

        // Criar nova aba para o produto
        produtoPage = await browser.newPage();
        
        // Configurar página
        await produtoPage.setViewport({ width: 1920, height: 1080 });
        await produtoPage.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Navegar para página do produto com retry
        let paginaCarregada = false;
        let tentativa = 1;

        while (!paginaCarregada && tentativa <= config.tentativas) {
            try {
                logInfo(`🚀 Tentativa ${tentativa}/${config.tentativas}: Navegando para produto ML`);
                
                await produtoPage.goto(produtoML.link, {
                    waitUntil: 'domcontentloaded',
                    timeout: config.timeout
                });

                // Aguardar carregamento
                await delay(3000);
                
                // Verificar se página carregou corretamente
                const title = await produtoPage.title();
                if (title && !title.includes('erro') && !title.includes('error')) {
                    paginaCarregada = true;
                } else {
                    throw new Error('Página não carregou corretamente');
                }

            } catch (navError) {
                logErro(`❌ Tentativa ${tentativa} falhou: ${navError.message}`);
                tentativa++;
                
                if (tentativa <= config.tentativas) {
                    await delay(2000);
                }
            }
        }

        if (!paginaCarregada) {
            throw new Error('Falha ao carregar página do produto após tentativas');
        }

        // Extrair imagens da galeria
        const imagensExtraidas = await produtoPage.evaluate((maxImagens) => {
            const imagens = [];
            
            // Seletores para diferentes versões do ML
            const seletoresImagens = [
                '.ui-pdp-gallery .ui-pdp-gallery__figure img', // Galeria principal
                '.ui-pdp-image img', // Imagem principal
                '.ui-pdp-gallery img', // Galeria geral
                '.gallery-image img', // Galeria alternativa
                '.item-gallery img', // Galeria de item
                '[data-testid="gallery"] img', // Galeria com data-testid
                '.picture-viewer img' // Visualizador de imagens
            ];

            // Tentar cada seletor
            for (const seletor of seletoresImagens) {
                const elementos = document.querySelectorAll(seletor);
                
                for (const img of elementos) {
                    if (imagens.length >= maxImagens) break;
                    
                    const src = img.src || img.dataset.src || img.dataset.original;
                    if (src && src.startsWith('http') && !imagens.includes(src)) {
                        // Filtrar imagens pequenas ou de placeholder
                        if (!src.includes('placeholder') && 
                            !src.includes('loading') && 
                            !src.includes('spinner') &&
                            !src.includes('40x40') &&
                            !src.includes('60x60')) {
                            imagens.push(src);
                        }
                    }
                }
                
                if (imagens.length > 0) break; // Parar no primeiro seletor que encontrou imagens
            }

            return imagens;
        }, config.maxImagens);

        // Adicionar imagens extraídas, evitando duplicatas
        for (const urlImagem of imagensExtraidas) {
            if (!imagens.includes(urlImagem) && imagens.length < config.maxImagens) {
                imagens.push(urlImagem);
            }
        }

        logSucesso(`✅ Extraídas ${imagens.length} imagens do produto ML`);
        
        return imagens;

    } catch (error) {
        logErro(`❌ Erro ao extrair imagens do produto ML: ${error.message}`);
        
        // Retornar pelo menos a imagem principal se disponível
        const imagensFallback = [];
        if (produtoML.imagemPrincipal) {
            imagensFallback.push(produtoML.imagemPrincipal);
        }
        
        return imagensFallback;

    } finally {
        // Fechar aba do produto
        if (produtoPage && !produtoPage.isClosed()) {
            try {
                await produtoPage.close();
                logInfo('🗂️ Aba do produto ML fechada');
            } catch (closeError) {
                logErro(`⚠️ Erro ao fechar aba do produto: ${closeError.message}`);
            }
        }
    }
}

export {
    ML_CONFIG,
    calcularEstatisticasCompativeis,
    configurarPaginaMercadoLivre,
    construirUrlBusca,
    navegarParaPaginaBusca,
    extrairProdutosTodasPaginas,
    extrairProdutosPagina,
    navegarParaProximaPagina,
    processarResultadosBusca,
    calcularEstatisticasPrecos,
    extrairImagensProdutoML,
    extrairImagensTop5,
    processarResultadosComAnaliseVisual,
    calcularEstatisticasCompativeisVisual
};
