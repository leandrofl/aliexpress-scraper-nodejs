/**
 * @fileoverview Comparação de imagens usando pHash (Perceptual Hash)
 * @description Sistema para comparar visualmente produtos do AliExpress com Mercado Livre
 * usando análise de similaridade de imagens por hash perceptual
 * 
 * @author Sistema de Scraping AliExpress - Comparador Visual
 * @version 1.0.0
 * @since 2024-01-01
 */

import imghash from 'imghash';
import { createWriteStream, unlink, mkdir } from 'fs';
import { promisify } from 'util';
import { join, extname } from 'path';
import { logInfo, logSucesso, logErro, logAviso } from '../scraper/utils.js';
import https from 'https';
import http from 'http';

const unlinkAsync = promisify(unlink);
const mkdirAsync = promisify(mkdir);

// Diretório temporário para imagens
const TEMP_DIR = join(process.cwd(), 'scraper', 'imgtemp');

// Função para calcular hash usando a nova biblioteca
const calcularHash = async (imagePath, options = {}) => {
    return await imghash.hash(imagePath, options.bits || 8, 'hex');
};

/**
 * Baixa uma imagem de uma URL para um arquivo local temporário
 * 
 * @param {string} url - URL da imagem
 * @param {string} nomeArquivo - Nome do arquivo local
 * @returns {Promise<string>} Caminho do arquivo baixado
 */
async function baixarImagemTemp(url, nomeArquivo) {
    return new Promise((resolve, reject) => {
        const caminhoArquivo = join(TEMP_DIR, nomeArquivo);
        const arquivo = createWriteStream(caminhoArquivo);
        
        const client = url.startsWith('https:') ? https : http;
        
        const request = client.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Status HTTP: ${response.statusCode}`));
                return;
            }
            
            response.pipe(arquivo);
            
            arquivo.on('finish', () => {
                arquivo.close();
                resolve(caminhoArquivo);
            });
            
            arquivo.on('error', (err) => {
                unlink(caminhoArquivo, () => {}); // Limpar arquivo parcial
                reject(err);
            });
        });
        
        request.on('error', (err) => {
            reject(err);
        });
        
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Timeout no download da imagem'));
        });
    });
}

/**
 * Remove um arquivo temporário
 * 
 * @param {string} caminhoArquivo - Caminho do arquivo para remover
 */
async function removerArquivoTemp(caminhoArquivo) {
    try {
        if (!caminhoArquivo) {
            logAviso(`⚠️ Caminho de arquivo temporário inválido`);
            return false;
        }

        await unlinkAsync(caminhoArquivo);
        logInfo(`🗑️ Arquivo temporário removido: ${path.basename(caminhoArquivo)}`);
        return true;
    } catch (err) {
        // Se arquivo não existe, considerar como sucesso (já foi removido)
        if (err.code === 'ENOENT') {
            logInfo(`📝 Arquivo temporário já não existe: ${path.basename(caminhoArquivo)}`);
            return true;
        }
        
        logErro(`❌ Erro ao remover arquivo temporário ${path.basename(caminhoArquivo)}: ${err.message}`);
        return false;
    }
}

/**
 * Limpa todos os arquivos temporários da pasta imgtemp
 */
async function limparTodosArquivosTemp() {
    try {
        const { readdir } = await import('fs');
        const readdirAsync = promisify(readdir);
        
        const arquivos = await readdirAsync(TEMP_DIR);
        
        if (arquivos.length === 0) {
            logInfo(`📁 Pasta temporária já está vazia`);
            return true;
        }
        
        logInfo(`🧹 Limpando ${arquivos.length} arquivos temporários restantes...`);
        
        let removidos = 0;
        for (const arquivo of arquivos) {
            const caminhoCompleto = path.join(TEMP_DIR, arquivo);
            const sucesso = await removerArquivoTemp(caminhoCompleto);
            if (sucesso) removidos++;
        }
        
        logSucesso(`✅ Limpeza completa: ${removidos}/${arquivos.length} arquivos removidos`);
        return removidos === arquivos.length;
        
    } catch (err) {
        logErro(`❌ Erro na limpeza completa: ${err.message}`);
        return false;
    }
}

/**
 * Garante que o diretório temporário existe
 */
async function garantirDiretorioTemp() {
    try {
        await mkdirAsync(TEMP_DIR, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
}

/**
 * Configurações para comparação de imagens
 */
const CONFIG_IMAGENS = {
    // Algoritmo de hash: 'phash', 'dhash', 'ahash', 'whash'
    algoritmo: 'phash',
    
    // Bits do hash (mais bits = maior precisão, mas processamento mais lento)
    bits: 8,
    
    // Threshold de similaridade (0-100, quanto maior mais restritivo)
    limiarSimilaridade: 85,
    
    // Timeout para download de imagens (ms)
    timeoutDownload: 10000,
    
    // Máximo de imagens a processar por produto ML
    maxImagensPorProduto: 3,
    
    // Retry para downloads falhados
    tentativasDownload: 2
};

/**
 * Compara imagens do produto AliExpress com produtos do Mercado Livre
 * 
 * @param {Object} produtoAliExpress - Produto do AliExpress com URLs de imagens
 * @param {Array} produtosMercadoLivre - Top 5 produtos do ML para comparar
 * @param {Object} opcoes - Opções de comparação
 * @returns {Promise<Object>} Resultado da comparação visual
 */
export async function compararImagensProdutos(produtoAliExpress, produtosMercadoLivre, opcoes = {}) {
    try {
        // Validação de entrada
        if (!produtoAliExpress?.imagens || !Array.isArray(produtoAliExpress.imagens)) {
            throw new Error('Produto AliExpress deve ter array de imagens válido');
        }

        if (!Array.isArray(produtosMercadoLivre) || produtosMercadoLivre.length === 0) {
            throw new Error('Lista de produtos Mercado Livre é obrigatória');
        }

        const config = { ...CONFIG_IMAGENS, ...opcoes };
        
        logInfo(`🖼️ Iniciando comparação visual de imagens`);
        logInfo(`🔍 AliExpress: ${produtoAliExpress.imagens.length} imagens`);
        logInfo(`🛒 Mercado Livre: ${produtosMercadoLivre.length} produtos para analisar`);

        // 1. Calcular hashes das imagens do AliExpress
        const hashesAliExpress = await calcularHashesImagens(
            produtoAliExpress.imagens,
            'AliExpress',
            config
        );

        if (hashesAliExpress.length === 0) {
            throw new Error('Nenhum hash válido calculado para imagens do AliExpress');
        }

        // 2. Processar cada produto do Mercado Livre
        const resultadosComparacao = [];
        
        for (let i = 0; i < Math.min(produtosMercadoLivre.length, 5); i++) {
            const produtoML = produtosMercadoLivre[i];
            
            try {
                logInfo(`📱 Analisando produto ML ${i + 1}/5: "${produtoML.titulo.substring(0, 50)}..."`);
                
                // Extrair URLs de imagens do produto ML
                const imagensML = await extrairImagensProdutoMLInterno(produtoML, config);
                
                if (imagensML.length === 0) {
                    logAviso(`⚠️ Nenhuma imagem encontrada para produto ML ${i + 1}`);
                    resultadosComparacao.push({
                        produtoML,
                        similaridadeMaxima: 0,
                        similaridadeMedia: 0,
                        imagensComparadas: 0,
                        melhorMatch: null,
                        erro: 'Sem imagens válidas'
                    });
                    continue;
                }

                // Calcular hashes das imagens do ML
                const hashesML = await calcularHashesImagens(imagensML, `ML-${i + 1}`, config);
                
                if (hashesML.length === 0) {
                    logAviso(`⚠️ Nenhum hash válido para produto ML ${i + 1}`);
                    resultadosComparacao.push({
                        produtoML,
                        similaridadeMaxima: 0,
                        similaridadeMedia: 0,
                        imagensComparadas: 0,
                        melhorMatch: null,
                        erro: 'Falha no processamento de hashes'
                    });
                    continue;
                }

                // Comparar todos os hashes Ali vs ML
                const comparacao = compararHashesImagens(hashesAliExpress, hashesML);
                
                resultadosComparacao.push({
                    produtoML,
                    similaridadeMaxima: comparacao.similaridadeMaxima,
                    similaridadeMedia: comparacao.similaridadeMedia,
                    imagensComparadas: comparacao.comparacoesRealizadas,
                    melhorMatch: comparacao.melhorMatch,
                    detalhesComparacao: comparacao.detalhes
                });

                logSucesso(`✅ Produto ML ${i + 1}: Similaridade máxima ${comparacao.similaridadeMaxima}%`);

            } catch (produtoError) {
                logErro(`❌ Erro ao processar produto ML ${i + 1}: ${produtoError.message}`);
                resultadosComparacao.push({
                    produtoML,
                    similaridadeMaxima: 0,
                    similaridadeMedia: 0,
                    imagensComparadas: 0,
                    melhorMatch: null,
                    erro: produtoError.message
                });
            }
        }

        // 3. Analisar resultados e encontrar melhor match visual
        const analise = analisarResultadosComparacao(resultadosComparacao, config);

        logSucesso(`🎯 Comparação visual concluída: ${analise.produtosAnalisados} produtos`);
        if (analise.melhorMatchVisual) {
            logSucesso(`🏆 Melhor match visual: ${analise.melhorMatchVisual.similaridadeMaxima}% de similaridade`);
        }

        // 4. Limpeza final de todos os arquivos temporários
        await limparTodosArquivosTemp();

        return {
            sucesso: true,
            produtoAliExpress: {
                nome: produtoAliExpress.nome,
                totalImagens: produtoAliExpress.imagens.length,
                imagensProcessadas: hashesAliExpress.length
            },
            resultadosComparacao,
            analise,
            configuracao: {
                algoritmo: config.algoritmo,
                limiarSimilaridade: config.limiarSimilaridade,
                maxImagensPorProduto: config.maxImagensPorProduto
            },
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logErro(`❌ Erro na comparação de imagens: ${error.message}`);
        
        return {
            sucesso: false,
            erro: error.message,
            produtoAliExpress: produtoAliExpress || {},
            resultadosComparacao: [],
            analise: {
                produtosAnalisados: 0,
                melhorMatchVisual: null,
                mediasSimilaridade: { maxima: 0, media: 0 }
            },
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Calcula hashes perceptuais para um array de URLs de imagens
 * Processa em lotes de 2 imagens: baixa → calcula hash → remove
 * 
 * @param {Array} urlsImagens - URLs das imagens para processar
 * @param {string} origem - Identificador da origem (para logs)
 * @param {Object} config - Configurações
 * @returns {Promise<Array>} Array de objetos com hash e metadata
 */
async function calcularHashesImagens(urlsImagens, origem, config) {
    await garantirDiretorioTemp();
    
    const hashes = [];
    const LOTE_SIZE = 2; // Processar 2 imagens por vez
    
    logInfo(`🔢 Processando ${urlsImagens.length} imagens de ${origem} em lotes de ${LOTE_SIZE}`);
    
    for (let i = 0; i < urlsImagens.length && hashes.length < config.maxImagensPorProduto; i += LOTE_SIZE) {
        const loteUrls = urlsImagens.slice(i, i + LOTE_SIZE);
        const arquivosTemp = [];
        
        try {
            logInfo(`� Processando lote ${Math.floor(i/LOTE_SIZE) + 1} - URLs ${i + 1} a ${Math.min(i + LOTE_SIZE, urlsImagens.length)}`);
            
            // FASE 1: Baixar imagens do lote
            for (let j = 0; j < loteUrls.length; j++) {
                const url = loteUrls[j];
                const indiceGlobal = i + j;
                const extensao = extname(new URL(url).pathname) || '.jpg';
                const nomeArquivo = `${origem}_${indiceGlobal}_${Date.now()}${extensao}`;
                
                try {
                    logInfo(`⬇️ Baixando imagem ${indiceGlobal + 1}: ${url.substring(0, 50)}...`);
                    
                    const caminhoArquivo = await baixarImagemTemp(url, nomeArquivo);
                    arquivosTemp.push({
                        url,
                        caminho: caminhoArquivo,
                        indice: indiceGlobal,
                        nomeArquivo
                    });
                    
                    logSucesso(`✅ Download concluído: ${nomeArquivo}`);
                    
                } catch (downloadError) {
                    logErro(`❌ Erro no download ${indiceGlobal + 1}: ${downloadError.message}`);
                    continue;
                }
            }
            
            // FASE 2: Calcular hashes das imagens baixadas
            for (const arquivo of arquivosTemp) {
                try {
                    logInfo(`🔢 Calculando hash para ${arquivo.nomeArquivo}`);
                    
                    const hash = await calcularHash(arquivo.caminho, { bits: config.bits });
                    
                    hashes.push({
                        url: arquivo.url,
                        hash,
                        origem,
                        indice: arquivo.indice,
                        calculadoEm: new Date().toISOString(),
                        algoritmo: 'phash',
                        bits: config.bits
                    });
                    
                    logSucesso(`✅ Hash calculado: ${hash.substring(0, 16)}...`);
                    
                } catch (hashError) {
                    logErro(`❌ Erro no cálculo de hash para ${arquivo.nomeArquivo}: ${hashError.message}`);
                }
            }
            
            // FASE 3: Limpar arquivos temporários do lote
            logInfo(`🧹 Limpando ${arquivosTemp.length} arquivos temporários do lote`);
            for (const arquivo of arquivosTemp) {
                await removerArquivoTemp(arquivo.caminho);
            }
            
            logSucesso(`✅ Lote processado: ${hashes.length}/${config.maxImagensPorProduto} hashes calculados`);
            
            // Pequena pausa entre lotes para não sobrecarregar
            if (i + LOTE_SIZE < urlsImagens.length) {
                await delay(500);
            }
            
        } catch (loteError) {
            logErro(`❌ Erro no processamento do lote: ${loteError.message}`);
            
            // Limpar arquivos temporários em caso de erro
            for (const arquivo of arquivosTemp) {
                if (arquivo.caminho) {
                    await removerArquivoTemp(arquivo.caminho);
                }
            }
        }
        
        // Parar se atingiu o máximo de imagens
        if (hashes.length >= config.maxImagensPorProduto) {
            break;
        }
    }
    
    logInfo(`🏁 Processamento de ${origem} concluído: ${hashes.length} hashes calculados`);
    return hashes;
}

/**
 * Extrai URLs de imagens de um produto do Mercado Livre
 * 
 * @param {Object} produtoML - Produto do Mercado Livre
 * @param {Object} config - Configurações
 * @returns {Promise<Array>} URLs das imagens extraídas
 */
async function extrairImagensProdutoMLInterno(produtoML, config) {
    try {
        // Se o produto já tem imagens extraídas
        if (produtoML.imagens && Array.isArray(produtoML.imagens)) {
            return produtoML.imagens.slice(0, config.maxImagensPorProduto);
        }
        
        // Se tem apenas imagem principal
        if (produtoML.imagemPrincipal) {
            return [produtoML.imagemPrincipal];
        }
        
        logAviso(`⚠️ Produto ML não tem imagens disponíveis. Link: ${produtoML.link}`);
        
        // Para funcionalidade completa, seria necessário usar a função do scraper ML
        // que navega para a página do produto e extrai as imagens da galeria
        
        return [];
        
    } catch (error) {
        logErro(`❌ Erro ao extrair imagens do produto ML: ${error.message}`);
        return [];
    }
}

/**
 * Compara arrays de hashes e calcula similaridades
 * 
 * @param {Array} hashesAli - Hashes das imagens do AliExpress
 * @param {Array} hashesML - Hashes das imagens do Mercado Livre
 * @returns {Object} Resultado da comparação
 */
function compararHashesImagens(hashesAli, hashesML) {
    try {
        const comparacoes = [];
        let somaTodasSimilaridades = 0;
        let totalComparacoes = 0;
        
        // Comparar cada hash Ali com cada hash ML
        for (const hashAli of hashesAli) {
            for (const hashML of hashesML) {
                const similaridade = calcularSimilaridadeHashes(hashAli.hash, hashML.hash);
                
                comparacoes.push({
                    imagemAli: hashAli,
                    imagemML: hashML,
                    similaridade,
                    distanciaHamming: 100 - similaridade
                });
                
                somaTodasSimilaridades += similaridade;
                totalComparacoes++;
            }
        }
        
        // Encontrar melhor match
        comparacoes.sort((a, b) => b.similaridade - a.similaridade);
        const melhorMatch = comparacoes[0];
        
        // Calcular estatísticas
        const similaridadeMaxima = melhorMatch.similaridade;
        const similaridadeMedia = totalComparacoes > 0 
            ? Math.round((somaTodasSimilaridades / totalComparacoes) * 100) / 100 
            : 0;
        
        return {
            similaridadeMaxima: Math.round(similaridadeMaxima * 100) / 100,
            similaridadeMedia,
            comparacoesRealizadas: totalComparacoes,
            melhorMatch: {
                imagemAliIndice: melhorMatch.imagemAli.indice,
                imagemMLIndice: melhorMatch.imagemML.indice,
                similaridade: melhorMatch.similaridade,
                hashAli: melhorMatch.imagemAli.hash.substring(0, 16) + '...',
                hashML: melhorMatch.imagemML.hash.substring(0, 16) + '...'
            },
            detalhes: {
                totalHashesAli: hashesAli.length,
                totalHashesML: hashesML.length,
                distribuicaoSimilaridades: calcularDistribuicaoSimilaridades(comparacoes)
            }
        };
        
    } catch (error) {
        throw new Error(`Erro na comparação de hashes: ${error.message}`);
    }
}

/**
 * Calcula similaridade entre dois hashes usando distância de Hamming
 * 
 * @param {string} hash1 - Primeiro hash
 * @param {string} hash2 - Segundo hash
 * @returns {number} Percentual de similaridade (0-100)
 */
function calcularSimilaridadeHashes(hash1, hash2) {
    try {
        if (!hash1 || !hash2 || hash1.length !== hash2.length) {
            return 0;
        }
        
        let bitsIguais = 0;
        const totalBits = hash1.length * 4; // Cada char hex = 4 bits
        
        // Converter hashes hexadecimais para binário e comparar bit a bit
        for (let i = 0; i < hash1.length; i++) {
            const valor1 = parseInt(hash1[i], 16);
            const valor2 = parseInt(hash2[i], 16);
            
            // XOR para encontrar diferenças, depois contar bits iguais
            const xor = valor1 ^ valor2;
            
            // Contar bits que são 0 (iguais)
            for (let bit = 0; bit < 4; bit++) {
                if ((xor & (1 << bit)) === 0) {
                    bitsIguais++;
                }
            }
        }
        
        // Calcular percentual de similaridade
        const similaridade = (bitsIguais / totalBits) * 100;
        return Math.round(similaridade * 100) / 100;
        
    } catch (error) {
        logErro(`❌ Erro no cálculo de similaridade: ${error.message}`);
        return 0;
    }
}

/**
 * Calcula distribuição estatística das similaridades
 * 
 * @param {Array} comparacoes - Array de comparações
 * @returns {Object} Estatísticas de distribuição
 */
function calcularDistribuicaoSimilaridades(comparacoes) {
    try {
        const similaridades = comparacoes.map(c => c.similaridade).sort((a, b) => b - a);
        
        return {
            minima: similaridades[similaridades.length - 1] || 0,
            maxima: similaridades[0] || 0,
            media: similaridades.reduce((acc, s) => acc + s, 0) / similaridades.length || 0,
            mediana: similaridades[Math.floor(similaridades.length / 2)] || 0,
            quartil75: similaridades[Math.floor(similaridades.length * 0.25)] || 0,
            quartil25: similaridades[Math.floor(similaridades.length * 0.75)] || 0,
            total: similaridades.length
        };
    } catch (error) {
        return { total: 0, media: 0, maxima: 0, minima: 0 };
    }
}

/**
 * Analisa resultados da comparação e identifica padrões
 * 
 * @param {Array} resultados - Resultados da comparação
 * @param {Object} config - Configurações
 * @returns {Object} Análise consolidada
 */
function analisarResultadosComparacao(resultados, config) {
    try {
        const produtosComImagens = resultados.filter(r => r.imagensComparadas > 0);
        const produtosSimilares = produtosComImagens.filter(r => 
            r.similaridadeMaxima >= config.limiarSimilaridade
        );
        
        // Ordenar por similaridade máxima
        produtosComImagens.sort((a, b) => b.similaridadeMaxima - a.similaridadeMaxima);
        
        // Melhor match visual
        const melhorMatchVisual = produtosComImagens.length > 0 ? produtosComImagens[0] : null;
        
        // Médias
        const similaridadesMaximas = produtosComImagens.map(r => r.similaridadeMaxima);
        const similaridadesMedias = produtosComImagens.map(r => r.similaridadeMedia);
        
        const mediaMaxima = similaridadesMaximas.length > 0
            ? Math.round((similaridadesMaximas.reduce((acc, s) => acc + s, 0) / similaridadesMaximas.length) * 100) / 100
            : 0;
            
        const mediaGeral = similaridadesMedias.length > 0
            ? Math.round((similaridadesMedias.reduce((acc, s) => acc + s, 0) / similaridadesMedias.length) * 100) / 100
            : 0;
        
        return {
            produtosAnalisados: resultados.length,
            produtosComImagens: produtosComImagens.length,
            produtosSimilares: produtosSimilares.length,
            taxaSimilaridade: produtosComImagens.length > 0 
                ? Math.round((produtosSimilares.length / produtosComImagens.length) * 100) 
                : 0,
            melhorMatchVisual,
            mediasSimilaridade: {
                maxima: mediaMaxima,
                media: mediaGeral
            },
            distribuicaoPorFaixaSimilaridade: {
                muitoAlta: produtosComImagens.filter(r => r.similaridadeMaxima >= 90).length, // ≥90%
                alta: produtosComImagens.filter(r => r.similaridadeMaxima >= 80 && r.similaridadeMaxima < 90).length, // 80-89%
                media: produtosComImagens.filter(r => r.similaridadeMaxima >= 60 && r.similaridadeMaxima < 80).length, // 60-79%
                baixa: produtosComImagens.filter(r => r.similaridadeMaxima < 60).length // <60%
            }
        };
        
    } catch (error) {
        logErro(`❌ Erro na análise de resultados: ${error.message}`);
        return {
            produtosAnalisados: 0,
            melhorMatchVisual: null,
            mediasSimilaridade: { maxima: 0, media: 0 }
        };
    }
}

/**
 * Utilitário para delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export {
    CONFIG_IMAGENS,
    calcularHashesImagens,
    extrairImagensProdutoMLInterno,
    compararHashesImagens,
    calcularSimilaridadeHashes,
    calcularDistribuicaoSimilaridades,
    analisarResultadosComparacao
};
