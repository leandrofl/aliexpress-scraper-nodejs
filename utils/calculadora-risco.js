/**
 * @fileoverview Calculadora de risco para produtos
 * @description Implementa a lógica de score de risco sugerida pelo ChatGPT
 * 
 * @author Sistema de Scraping AliExpress - Risk Calculator v1.0
 */

/**
 * Calcula o score de risco de um produto (0-100)
 * Baseado nas sugestões do ChatGPT + melhorias semânticas
 * 
 * @param {Object} produto - Dados do produto
 * @returns {Object} { riscoFinal, pendenteRevisao, detalhesRisco }
 */
export function calcularRiscoProduto(produto) {
    let risco = 0;
    const detalhes = [];

    // Critério 1: Imagem não comparada (+40 pontos)
    if (!produto.imagem_comparada || !produto.imagem_match) {
        risco += 40;
        detalhes.push('Imagem não comparada ou sem match (+40)');
    }

    // Critério 2: Score semântico/textual baixo (+30 pontos)
    const scoreSemantico = produto.score_semantico || produto.score_texto || 0;
    if (scoreSemantico < 60) {
        risco += 30;
        detalhes.push(`Score semântico baixo: ${scoreSemantico}% (+30)`);
    } else if (scoreSemantico < 75) {
        risco += 15;
        detalhes.push(`Score semântico médio: ${scoreSemantico}% (+15)`);
    }

    // Critério 3: Desvio de preço alto (+20 pontos) - ChatGPT
    const desvioPreco = produto.desvio_preco || 0;
    if (desvioPreco > 250) {
        risco += 20;
        detalhes.push(`Desvio preço muito alto: ${desvioPreco}% (+20)`);
    } else if (desvioPreco > 200) {
        risco += 10;
        detalhes.push(`Desvio preço alto: ${desvioPreco}% (+10)`);
    }

    // Critério 4: Margem de lucro baixa (+10 pontos) - ChatGPT
    const margemLucro = produto.margem_lucro_rs || 0;
    if (margemLucro < 50) {
        risco += 10;
        detalhes.push(`Margem lucro baixa: R$ ${margemLucro} (+10)`);
    }

    // Critério 5: Categoria sensível (+10 pontos)
    const categoriasSensiveis = ['eletrônicos', 'tecnologia', 'celulares', 'computadores'];
    if (categoriasSensiveis.some(cat => 
        produto.categoria?.toLowerCase().includes(cat)
    )) {
        risco += 10;
        detalhes.push('Categoria sensível (+10)');
    }

    // Critério 6: Erro na análise de imagem (+15 pontos)
    if (produto.imagem_erro) {
        risco += 15;
        detalhes.push(`Erro imagem: ${produto.imagem_erro} (+15)`);
    }

    // Critério 7: Score total do produto baixo (+15 pontos)
    const scoreTotal = produto.score_total || 0;
    if (scoreTotal < 50) {
        risco += 15;
        detalhes.push(`Score produto baixo: ${scoreTotal} (+15)`);
    }

    // Critério 8: Método de análise de baixa confiança (+10 pontos)
    if (produto.metodo_analise_titulo === 'textual_fallback') {
        risco += 10;
        detalhes.push('Análise por fallback textual (+10)');
    }

    // Limitar a 100
    risco = Math.min(risco, 100);

    // Determinar se precisa de revisão manual (ChatGPT)
    const pendenteRevisao = risco >= 50 || 
                           (produto.aprovado_fallback_texto && scoreSemantico < 70) ||
                           (desvioPreco > 300) || // Desvio muito suspeito
                           (margemLucro > 1000); // Margem suspeita

    return {
        riscoFinal: risco,
        pendenteRevisao,
        detalhesRisco: detalhes,
        classificacaoRisco: risco >= 70 ? 'ALTO' : risco >= 40 ? 'MÉDIO' : 'BAIXO'
    };
}

/**
 * Determina o método de validação usado
 * 
 * @param {Object} produto - Dados do produto
 * @returns {string} 'imagem', 'texto', ou 'nenhum'
 */
export function determinarMetodoValidacao(produto) {
    if (produto.imagem_match && produto.score_imagem > 70) {
        return 'imagem';
    }
    
    if (produto.match_por_texto && produto.score_texto > 60) {
        return 'texto';
    }
    
    return 'nenhum';
}

/**
 * Sugere se o produto deve ser limitado apenas para revisão em certas categorias
 * 
 * @param {Object} produto - Dados do produto
 * @returns {boolean} Se deve permitir fallback textual
 */
export function permiteValidacaoTextual(produto) {
    const categoriasSensiveis = [
        'eletrônicos',
        'tecnologia', 
        'celulares',
        'computadores',
        'smartphones'
    ];
    
    const categoria = produto.categoria?.toLowerCase() || '';
    
    // Não permitir fallback textual em categorias muito sensíveis
    const isCategoriaProibida = categoriasSensiveis.some(cat => 
        categoria.includes(cat)
    );
    
    if (isCategoriaProibida) {
        return false;
    }
    
    // Permitir fallback para categorias seguras
    const categoriasSeguras = [
        'casa',
        'jardim',
        'cozinha',
        'decoração',
        'brinquedos',
        'esportes',
        'roupas'
    ];
    
    return categoriasSeguras.some(cat => categoria.includes(cat));
}

/**
 * Gera relatório de risco do produto
 * 
 * @param {Object} produto - Dados do produto
 * @returns {Object} Relatório completo
 */
export function gerarRelatorioRisco(produto) {
    const analiseRisco = calcularRiscoProduto(produto);
    const metodoValidacao = determinarMetodoValidacao(produto);
    const permiteTexto = permiteValidacaoTextual(produto);
    
    return {
        produto: {
            nome: produto.nome || produto.nome_traduzido,
            categoria: produto.categoria,
            preco: produto.preco_aliexpress
        },
        risco: analiseRisco,
        validacao: {
            metodo: metodoValidacao,
            permiteTextual: permiteTexto,
            scoreImagem: produto.score_imagem || 0,
            scoreTexto: produto.score_texto || 0
        },
        recomendacao: analiseRisco.riscoFinal >= 70 
            ? 'REJEITAR - Risco muito alto'
            : analiseRisco.pendenteRevisao 
            ? 'REVISAR MANUALMENTE' 
            : 'APROVAR AUTOMATICAMENTE'
    };
}
