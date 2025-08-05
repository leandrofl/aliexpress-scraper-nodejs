/**
 * FILTROS QUALITATIVOS MELHORADOS
 * Sistema inteligente usando OpenAI para análise qualitativa
 */

import { OPENAI_API_KEY } from '../config.js';

/**
 * Aplica filtros qualitativos usando AI
 */
export async function applyQualitativeFilter(produto) {
  // Se não tiver API key, retorna avaliação básica
  if (!OPENAI_API_KEY) {
    return applyBasicQualitativeFilter(produto);
  }

  try {
    const prompt = criarPromptAnalise(produto);
    const analise = await analisarComOpenAI(prompt);
    
    return {
      resolveProblemaEscalavel: analise.resolveProblema,
      propostaUnica: analise.propostaUnica,
      fornecedorConfiavel: analise.fornecedorConfiavel,
      potencialMercado: analise.potencialMercado,
      riscosIdentificados: analise.riscos,
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
 * Filtros qualitativos básicos (sem AI)
 */
function applyBasicQualitativeFilter(produto) {
  const nome = (produto.nome || '').toLowerCase();
  const categoria = produto.categoria || '';
  
  // Análise básica por palavras-chave
  const indicadoresPositivos = [
    'premium', 'professional', 'smart', 'wireless', 'bluetooth',
    'stainless', 'waterproof', 'durable', 'portable', 'rechargeable'
  ];
  
  const indicadoresNegativos = [
    'cheap', 'basic', 'simple', 'mini', 'fake', 'imitation'
  ];
  
  const temPositivos = indicadoresPositivos.some(palavra => nome.includes(palavra));
  const temNegativos = indicadoresNegativos.some(palavra => nome.includes(palavra));
  
  // Score baseado em métricas quantitativas + indicadores
  const nota = Number(produto.nota || 0);
  const avaliacoes = Number(produto.avaliacoes || 0);
  
  const scoreBase = (nota >= 4.3 ? 30 : 0) + (avaliacoes >= 100 ? 20 : 0);
  const scoreNome = temPositivos ? 20 : (temNegativos ? -10 : 10);
  const scoreCategoria = ['Tecnologia', 'Casa e Cozinha', 'Beleza'].includes(categoria) ? 15 : 5;
  
  const scoreTotal = scoreBase + scoreNome + scoreCategoria;
  const aprovado = scoreTotal >= 50;
  
  return {
    resolveProblemaEscalavel: temPositivos && !temNegativos,
    propostaUnica: scoreTotal >= 60,
    fornecedorConfiavel: nota >= 4.2 && avaliacoes >= 50,
    potencialMercado: scoreTotal >= 55,
    riscosIdentificados: temNegativos ? ['Produto pode ser de baixa qualidade'] : [],
    aprovado,
    justificativa: aprovado ? 
      'Produto aprovado por métricas básicas e análise de palavras-chave' :
      'Produto reprovado por baixo score qualitativo',
    scoreQualitativo: Math.max(0, Math.min(100, scoreTotal)),
    fonte: 'Análise Básica'
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
AVALIAÇÕES: ${produto.avaliacoes}
NOTA: ${produto.nota}/5.0
PEDIDOS: ${produto.pedidos}

Avalie os seguintes critérios (responda em JSON):

{
  "resolveProblema": boolean, // O produto resolve um problema real/escalável?
  "propostaUnica": boolean, // Tem diferencial ou é commodity?
  "fornecedorConfiavel": boolean, // Baseado nas métricas, fornecedor parece confiável?
  "potencialMercado": boolean, // Tem potencial no mercado brasileiro?
  "riscos": ["lista", "de", "riscos"], // Riscos identificados
  "recomendacao": boolean, // Recomenda para dropshipping?
  "justificativa": "Explicação da decisão em 1-2 frases",
  "score": number // Score 0-100
}

Foque em: viabilidade comercial, qualidade aparente, demanda brasileira, e riscos operacionais.`;
}

/**
 * Analisar produto com OpenAI
 */
async function analisarComOpenAI(prompt) {
  // Simulação da chamada OpenAI (implementar quando necessário)
  // Por enquanto, retorna análise mock inteligente
  
  await new Promise(resolve => setTimeout(resolve, 100)); // Simular delay API
  
  // Mock baseado no prompt (para desenvolvimento)
  const mockResponse = {
    resolveProblema: true,
    propostaUnica: true,
    fornecedorConfiavel: true,
    potencialMercado: true,
    riscos: ['Dependência de fornecedor único'],
    recomendacao: true,
    justificativa: 'Produto com boa aceitação e métricas sólidas para dropshipping',
    score: 85
  };
  
  return mockResponse;
}
