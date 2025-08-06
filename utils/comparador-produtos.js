/**
 * @fileoverview Comparador Inteligente de Produtos AliExpress ↔ Mercado Livre
 * @description Implementa algoritmo de similaridade textual e validação de faixa de preço
 * para determinar se um produto do AliExpress corresponde ao encontrado no Mercado Livre
 * 
 * @author Sistema de Scraping - Validação de Margem
 * @version 1.0.0
 * @since 2024-01-01
 */

import { logInfo, logSucesso, logErro, logAviso, limparTexto } from '../scraper/utils.js';
import { compararImagensProdutos } from './comparador-imagens.js';
import { processarNomeProduto, obterTermoBusca } from './tradutor-produtos.js';

/**
 * Configurações do comparador de produtos
 */
const COMPARADOR_CONFIG = {
    // Limiares de similaridade
    similaridadeMinima: 0.6,        // 60% de palavras em comum
    multiplicadorPrecoMin: 1.5,     // ML deve ser pelo menos 1.5x mais caro
    multiplicadorPrecoMax: 5.0,     // ML não pode ser mais de 5x mais caro
    
    // Palavras a serem removidas na comparação (blacklist)
    palavrasGenericas: [
        'original', 'frete', 'gratis', 'novo', 'barato', 'promocao', 'oferta',
        'melhor', 'otimo', 'perfeito', 'incrivel', 'top', 'premium', 'luxo',
        'importado', 'china', 'brasil', 'nacional', 'internacional',
        'vendedor', 'loja', 'store', 'shop', 'market', 'casa', 'lar',
        'entrega', 'rapida', 'expressa', 'imediata', 'garantia',
        'qualidade', 'alta', 'super', 'mega', 'ultra', 'max'
    ],
    
    // Palavras que aumentam o peso da comparação
    palavrasChave: [
        'magnetic', 'magnetico', 'bluetooth', 'wireless', 'led', 'lcd',
        'usb', 'type-c', 'micro', 'mini', 'maxi', 'grande', 'pequeno',
        'preto', 'branco', 'azul', 'vermelho', 'rosa', 'verde'
    ]
};

/**
 * Verifica se dois produtos parecem ser o mesmo com base em:
 * - Similaridade textual do nome
 * - Faixa de preço esperada
 * - Compatibilidade de características
 * 
 * @param {Object} produtoAli - Produto do AliExpress
 * @param {Object} produtoML - Produto do Mercado Livre
 * @returns {Object} Resultado da comparação com score detalhado
 */
export function produtosSaoCompativeis(produtoAli, produtoML) {
    try {
        // Validação de entrada
        if (!produtoAli?.nome || !produtoML?.titulo) {
            return criarResultadoComparacao(false, 0, 'Nomes não disponíveis');
        }

        if (!produtoAli?.preco || !produtoML?.precoNumerico) {
            return criarResultadoComparacao(false, 0, 'Preços não disponíveis');
        }

        // Gerar slugs comparativos
        const slugAli = gerarSlugComparativo(produtoAli.nome);
        const slugML = gerarSlugComparativo(produtoML.titulo);

        if (!slugAli || !slugML) {
            return criarResultadoComparacao(false, 0, 'Erro ao gerar slugs');
        }

        // Análise de similaridade textual
        const analiseTextual = analisarSimilaridadeTextual(slugAli, slugML);
        
        // Análise de compatibilidade de preços
        const analisePrecos = analisarCompatibilidadePrecos(
            produtoAli.preco, 
            produtoML.precoNumerico
        );

        // Cálculo do score final
        const scoreFinal = calcularScoreFinal(analiseTextual, analisePrecos);
        
        // Decisão de compatibilidade
        const compativel = (
            analiseTextual.cobertura >= COMPARADOR_CONFIG.similaridadeMinima &&
            analisePrecos.compativel &&
            scoreFinal >= 70
        );

        return {
            compativel,
            scoreFinal,
            confianca: scoreFinal >= 85 ? 'alta' : scoreFinal >= 70 ? 'media' : 'baixa',
            analiseTextual,
            analisePrecos,
            produtos: {
                aliexpress: {
                    nome: produtoAli.nome,
                    slug: slugAli,
                    preco: produtoAli.preco
                },
                mercadolivre: {
                    nome: produtoML.titulo,
                    slug: slugML,
                    preco: produtoML.precoNumerico
                }
            },
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        return criarResultadoComparacao(false, 0, `Erro na comparação: ${error.message}`);
    }
}

/**
 * Gera um slug simplificado para comparação textual
 * Remove palavras genéricas, símbolos, marcas conhecidas, etc.
 * 
 * @param {string} nome - Nome do produto
 * @returns {string} Slug simplificado
 */
function gerarSlugComparativo(nome) {
    try {
        if (!nome || typeof nome !== 'string') {
            return '';
        }

        // Limpar texto básico
        let textoLimpo = limparTexto(nome)
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')     // Remove símbolos
            .replace(/\s+/g, ' ')        // Normaliza espaços
            .trim();

        // Dividir em palavras
        const palavras = textoLimpo.split(' ');
        
        // Filtrar palavras relevantes
        const palavrasRelevantes = palavras.filter(palavra => {
            return (
                palavra.length > 2 &&
                !COMPARADOR_CONFIG.palavrasGenericas.includes(palavra) &&
                !isNumeroIsolado(palavra)
            );
        });

        return palavrasRelevantes.join(' ');

    } catch (error) {
        console.error('Erro ao gerar slug comparativo:', error.message);
        return '';
    }
}

/**
 * Analisa similaridade textual entre dois produtos
 * 
 * @param {string} slugAli - Slug do AliExpress
 * @param {string} slugML - Slug do Mercado Livre
 * @returns {Object} Análise detalhada da similaridade
 */
function analisarSimilaridadeTextual(slugAli, slugML) {
    try {
        const termosAli = slugAli.split(' ').filter(t => t.length > 0);
        const termosML = slugML.split(' ').filter(t => t.length > 0);

        if (termosAli.length === 0 || termosML.length === 0) {
            return {
                cobertura: 0,
                intersecao: [],
                termosAli,
                termosML,
                score: 0
            };
        }

        // Encontrar interseção de palavras
        const intersecao = termosAli.filter(termo => termosML.includes(termo));
        
        // Calcular cobertura (% de palavras do AliExpress que existem no ML)
        const cobertura = intersecao.length / termosAli.length;
        
        // Bonus para palavras-chave importantes
        const bonusPalavrasChave = intersecao.filter(termo => 
            COMPARADOR_CONFIG.palavrasChave.includes(termo)
        ).length * 0.1;

        const score = Math.min(100, (cobertura + bonusPalavrasChave) * 100);

        return {
            cobertura: Math.round(cobertura * 100) / 100,
            intersecao,
            termosAli,
            termosML,
            score: Math.round(score),
            bonusPalavrasChave: Math.round(bonusPalavrasChave * 100)
        };

    } catch (error) {
        return {
            cobertura: 0,
            intersecao: [],
            termosAli: [],
            termosML: [],
            score: 0,
            erro: error.message
        };
    }
}

/**
 * Analisa compatibilidade de preços entre produtos
 * 
 * @param {number} precoAli - Preço do AliExpress (em BRL)
 * @param {number} precoML - Preço do Mercado Livre
 * @returns {Object} Análise de compatibilidade de preços
 */
function analisarCompatibilidadePrecos(precoAli, precoML) {
    try {
        const precoAliNum = parseFloat(precoAli) || 0;
        const precoMLNum = parseFloat(precoML) || 0;

        if (precoAliNum <= 0 || precoMLNum <= 0) {
            return {
                compativel: false,
                multiplicador: 0,
                razao: 'Preços inválidos',
                precoAliNum,
                precoMLNum
            };
        }

        const multiplicador = precoMLNum / precoAliNum;
        
        const dentroDaFaixa = (
            multiplicador >= COMPARADOR_CONFIG.multiplicadorPrecoMin &&
            multiplicador <= COMPARADOR_CONFIG.multiplicadorPrecoMax
        );

        let razao;
        if (multiplicador < COMPARADOR_CONFIG.multiplicadorPrecoMin) {
            razao = 'ML muito barato comparado ao Ali';
        } else if (multiplicador > COMPARADOR_CONFIG.multiplicadorPrecoMax) {
            razao = 'ML muito caro comparado ao Ali';
        } else {
            razao = 'Preços dentro da faixa esperada';
        }

        return {
            compativel: dentroDaFaixa,
            multiplicador: Math.round(multiplicador * 100) / 100,
            razao,
            precoAliNum: Math.round(precoAliNum * 100) / 100,
            precoMLNum: Math.round(precoMLNum * 100) / 100,
            margemBruta: Math.round(((precoMLNum - precoAliNum) / precoAliNum) * 100)
        };

    } catch (error) {
        return {
            compativel: false,
            multiplicador: 0,
            razao: `Erro no cálculo: ${error.message}`,
            precoAliNum: 0,
            precoMLNum: 0
        };
    }
}

/**
 * Calcula score final da compatibilidade
 * 
 * @param {Object} analiseTextual - Resultado da análise textual
 * @param {Object} analisePrecos - Resultado da análise de preços
 * @returns {number} Score final de 0 a 100
 */
function calcularScoreFinal(analiseTextual, analisePrecos) {
    try {
        let score = 0;
        
        // 70% do peso vem da similaridade textual
        score += (analiseTextual.score || 0) * 0.7;
        
        // 30% do peso vem da compatibilidade de preços
        if (analisePrecos.compativel) {
            score += 30; // Bonus por preço compatível
            
            // Bonus adicional se o multiplicador estiver em faixa ideal (2x-3x)
            if (analisePrecos.multiplicador >= 2.0 && analisePrecos.multiplicador <= 3.0) {
                score += 5;
            }
        }

        return Math.round(Math.min(100, score));
        
    } catch (error) {
        return 0;
    }
}

/**
 * Cria objeto padronizado de resultado da comparação
 */
function criarResultadoComparacao(compativel, score, motivo) {
    return {
        compativel,
        scoreFinal: score,
        confianca: 'baixa',
        motivo,
        analiseTextual: { cobertura: 0, score: 0 },
        analisePrecos: { compativel: false, multiplicador: 0 },
        timestamp: new Date().toISOString()
    };
}

/**
 * Verifica se uma string é um número isolado
 */
function isNumeroIsolado(palavra) {
    return /^\d+$/.test(palavra) && palavra.length < 4;
}

/**
 * Função auxiliar para buscar termo de busca otimizado para Mercado Livre
 * Agora com sistema de tradução inteligente e geração de termos aprimorada
 * 
 * @param {string} nomeAliExpress - Nome do produto no AliExpress
 * @param {Object} opcoes - Opções para geração do termo
 * @returns {Promise<string>} Termo otimizado para busca no ML
 */
export async function gerarTermoBuscaML(nomeAliExpress, opcoes = {}) {
    try {
        if (!nomeAliExpress || typeof nomeAliExpress !== 'string') {
            logErro('❌ Nome do produto inválido para geração de termo');
            return '';
        }

        const config = {
            usarTraducao: true,
            usarFallback: true,
            logDetalhado: false,
            ...opcoes
        };

        logInfo(`🎯 Gerando termo de busca ML para: "${nomeAliExpress}"`);

        if (config.usarTraducao) {
            try {
                // Usar o novo sistema de tradução
                const resultado = await processarNomeProduto(nomeAliExpress);
                
                if (resultado.processamento.sucessoTraducao) {
                    const termoOtimizado = resultado.termosBusca.termoPrincipal;
                    
                    if (config.logDetalhado) {
                        logSucesso(`✅ Termo gerado com tradução:`);
                        logInfo(`   📝 Original: "${nomeAliExpress}"`);
                        logInfo(`   🌐 Português: "${resultado.nomePortugues}"`);
                        logInfo(`   🔍 Termo: "${termoOtimizado}"`);
                    }
                    
                    return termoOtimizado;
                } else {
                    logAviso(`⚠️ Falha na tradução, usando fallback`);
                }
                
            } catch (traducaoError) {
                logErro(`❌ Erro na tradução: ${traducaoError.message}`);
            }
        }

        // Fallback: usar sistema antigo
        if (config.usarFallback) {
            logInfo(`🔄 Usando geração de termo fallback`);
            return gerarTermoBuscaMLFallback(nomeAliExpress);
        }

        return '';

    } catch (error) {
        logErro(`💥 Erro ao gerar termo de busca ML: ${error.message}`);
        return '';
    }
}

/**
 * Versão fallback da geração de termo de busca (sistema anterior)
 * @param {string} nomeAliExpress - Nome do produto no AliExpress
 * @returns {string} Termo otimizado para busca no ML
 */
function gerarTermoBuscaMLFallback(nomeAliExpress) {
    try {
        if (!nomeAliExpress || typeof nomeAliExpress !== 'string') {
            return '';
        }

        // Usar o slug comparativo mas manter mais palavras para busca
        const slug = gerarSlugComparativo(nomeAliExpress);
        const palavras = slug.split(' ');
        
        // Pegar as 3-5 palavras mais relevantes
        const palavrasRelevantes = palavras.slice(0, 5);
        
        // Adicionar palavras-chave se existirem
        const palavrasChaveEncontradas = palavras.filter(p => 
            COMPARADOR_CONFIG.palavrasChave.includes(p)
        );
        
        // Combinar palavras relevantes + palavras-chave
        const termoFinal = [...new Set([...palavrasRelevantes, ...palavrasChaveEncontradas])]
            .slice(0, 5)
            .join(' ');

        return termoFinal.trim();

    } catch (error) {
        console.error('Erro ao gerar termo de busca ML fallback:', error.message);
        return '';
    }
}

/**
 * Comparação avançada de produtos incluindo análise visual de imagens
 * Combina análise textual (70%) + análise visual (30%) para compatibilidade final
 * 
 * @param {Object} produtoAliExpress - Produto do AliExpress com imagens
 * @param {Array} produtosMercadoLivre - Lista de produtos do ML para comparar
 * @param {Browser} browser - Instância do browser para extrair imagens
 * @param {Object} opcoes - Opções de comparação
 * @returns {Promise<Object>} Análise completa com scores textuais e visuais
 */
export async function compararProdutosComImagens(produtoAliExpress, produtosMercadoLivre, browser, opcoes = {}) {
    try {
        const config = {
            incluirAnaliseVisual: true,
            pesoTexto: 0.7,        // 70% peso para análise textual
            pesoVisual: 0.3,       // 30% peso para análise visual
            limiarCompatibilidade: 0.6,
            top5ParaImagens: true, // Analisar imagens apenas dos top 5
            ...opcoes
        };

        logInfo(`🔍 Iniciando comparação avançada (texto + visual)`);
        logInfo(`📊 Pesos: Texto ${config.pesoTexto * 100}% | Visual ${config.pesoVisual * 100}%`);

        // 1. Análise textual de todos os produtos
        const resultadosTextuais = [];
        for (const produtoML of produtosMercadoLivre) {
            const analiseTextual = produtosSaoCompativeis(produtoAliExpress, produtoML);
            resultadosTextuais.push({
                produtoML,
                analiseTextual,
                scoreTextual: analiseTextual.scoreFinal,
                compativel: analiseTextual.compativel
            });
        }

        // Ordenar por score textual e pegar top 5 para análise visual
        resultadosTextuais.sort((a, b) => b.scoreTextual - a.scoreTextual);
        const top5Textuais = config.top5ParaImagens 
            ? resultadosTextuais.slice(0, 5)
            : resultadosTextuais;

        logSucesso(`✅ Análise textual: ${resultadosTextuais.length} produtos analisados`);
        logInfo(`🎯 Top 5 para análise visual: ${top5Textuais.map(r => r.scoreTextual).join('%, ')}%`);

        // 2. Análise visual apenas se produto Ali tem imagens
        let resultadoVisual = null;
        if (config.incluirAnaliseVisual && produtoAliExpress.imagens && produtoAliExpress.imagens.length > 0) {
            try {
                logInfo(`🖼️ Iniciando análise visual para top 5 produtos`);
                
                const produtosParaVisual = top5Textuais.map(r => r.produtoML);
                resultadoVisual = await compararImagensProdutos(
                    produtoAliExpress, 
                    produtosParaVisual, 
                    opcoes.configImagens || {}
                );

                if (resultadoVisual.sucesso) {
                    logSucesso(`✅ Análise visual concluída: ${resultadoVisual.analise.produtosComImagens} produtos com imagens`);
                } else {
                    logAviso(`⚠️ Análise visual falhou: ${resultadoVisual.erro}`);
                }

            } catch (visualError) {
                logErro(`❌ Erro na análise visual: ${visualError.message}`);
                resultadoVisual = null;
            }
        } else {
            logInfo(`ℹ️ Pulando análise visual: ${!config.incluirAnaliseVisual ? 'desabilitada' : 'sem imagens no produto Ali'}`);
        }

        // 3. Combinar scores textuais e visuais
        const resultadosFinais = combinarScoresTextuaisEVisuais(
            resultadosTextuais,
            resultadoVisual,
            config
        );

        // 4. Análise final
        const analise = analisarResultadosAvancados(resultadosFinais, config);

        logSucesso(`🎯 Comparação avançada concluída`);
        logInfo(`🏆 Melhor match: ${analise.melhorMatch ? analise.melhorMatch.scoreFinal + '%' : 'nenhum'}`);

        return {
            sucesso: true,
            produtoAliExpress: {
                nome: produtoAliExpress.nome,
                preco: produtoAliExpress.preco,
                totalImagens: produtoAliExpress.imagens?.length || 0
            },
            configuracao: config,
            analiseTextual: {
                totalAnalisados: resultadosTextuais.length,
                compativeisTextuais: resultadosTextuais.filter(r => r.compativel).length,
                scoreTextoMedio: calcularScoreMedio(resultadosTextuais.map(r => r.scoreTextual))
            },
            analiseVisual: resultadoVisual ? {
                sucesso: resultadoVisual.sucesso,
                produtosComImagens: resultadoVisual.analise?.produtosComImagens || 0,
                scoreVisualMedio: resultadoVisual.analise?.mediasSimilaridade?.maxima || 0,
                melhorMatchVisual: resultadoVisual.analise?.melhorMatchVisual?.similaridadeMaxima || 0
            } : null,
            resultados: resultadosFinais,
            analise,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logErro(`❌ Erro na comparação avançada: ${error.message}`);
        
        return {
            sucesso: false,
            erro: error.message,
            produtoAliExpress: produtoAliExpress || {},
            resultados: [],
            analise: {
                totalProdutos: 0,
                melhorMatch: null
            },
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Combina scores textuais e visuais em score final ponderado
 * 
 * @param {Array} resultadosTextuais - Resultados da análise textual
 * @param {Object} resultadoVisual - Resultado da análise visual
 * @param {Object} config - Configuração com pesos
 * @returns {Array} Resultados com scores combinados
 */
function combinarScoresTextuaisEVisuais(resultadosTextuais, resultadoVisual, config) {
    try {
        const resultadosFinais = [];

        for (const resultado of resultadosTextuais) {
            const { produtoML, analiseTextual, scoreTextual } = resultado;

            // Encontrar score visual correspondente se disponível
            let scoreVisual = 0;
            let analiseVisual = null;

            if (resultadoVisual && resultadoVisual.sucesso && resultadoVisual.resultadosComparacao) {
                const matchVisual = resultadoVisual.resultadosComparacao.find(rv => 
                    rv.produtoML.titulo === produtoML.titulo ||
                    rv.produtoML.link === produtoML.link
                );

                if (matchVisual) {
                    scoreVisual = matchVisual.similaridadeMaxima || 0;
                    analiseVisual = {
                        similaridadeMaxima: matchVisual.similaridadeMaxima,
                        similaridadeMedia: matchVisual.similaridadeMedia,
                        imagensComparadas: matchVisual.imagensComparadas,
                        melhorMatch: matchVisual.melhorMatch
                    };
                }
            }

            // Calcular score final ponderado
            const scoreFinal = config.incluirAnaliseVisual && scoreVisual > 0
                ? (scoreTextual * config.pesoTexto) + (scoreVisual * config.pesoVisual)
                : scoreTextual;

            // Determinar compatibilidade final
            const compatibilidadeFinal = scoreFinal >= (config.limiarCompatibilidade * 100);

            // Calcular confiança
            let confianca = 'baixa';
            if (scoreFinal >= 80) confianca = 'alta';
            else if (scoreFinal >= 65) confianca = 'media';

            resultadosFinais.push({
                produtoML,
                scoreTextual,
                scoreVisual,
                scoreFinal: Math.round(scoreFinal * 100) / 100,
                compativel: compatibilidadeFinal,
                confianca,
                analiseTextual,
                analiseVisual,
                metodosUsados: {
                    analiseTextual: true,
                    analiseVisual: scoreVisual > 0,
                    ponderacao: config.incluirAnaliseVisual && scoreVisual > 0
                }
            });
        }

        // Ordenar por score final
        resultadosFinais.sort((a, b) => b.scoreFinal - a.scoreFinal);

        return resultadosFinais;

    } catch (error) {
        logErro(`❌ Erro ao combinar scores: ${error.message}`);
        return resultadosTextuais.map(r => ({
            ...r,
            scoreFinal: r.scoreTextual,
            scoreVisual: 0,
            analiseVisual: null
        }));
    }
}

/**
 * Analisa resultados avançados e gera insights
 * 
 * @param {Array} resultados - Resultados combinados
 * @param {Object} config - Configurações
 * @returns {Object} Análise consolidada
 */
function analisarResultadosAvancados(resultados, config) {
    try {
        const totalProdutos = resultados.length;
        const produtosCompativeis = resultados.filter(r => r.compativel);
        const melhorMatch = resultados.length > 0 ? resultados[0] : null;

        // Estatísticas por método
        const comAnaliseVisual = resultados.filter(r => r.metodosUsados.analiseVisual);
        const scoresMedioPorMetodo = {
            textual: calcularScoreMedioArray(resultados.map(r => r.scoreTextual)),
            visual: comAnaliseVisual.length > 0 
                ? calcularScoreMedioArray(comAnaliseVisual.map(r => r.scoreVisual))
                : 0,
            final: calcularScoreMedioArray(resultados.map(r => r.scoreFinal))
        };

        // Distribuição de confiança
        const distribuicaoConfianca = {
            alta: resultados.filter(r => r.confianca === 'alta').length,
            media: resultados.filter(r => r.confianca === 'media').length,
            baixa: resultados.filter(r => r.confianca === 'baixa').length
        };

        // Top 3 matches
        const top3Matches = resultados.slice(0, 3).map((r, index) => ({
            posicao: index + 1,
            titulo: r.produtoML.titulo,
            scoreFinal: r.scoreFinal,
            scoreTextual: r.scoreTextual,
            scoreVisual: r.scoreVisual,
            confianca: r.confianca,
            metodosUsados: r.metodosUsados
        }));

        return {
            totalProdutos,
            produtosCompativeis: produtosCompativeis.length,
            taxaCompatibilidade: Math.round((produtosCompativeis.length / totalProdutos) * 100),
            melhorMatch,
            scoresMedioPorMetodo,
            distribuicaoConfianca,
            top3Matches,
            estatisticas: {
                produtosComAnaliseVisual: comAnaliseVisual.length,
                taxaAnaliseVisual: Math.round((comAnaliseVisual.length / totalProdutos) * 100),
                melhoriaScorePorVisual: comAnaliseVisual.length > 0
                    ? calcularMelhoriaScoreVisual(comAnaliseVisual)
                    : 0
            }
        };

    } catch (error) {
        logErro(`❌ Erro na análise avançada: ${error.message}`);
        return {
            totalProdutos: 0,
            melhorMatch: null,
            scoresMedioPorMetodo: { textual: 0, visual: 0, final: 0 }
        };
    }
}

/**
 * Calcula score médio de um array de scores
 */
function calcularScoreMedioArray(scores) {
    if (!scores || scores.length === 0) return 0;
    const soma = scores.reduce((acc, score) => acc + score, 0);
    return Math.round((soma / scores.length) * 100) / 100;
}

/**
 * Calcula melhoria média proporcionada pela análise visual
 */
function calcularMelhoriaScoreVisual(produtosComVisual) {
    try {
        const melhorias = produtosComVisual.map(p => p.scoreFinal - p.scoreTextual);
        return calcularScoreMedioArray(melhorias);
    } catch (error) {
        return 0;
    }
}

export {
    COMPARADOR_CONFIG,
    gerarSlugComparativo,
    analisarSimilaridadeTextual,
    analisarCompatibilidadePrecos,
    calcularScoreFinal,
    compararProdutosComImagens,
    combinarScoresTextuaisEVisuais,
    analisarResultadosAvancados,
    calcularScoreMedioArray,
    calcularMelhoriaScoreVisual
};
