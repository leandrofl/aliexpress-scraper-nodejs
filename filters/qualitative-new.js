/**
 * FILTROS QUALITATIVOS MELHORADOS - 🧪 Melhoria 4: Ativado automaticamente
 * Sistema inteligente com análise básica sempre ativa
 */

import { OPENAI_API_KEY } from '../config.js';

/**
 * Aplica filtros qualitativos usando AI ou análise básica
 */
export async function applyQualitativeFilter(produto) {
  // 🧪 Melhoria 4: Sempre executar análise qualitativa
  try {
    // Se não tiver API key, usar análise básica (sempre funcional)
    if (!OPENAI_API_KEY) {
      return applyBasicQualitativeFilter(produto);
    }

    // Tentar análise com OpenAI, fallback para básica
    const prompt = criarPromptAnalise(produto);
    const analise = await analisarComOpenAI(prompt);
    
    return {
      resolveProblemaEscalavel: analise.resolveProblema ? "Sim" : "Não",
      propostaUnica: analise.propostaUnica ? "Sim" : "Não",
      fornecedorConfiavel: analise.fornecedorConfiavel ? "Sim" : "Não",
      potencialMercado: analise.potencialMercado ? "Alto" : "Baixo",
      riscosIdentificados: analise.riscos || [],
      aprovado: analise.recomendacao,
      justificativa: analise.justificativa,
      scoreQualitativo: analise.score,
      fonte: 'OpenAI'
    };
  } catch (error) {
    console.log('⚠️ Erro na análise AI, usando filtros básicos:', error.message);
    return applyBasicQualitativeFilter(produto);
  }
}

/**
 * Filtros qualitativos básicos (sem AI) - 🧪 Melhoria 4: Ativado automaticamente
 */
function applyBasicQualitativeFilter(produto) {
  const nome = (produto.nome || '').toLowerCase();
  
  // Análise básica por palavras-chave
  const indicadoresPositivos = [
    'premium', 'professional', 'smart', 'wireless', 'bluetooth',
    'stainless', 'waterproof', 'durable', 'portable', 'rechargeable',
    'led', 'rgb', 'gaming', 'fitness', 'outdoor', 'kitchen'
  ];
  
  const indicadoresNegativos = [
    'cheap', 'fake', 'copy', 'imitation', 'broken', 'used',
    'defective', 'damaged', 'low quality', 'counterfeit'
  ];
  
  // Calcular pontuações
  const scorePositivo = indicadoresPositivos.filter(ind => nome.includes(ind)).length;
  const scoreNegativo = indicadoresNegativos.filter(ind => nome.includes(ind)).length;
  const scoreVendas = produto.vendas ? Math.min(produto.vendas / 1000, 5) : 0;
  const scoreRating = produto.rating ? produto.rating : 0;
  
  const scoreTotal = scorePositivo + scoreVendas + scoreRating - scoreNegativo;
  const aprovado = scoreTotal >= 3;
  
  return {
    resolveProblemaEscalavel: scorePositivo > 0 ? "Potencial" : "Não avaliado",
    propostaUnica: scorePositivo >= 2 ? "Possui diferenciais" : "Produto comum",
    fornecedorConfiavel: scoreRating >= 4 ? "Confiável" : "Verificar",
    potencialMercado: scoreVendas >= 2 ? "Alto" : "Médio",
    riscosIdentificados: scoreNegativo > 0 ? ["Indicadores negativos detectados"] : [],
    aprovado: aprovado,
    justificativa: `Score: ${scoreTotal.toFixed(1)} (Positivos: ${scorePositivo}, Vendas: ${scoreVendas.toFixed(1)}, Rating: ${scoreRating}, Negativos: ${scoreNegativo})`,
    scoreQualitativo: Math.round((scoreTotal / 10) * 100),
    fonte: 'Análise Básica Automatizada'
  };
}

/**
 * Criar prompt para análise OpenAI
 */
function criarPromptAnalise(produto) {
  return `Analise este produto do AliExpress para dropshipping/revenda:

PRODUTO: ${produto.nome}
CATEGORIA: ${produto.categoria}
PREÇO: ${produto.preco || 'N/A'}
VENDAS: ${produto.vendas}
AVALIAÇÕES: ${produto.reviews}
NOTA: ${produto.rating}/5.0

Avalie os seguintes critérios (responda em JSON):

{
  "resolveProblema": boolean,
  "propostaUnica": boolean,
  "fornecedorConfiavel": boolean,
  "potencialMercado": boolean,
  "riscos": ["lista", "de", "riscos"],
  "recomendacao": boolean,
  "justificativa": "Explicação da decisão em 1-2 frases",
  "score": number
}`;
}

/**
 * Análise com OpenAI (placeholder para implementação futura)
 */
async function analisarComOpenAI(prompt) {
  // TODO: Implementar integração com OpenAI
  throw new Error('OpenAI não configurado');
}
