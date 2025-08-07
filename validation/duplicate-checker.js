/**
 * @fileoverview Sistema de validação contra duplicidade de produtos
 * @description Evita processar o mesmo produto mais de uma vez usando hash único
 * 
 * @author Sistema de Scraping AliExpress - Deduplicator v1.0
 * @version 1.0.0 - Sistema anti-duplicidade
 * @since 2024-01-01
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DUPLICATES_DB_PATH = path.join(process.cwd(), 'data', 'produtos-processados.json');

/**
 * Gerar hash único para um produto
 * @param {Object} produto - Produto do AliExpress
 * @returns {string} Hash único do produto
 */
export function gerarHashProduto(produto) {
    try {
        // Usar product_id + categoria + preço como base para hash
        const baseData = {
            product_id: produto.product_id || produto.id,
            categoria: produto.categoria || 'unknown',
            preco: Math.round((produto.preco || 0) * 100), // Arredondar centavos
            nome: (produto.nome || '').toLowerCase().substring(0, 50) // Primeiros 50 chars
        };

        const dataString = JSON.stringify(baseData);
        return crypto.createHash('md5').update(dataString).digest('hex');
    } catch (error) {
        console.error('❌ Erro ao gerar hash do produto:', error.message);
        // Fallback: usar product_id simples
        return crypto.createHash('md5').update(produto.product_id || Math.random().toString()).digest('hex');
    }
}

/**
 * Carregar banco de produtos já processados
 * @returns {Object} Banco de produtos processados
 */
async function carregarBancoDuplicados() {
    try {
        // Garantir que a pasta data existe
        const dataDir = path.dirname(DUPLICATES_DB_PATH);
        await fs.mkdir(dataDir, { recursive: true });

        // Tentar carregar arquivo existente
        const data = await fs.readFile(DUPLICATES_DB_PATH, 'utf-8');
        const banco = JSON.parse(data);
        
        // Validar estrutura
        if (!banco.produtos || !banco.stats) {
            throw new Error('Estrutura inválida do banco');
        }
        
        return banco;
    } catch (error) {
        // Arquivo não existe ou está corrompido - criar novo
        console.log('📝 Criando novo banco de duplicados...');
        return {
            produtos: {},
            stats: {
                totalProcessados: 0,
                ultimaLimpeza: new Date().toISOString(),
                versao: '1.0.0'
            }
        };
    }
}

/**
 * Salvar banco de produtos processados
 * @param {Object} banco - Banco atualizado
 */
async function salvarBancoDuplicados(banco) {
    try {
        banco.stats.ultimaAtualizacao = new Date().toISOString();
        await fs.writeFile(DUPLICATES_DB_PATH, JSON.stringify(banco, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar banco de duplicados:', error.message);
    }
}

/**
 * Verificar se produto já foi processado
 * @param {Object} produto - Produto para verificar
 * @returns {Promise<Object>} Resultado da verificação
 */
export async function verificarDuplicidade(produto) {
    try {
        const hash = gerarHashProduto(produto);
        const banco = await carregarBancoDuplicados();
        
        const jaProcessado = banco.produtos[hash];
        
        if (jaProcessado) {
            return {
                isDuplicado: true,
                hash: hash,
                primeiroProcessamento: jaProcessado.timestamp,
                categoria: jaProcessado.categoria,
                diasApos: Math.floor((Date.now() - new Date(jaProcessado.timestamp)) / (1000 * 60 * 60 * 24)),
                motivo: 'Produto já processado anteriormente'
            };
        }
        
        return {
            isDuplicado: false,
            hash: hash,
            novo: true
        };
        
    } catch (error) {
        console.error('❌ Erro ao verificar duplicidade:', error.message);
        return {
            isDuplicado: false,
            erro: error.message,
            hash: gerarHashProduto(produto)
        };
    }
}

/**
 * Marcar produto como processado
 * @param {Object} produto - Produto processado
 * @param {Object} metadados - Metadados adicionais
 * @returns {Promise<boolean>} Sucesso da operação
 */
export async function marcarComoProcessado(produto, metadados = {}) {
    try {
        const hash = gerarHashProduto(produto);
        const banco = await carregarBancoDuplicados();
        
        banco.produtos[hash] = {
            product_id: produto.product_id,
            nome: produto.nome?.substring(0, 100),
            categoria: produto.categoria,
            preco: produto.preco,
            timestamp: new Date().toISOString(),
            aprovadoFinal: produto.aprovadoFinal || false,
            scoreTotal: produto.scoreTotal?.total || 0,
            ...metadados
        };
        
        banco.stats.totalProcessados++;
        await salvarBancoDuplicados(banco);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao marcar produto como processado:', error.message);
        return false;
    }
}

/**
 * Filtrar produtos duplicados de uma lista
 * @param {Array} produtos - Lista de produtos
 * @returns {Promise<Object>} Produtos únicos e estatísticas
 */
export async function filtrarDuplicados(produtos) {
    const resultado = {
        produtosUnicos: [],
        duplicados: [],
        stats: {
            totalInput: produtos.length,
            novos: 0,
            duplicados: 0,
            errors: 0
        }
    };
    
    for (const produto of produtos) {
        try {
            const verificacao = await verificarDuplicidade(produto);
            
            if (verificacao.isDuplicado) {
                resultado.duplicados.push({
                    produto,
                    verificacao
                });
                resultado.stats.duplicados++;
            } else {
                resultado.produtosUnicos.push(produto);
                resultado.stats.novos++;
            }
        } catch (error) {
            console.error(`❌ Erro ao verificar produto ${produto.product_id}:`, error.message);
            resultado.stats.errors++;
            // Em caso de erro, incluir o produto (fail-safe)
            resultado.produtosUnicos.push(produto);
        }
    }
    
    return resultado;
}

/**
 * Limpar produtos antigos do banco (mais de X dias)
 * @param {number} diasParaLimpar - Dias para considerar produto antigo (padrão: 30)
 * @returns {Promise<Object>} Resultado da limpeza
 */
export async function limparProdutosAntigos(diasParaLimpar = 30) {
    try {
        const banco = await carregarBancoDuplicados();
        const agora = Date.now();
        const limiteTempo = diasParaLimpar * 24 * 60 * 60 * 1000;
        
        let removidos = 0;
        const produtosLimpos = {};
        
        for (const [hash, produto] of Object.entries(banco.produtos)) {
            const idade = agora - new Date(produto.timestamp).getTime();
            
            if (idade <= limiteTempo) {
                produtosLimpos[hash] = produto;
            } else {
                removidos++;
            }
        }
        
        banco.produtos = produtosLimpos;
        banco.stats.ultimaLimpeza = new Date().toISOString();
        banco.stats.totalProcessados = Object.keys(produtosLimpos).length;
        
        await salvarBancoDuplicados(banco);
        
        return {
            removidos,
            mantidos: Object.keys(produtosLimpos).length,
            diasLimite: diasParaLimpar
        };
        
    } catch (error) {
        console.error('❌ Erro ao limpar produtos antigos:', error.message);
        return { erro: error.message };
    }
}

/**
 * Obter estatísticas do banco de duplicados
 * @returns {Promise<Object>} Estatísticas detalhadas
 */
export async function obterEstatisticasDuplicados() {
    try {
        const banco = await carregarBancoDuplicados();
        const produtos = Object.values(banco.produtos);
        
        const stats = {
            totalProdutos: produtos.length,
            produtosPorCategoria: {},
            produtosAprovados: 0,
            scoresMedio: 0,
            distribucaoIdade: {
                ultimas24h: 0,
                ultimaSemana: 0,
                ultimoMes: 0,
                maisAntigos: 0
            }
        };
        
        const agora = Date.now();
        let somaScores = 0;
        
        produtos.forEach(produto => {
            // Categoria
            const cat = produto.categoria || 'unknown';
            stats.produtosPorCategoria[cat] = (stats.produtosPorCategoria[cat] || 0) + 1;
            
            // Aprovados
            if (produto.aprovadoFinal) {
                stats.produtosAprovados++;
            }
            
            // Scores
            somaScores += produto.scoreTotal || 0;
            
            // Idade
            const idade = agora - new Date(produto.timestamp).getTime();
            const dias = idade / (1000 * 60 * 60 * 24);
            
            if (dias <= 1) stats.distribucaoIdade.ultimas24h++;
            else if (dias <= 7) stats.distribucaoIdade.ultimaSemana++;
            else if (dias <= 30) stats.distribucaoIdade.ultimoMes++;
            else stats.distribucaoIdade.maisAntigos++;
        });
        
        stats.scoresMedio = produtos.length > 0 ? Math.round(somaScores / produtos.length) : 0;
        stats.taxaAprovacao = produtos.length > 0 ? 
            Math.round((stats.produtosAprovados / produtos.length) * 100) : 0;
        
        return {
            ...stats,
            bancoInfo: banco.stats
        };
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:', error.message);
        return { erro: error.message };
    }
}
