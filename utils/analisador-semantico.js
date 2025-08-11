/**
 * @fileoverview Módulo de análise semântica usando Transformers offline
 * @description Implementa comparação semântica de títulos usando BERT multilingual
 * 
 * @author Sistema de Scraping AliExpress - Semantic Analyzer v1.0
 */

import { pipeline } from '@xenova/transformers';

// Pipeline de análise semântica (será inicializado sob demanda)
let embedder = null;

/**
 * Inicializa o pipeline de embeddings semânticos
 */
async function inicializarEmbedder() {
    if (!embedder) {
        console.log('🧠 Inicializando modelo de análise semântica...');
        try {
            embedder = await pipeline(
                'feature-extraction', 
                'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
            );
            console.log('✅ Modelo semântico carregado com sucesso!');
        } catch (error) {
            console.warn('⚠️ Erro ao carregar modelo semântico, usando fallback:', error.message);
            // Fallback para modelo menor se o principal falhar
            embedder = await pipeline(
                'feature-extraction', 
                'Xenova/all-MiniLM-L6-v2'
            );
        }
    }
    return embedder;
}

/**
 * Faz mean pooling dos embeddings para obter vetor fixo
 * @param {Object} embedding - Tensor de embedding
 * @returns {Array} Vetor de embedding pooled
 */
function meanPooling(embedding) {
    const [batchSize, seqLen, hiddenSize] = embedding.dims;
    const data = embedding.data;
    const pooled = new Array(hiddenSize).fill(0);
    
    // Mean pooling: média de todos os tokens para cada dimensão
    for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < hiddenSize; j++) {
            pooled[j] += data[i * hiddenSize + j];
        }
    }
    
    // Dividir pela quantidade de tokens
    for (let j = 0; j < hiddenSize; j++) {
        pooled[j] /= seqLen;
    }
    
    return pooled;
}
function calcularSimilaridadeCosseno(vecA, vecB) {
    try {
        // Converter para arrays se necessário
        const arrayA = Array.isArray(vecA) ? vecA : Array.from(vecA.data || vecA);
        const arrayB = Array.isArray(vecB) ? vecB : Array.from(vecB.data || vecB);
        
        if (!arrayA || !arrayB || arrayA.length !== arrayB.length) {
            console.error('⚠️ Vetores inválidos ou tamanhos diferentes');
            return 0;
        }
        
        const dotProduct = arrayA.reduce((sum, val, i) => sum + val * arrayB[i], 0);
        const normA = Math.sqrt(arrayA.reduce((sum, val) => sum + val ** 2, 0));
        const normB = Math.sqrt(arrayB.reduce((sum, val) => sum + val ** 2, 0));
        
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (normA * normB);
    } catch (error) {
        console.error('⚠️ Erro no cálculo de similaridade:', error.message);
        return 0;
    }
}

/**
 * Limpa e normaliza texto para análise semântica
 * @param {string} texto - Texto a ser normalizado
 * @returns {string} Texto limpo
 */
function normalizarTexto(texto) {
    return texto
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove pontuação
        .replace(/\s+/g, ' ')     // Normaliza espaços
        .trim()
        .substring(0, 200);       // Limita a 200 caracteres para performance
}

/**
 * Compara semanticamente dois títulos de produtos
 * @param {string} titulo1 - Primeiro título
 * @param {string} titulo2 - Segundo título
 * @returns {Promise<Object>} Score de similaridade e detalhes
 */
export async function compararSemantica(titulo1, titulo2) {
    try {
        await inicializarEmbedder();

        // Normalizar textos
        const texto1 = normalizarTexto(titulo1);
        const texto2 = normalizarTexto(titulo2);

        if (!texto1 || !texto2) {
            return {
                score: 0,
                compativel: false,
                motivo: 'Texto vazio após normalização'
            };
        }

        // Gerar embeddings
        const embedding1 = await embedder(texto1);
        const embedding2 = await embedder(texto2);

        // Fazer mean pooling para obter vetores de tamanho fixo
        const pooled1 = meanPooling(embedding1);
        const pooled2 = meanPooling(embedding2);

        // Calcular similaridade usando os vetores pooled
        const similaridade = calcularSimilaridadeCosseno(pooled1, pooled2);

        const scorePercentual = Math.round(similaridade * 100);

        // Determinar compatibilidade
        const compativel = scorePercentual >= 70; // Threshold semântico mais alto

        return {
            score: scorePercentual,
            compativel,
            similaridade: similaridade,
            motivo: compativel 
                ? `Alta similaridade semântica: ${scorePercentual}%`
                : `Baixa similaridade semântica: ${scorePercentual}%`,
            metodo: 'semantico',
            texto1: texto1,
            texto2: texto2
        };

    } catch (error) {
        console.warn('⚠️ Erro na análise semântica:', error.message);
        
        // Fallback para análise textual simples
        return await compararTextualFallback(titulo1, titulo2);
    }
}

/**
 * Fallback para análise textual simples quando semântica falha
 * @param {string} titulo1 - Primeiro título
 * @param {string} titulo2 - Segundo título
 * @returns {Object} Score de similaridade textual
 */
async function compararTextualFallback(titulo1, titulo2) {
    const texto1 = normalizarTexto(titulo1);
    const texto2 = normalizarTexto(titulo2);

    const palavras1 = new Set(texto1.split(' ').filter(p => p.length > 2));
    const palavras2 = new Set(texto2.split(' ').filter(p => p.length > 2));

    const intersecao = new Set([...palavras1].filter(x => palavras2.has(x)));
    const uniao = new Set([...palavras1, ...palavras2]);

    const jaccardScore = intersecao.size / uniao.size;
    const scorePercentual = Math.round(jaccardScore * 100);

    return {
        score: scorePercentual,
        compativel: scorePercentual >= 60,
        similaridade: jaccardScore,
        motivo: `Análise textual (fallback): ${scorePercentual}%`,
        metodo: 'textual_fallback'
    };
}

/**
 * Analisa lista de produtos ML contra produto AliExpress
 * @param {Object} produtoAli - Produto do AliExpress
 * @param {Array} produtosML - Lista de produtos do Mercado Livre
 * @returns {Promise<Object>} Melhor match e análises
 */
export async function analisarProdutosSemantico(produtoAli, produtosML) {
    const analises = [];

    for (const produtoML of produtosML) {
        const analise = await compararSemantica(produtoAli.nome, produtoML.nome);
        analises.push({
            produto: produtoML,
            analise: analise
        });
    }

    // Ordenar por score semântico
    analises.sort((a, b) => b.analise.score - a.analise.score);

    const melhorMatch = analises[0];

    return {
        melhorMatch: melhorMatch?.produto || null,
        scoreSemantico: melhorMatch?.analise.score || 0,
        analiseCompleta: melhorMatch?.analise || null,
        todasAnalises: analises,
        metodoUsado: melhorMatch?.analise.metodo || 'nenhum'
    };
}

/**
 * Calcula preço médio dos top 3 produtos ML
 * @param {Array} top3Produtos - Array dos 3 melhores produtos
 * @returns {Object} Estatísticas de preços
 */
export function calcularEstatisticasPreco(top3Produtos) {
    const precos = top3Produtos
        .map(p => parseFloat(p.preco))
        .filter(p => p > 0);

    if (precos.length === 0) {
        return {
            precoMedioML: 0,
            precoMinimo: 0,
            precoMaximo: 0,
            desvioPreco: 0,
            quantidadePrecos: 0
        };
    }

    const precoMedioML = precos.reduce((acc, val) => acc + val, 0) / precos.length;
    const precoMinimo = Math.min(...precos);
    const precoMaximo = Math.max(...precos);

    return {
        precoMedioML: Math.round(precoMedioML * 100) / 100,
        precoMinimo,
        precoMaximo,
        quantidadePrecos: precos.length,
        precos: precos
    };
}

/**
 * Calcula desvio de preço percentual
 * @param {number} precoML - Preço no Mercado Livre
 * @param {number} precoAli - Preço no AliExpress
 * @returns {number} Desvio percentual
 */
export function calcularDesvioPreco(precoML, precoAli) {
    if (!precoAli || precoAli <= 0) return 0;
    return Math.round(((precoML - precoAli) / precoAli) * 100 * 100) / 100;
}

/**
 * Testa o sistema de análise semântica
 * @returns {Promise<void>}
 */
export async function testarSistemaSemantico() {
    console.log('🧪 Testando sistema de análise semântica...\n');

    const casos = [
        {
            titulo1: 'iPhone 15 Pro Max 256GB Azul',
            titulo2: 'Apple iPhone 15 Pro Max 256 GB cor azul'
        },
        {
            titulo1: 'Fone de Ouvido Bluetooth Sem Fio',
            titulo2: 'Headphone Wireless Bluetooth'
        },
        {
            titulo1: 'Relógio Inteligente Smartwatch',
            titulo2: 'Smartwatch Digital com GPS'
        }
    ];

    for (const caso of casos) {
        const resultado = await compararSemantica(caso.titulo1, caso.titulo2);
        console.log(`📊 "${caso.titulo1}" vs "${caso.titulo2}"`);
        console.log(`   Score: ${resultado.score}% | Compatível: ${resultado.compativel ? 'SIM' : 'NÃO'}`);
        console.log(`   Método: ${resultado.metodo} | ${resultado.motivo}\n`);
    }
}
