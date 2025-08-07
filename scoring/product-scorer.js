/**
 * @fileoverview Sistema de pontuação agregada para produtos
 * @description Calcula score total baseado em múltiplos critérios para ordenação final
 * 
 * @author Sistema de Scraping AliExpress - Product Scorer v1.0
 * @version 1.0.0 - Sistema de pontuação inteligente
 * @since 2024-01-01
 */

/**
 * Calcula o score total de um produto baseado em múltiplos critérios
 * @param {Object} produto - Produto com todos os dados processados
 * @returns {Object} Score detalhado e total
 */
export function calcularScoreTotal(produto) {
    const scores = {
        quantitativo: 0,
        qualitativo: 0,
        margem: 0,
        similaridade: 0,
        total: 0,
        categoria: 'bronze' // bronze, prata, ouro, diamante
    };

    try {
        // 📊 Score Quantitativo (0-25 pontos)
        if (produto.aprovadoQuantitativo) {
            scores.quantitativo = 25;
        } else {
            // Pontuação parcial baseada nos filtros individuais
            let pontosParciais = 0;
            if (produto.filtros?.preco?.aprovado) pontosParciais += 5;
            if (produto.filtros?.vendas?.aprovado) pontosParciais += 5;
            if (produto.filtros?.avaliacoes?.aprovado) pontosParciais += 5;
            if (produto.filtros?.frete?.aprovado) pontosParciais += 5;
            if (produto.filtros?.envio?.aprovado) pontosParciais += 5;
            scores.quantitativo = pontosParciais;
        }

        // 🎨 Score Qualitativo (0-25 pontos)
        if (produto.qualitativeScore?.score) {
            scores.qualitativo = Math.round((produto.qualitativeScore.score / 100) * 25);
        } else if (produto.aprovadoQualitativo) {
            scores.qualitativo = 20; // Valor padrão se aprovado mas sem score
        }

        // 💰 Score de Margem (0-30 pontos)
        if (produto.analiseMargem?.recomendacao?.viavel) {
            const margem = produto.analiseMargem.analise?.margemCalculada || 0;
            if (margem >= 300) scores.margem = 30; // Margem excelente (300%+)
            else if (margem >= 200) scores.margem = 25; // Margem ótima (200-299%)
            else if (margem >= 150) scores.margem = 20; // Margem boa (150-199%)
            else if (margem >= 100) scores.margem = 15; // Margem aceitável (100-149%)
            else if (margem >= 50) scores.margem = 10; // Margem baixa (50-99%)
            else scores.margem = 5; // Margem muito baixa
        }

        // 🖼 Score de Similaridade Visual (0-20 pontos)
        if (produto.dadosMercadoLivre?.melhorMatch?.similaridade) {
            const sim = produto.dadosMercadoLivre.melhorMatch.similaridade;
            scores.similaridade = Math.round((sim / 100) * 20);
        } else if (produto.dadosMercadoLivre?.encontrouProdutos) {
            scores.similaridade = 10; // Encontrou produtos mas sem similaridade
        }

        // 🎯 Score Total (0-100)
        scores.total = scores.quantitativo + scores.qualitativo + scores.margem + scores.similaridade;

        // 🏆 Categorização por Score
        if (scores.total >= 85) scores.categoria = 'diamante';
        else if (scores.total >= 70) scores.categoria = 'ouro';
        else if (scores.total >= 50) scores.categoria = 'prata';
        else scores.categoria = 'bronze';

        // 📋 Adicionar informações detalhadas
        scores.detalhes = {
            breakdown: `Quant:${scores.quantitativo} + Qual:${scores.qualitativo} + Margem:${scores.margem} + Visual:${scores.similaridade} = ${scores.total}`,
            categoria: scores.categoria,
            recomendacao: obterRecomendacao(scores.total, scores.categoria)
        };

        return scores;

    } catch (error) {
        console.error('❌ Erro ao calcular score do produto:', error.message);
        return {
            quantitativo: 0,
            qualitativo: 0,
            margem: 0,
            similaridade: 0,
            total: 0,
            categoria: 'bronze',
            erro: error.message
        };
    }
}

/**
 * Obter recomendação baseada no score
 * @param {number} scoreTotal - Score total do produto
 * @param {string} categoria - Categoria do produto
 * @returns {string} Recomendação de ação
 */
function obterRecomendacao(scoreTotal, categoria) {
    if (scoreTotal >= 85) {
        return '🎯 PRODUTO ESTRELA: Prioridade máxima para listagem!';
    } else if (scoreTotal >= 70) {
        return '⭐ PRODUTO PREMIUM: Excelente oportunidade de venda';
    } else if (scoreTotal >= 50) {
        return '✅ PRODUTO VIÁVEL: Boa opção para diversificar catálogo';
    } else if (scoreTotal >= 30) {
        return '⚠️ PRODUTO MÉDIO: Considerar apenas se faltam opções';
    } else {
        return '❌ PRODUTO FRACO: Não recomendado para listagem';
    }
}

/**
 * Ordenar produtos por score total (decrescente)
 * @param {Array} produtos - Array de produtos com scores
 * @returns {Array} Produtos ordenados por score
 */
export function ordenarPorScore(produtos) {
    return produtos.sort((a, b) => {
        // Primeiro por score total
        const scoreDiff = (b.scoreTotal?.total || 0) - (a.scoreTotal?.total || 0);
        if (scoreDiff !== 0) return scoreDiff;
        
        // Em caso de empate, usar margem como desempate
        const margemA = a.analiseMargem?.analise?.margemCalculada || 0;
        const margemB = b.analiseMargem?.analise?.margemCalculada || 0;
        return margemB - margemA;
    });
}

/**
 * Filtrar produtos por categoria de score mínimo
 * @param {Array} produtos - Array de produtos
 * @param {string} categoriaMinima - Categoria mínima ('bronze', 'prata', 'ouro', 'diamante')
 * @returns {Array} Produtos filtrados
 */
export function filtrarPorCategoria(produtos, categoriaMinima = 'bronze') {
    const niveis = { bronze: 0, prata: 1, ouro: 2, diamante: 3 };
    const nivelMinimo = niveis[categoriaMinima] || 0;
    
    return produtos.filter(produto => {
        const nivelProduto = niveis[produto.scoreTotal?.categoria] || 0;
        return nivelProduto >= nivelMinimo;
    });
}

/**
 * Gerar relatório de distribuição de scores
 * @param {Array} produtos - Array de produtos com scores
 * @returns {Object} Relatório estatístico
 */
export function gerarRelatorioScores(produtos) {
    const stats = {
        total: produtos.length,
        diamante: 0,
        ouro: 0,
        prata: 0,
        bronze: 0,
        scoresMedios: {},
        topProdutos: []
    };

    let somaTotalScores = 0;

    produtos.forEach(produto => {
        const categoria = produto.scoreTotal?.categoria || 'bronze';
        const score = produto.scoreTotal?.total || 0;
        
        stats[categoria]++;
        somaTotalScores += score;
    });

    stats.scoresMedios = {
        geral: Math.round(somaTotalScores / produtos.length),
        diamante: Math.round(
            produtos.filter(p => p.scoreTotal?.categoria === 'diamante')
                   .reduce((sum, p) => sum + (p.scoreTotal?.total || 0), 0) /
            Math.max(stats.diamante, 1)
        ),
        ouro: Math.round(
            produtos.filter(p => p.scoreTotal?.categoria === 'ouro')
                   .reduce((sum, p) => sum + (p.scoreTotal?.total || 0), 0) /
            Math.max(stats.ouro, 1)
        )
    };

    // Top 5 produtos por score
    stats.topProdutos = ordenarPorScore([...produtos])
        .slice(0, 5)
        .map(p => ({
            id: p.product_id,
            nome: p.nome?.substring(0, 50) + '...',
            score: p.scoreTotal?.total || 0,
            categoria: p.scoreTotal?.categoria || 'bronze'
        }));

    return stats;
}
