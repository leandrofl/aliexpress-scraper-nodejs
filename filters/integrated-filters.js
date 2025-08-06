/**
 * @fileoverview Sistema Integrado de Filtros para Produtos AliExpress
 * @description Módulo principal que combina filtros quantitativos, qualitativos e validação de margem
 * em um sistema robusto de avaliação de produtos para identificar oportunidades comerciais viáveis.
 * 
 * O sistema utiliza uma abordagem em camadas:
 * 1. Filtros Quantitativos: Métricas numéricas (preço, avaliações, vendas)
 * 2. Filtros Qualitativos: Análise de qualidade e confiabilidade
 * 3. Validação de Margem: Cálculo de viabilidade financeira
 * 
 * @author Sistema de Scraping AliExpress
 * @version 2.0.0
 * @since 2024-01-01
 */

import { applyQuantitativeFilter } from './quantitative.js';
import { applyQualitativeFilter } from './qualitative.js';
import { validarMargemOtimizada } from '../marginValidation/margin-validator.js';
import { logInfo, logErro, logSucesso } from '../scraper/utils.js';

/**
 * Configurações do sistema de filtros integrados
 */
const CONFIG_FILTROS = {
  pesos: {
    quantitativo: 0.3,  // 30% - Métricas de performance
    qualitativo: 0.3,   // 30% - Qualidade e confiabilidade  
    margem: 0.4         // 40% - Viabilidade financeira (mais importante)
  },
  thresholds: {
    scoreMinimo: 70,           // Score mínimo para aprovação
    margemMinimaRealista: 15,  // Margem mínima realista (%)
    criteriosMinimos: 3        // Número mínimo de critérios a atender
  },
  processamento: {
    maxConcorrente: 3,    // Máximo de produtos processados simultaneamente
    delayEntreLotes: 500  // Delay entre lotes (ms)
  }
};

/**
 * Aplica sistema completo de filtros integrados para um produto
 * @description Executa análise completa em 3 camadas com tratamento robusto de exceções
 * 
 * @param {Object} produto - Dados do produto para análise
 * @param {string} produto.nome - Nome do produto
 * @param {string} produto.categoria - Categoria do produto
 * @param {number} produto.preco - Preço do produto
 * @param {string} produto.url - URL do produto
 * @param {Object} [opcoes={}] - Opções de configuração
 * @param {boolean} [opcoes.forcarTodosFiltros=false] - Se deve executar todos os filtros mesmo se um falhar
 * @param {boolean} [opcoes.logDetalhado=false] - Se deve fazer log detalhado do processo
 * 
 * @returns {Promise<Object>} Resultado completo da análise integrada
 * @throws {Error} Em caso de erro crítico na análise
 * 
 * @example
 * const resultado = await applyIntegratedFilters({
 *   nome: "Smartphone XYZ",
 *   categoria: "Eletrônicos",
 *   preco: 299.99,
 *   url: "https://..."
 * });
 * 
 * if (resultado.aprovacao.aprovado) {
 *   console.log(`Produto aprovado com score ${resultado.aprovacao.scoreFinal}`);
 * }
 */
export async function applyIntegratedFilters(produto, opcoes = {}, browser = null) {
  const configuracao = {
    forcarTodosFiltros: false,
    logDetalhado: false,
    ...opcoes
  };
  
  // Inicializar estrutura de resultado
  const resultado = {
    produto: {
      nome: produto?.nome || 'Nome não informado',
      categoria: produto?.categoria || 'Categoria não informada',
      preco: produto?.preco || 0,
      url: produto?.url || 'URL não informada'
    },
    filtros: {
      quantitativo: null,
      qualitativo: null,
      margem: null
    },
    aprovacao: null,
    timestamp: new Date().toISOString(),
    tempoProcessamento: 0,
    erros: []
  };
  
  const inicioProcessamento = Date.now();
  
  try {
    // Validação inicial dos dados do produto
    if (!produto || typeof produto !== 'object') {
      throw new Error('Dados do produto inválidos ou não fornecidos');
    }
    
    if (!produto.nome || typeof produto.nome !== 'string') {
      throw new Error('Nome do produto é obrigatório e deve ser uma string');
    }
    
    if (typeof produto.preco !== 'number' || produto.preco <= 0) {
      throw new Error(`Preço do produto inválido: ${produto.preco}`);
    }
    
    if (configuracao.logDetalhado) {
      logInfo(`🔍 Iniciando análise integrada: ${produto.nome}`);
      logInfo(`💰 Preço: R$ ${produto.preco.toFixed(2)}`);
      logInfo(`🏷️ Categoria: ${produto.categoria}`);
    }
    
    // === FASE 1: FILTROS QUANTITATIVOS ===
    let resultQuantitativo = null;
    try {
      logInfo(`📊 Fase 1/3: Aplicando filtros quantitativos...`);
      resultQuantitativo = applyQuantitativeFilter(produto);
      
      if (resultQuantitativo) {
        resultado.filtros.quantitativo = resultQuantitativo;
        
        if (configuracao.logDetalhado) {
          logInfo(`📈 Score quantitativo: ${resultQuantitativo.scoreFinal || 0}`);
          logInfo(`✓ Aprovado quantitativamente: ${resultQuantitativo.aprovado ? 'SIM' : 'NÃO'}`);
        }
      } else {
        throw new Error('Filtro quantitativo retornou resultado nulo');
      }
      
    } catch (errorQuantitativo) {
      const mensagemErro = `Erro nos filtros quantitativos: ${errorQuantitativo.message}`;
      logErro(mensagemErro, errorQuantitativo);
      resultado.erros.push({
        fase: 'quantitativo',
        erro: mensagemErro,
        timestamp: new Date().toISOString()
      });
      
      if (!configuracao.forcarTodosFiltros) {
        throw new Error(`Falha crítica na fase quantitativa: ${errorQuantitativo.message}`);
      }
    }
    
    // === FASE 2: FILTROS QUALITATIVOS ===
    let resultQualitativo = null;
    const deveExecutarQualitativo = configuracao.forcarTodosFiltros || 
      (resultQuantitativo?.aprovado || (resultQuantitativo?.scoreFinal || 0) >= 60);
    
    if (deveExecutarQualitativo) {
      try {
        logInfo(`🎯 Fase 2/3: Aplicando filtros qualitativos...`);
        resultQualitativo = await applyQualitativeFilter(produto);
        
        if (resultQualitativo) {
          resultado.filtros.qualitativo = resultQualitativo;
          
          if (configuracao.logDetalhado) {
            logInfo(`🏆 Score qualitativo: ${resultQualitativo.scoreQualitativo || 0}`);
            logInfo(`✓ Aprovado qualitativamente: ${resultQualitativo.aprovado ? 'SIM' : 'NÃO'}`);
          }
        }
        
      } catch (errorQualitativo) {
        const mensagemErro = `Erro nos filtros qualitativos: ${errorQualitativo.message}`;
        logErro(mensagemErro, errorQualitativo);
        resultado.erros.push({
          fase: 'qualitativo',
          erro: mensagemErro,
          timestamp: new Date().toISOString()
        });
        
        if (!configuracao.forcarTodosFiltros) {
          console.warn(`⚠️ Continuando sem análise qualitativa devido ao erro`);
        }
      }
    } else {
      logInfo(`⏭️ Pulando filtros qualitativos (score quantitativo insuficiente: ${resultQuantitativo?.scoreFinal || 0})`);
    }
    
    // === FASE 3: VALIDAÇÃO DE MARGEM ===
    let resultMargem = null;
    const deveExecutarMargem = configuracao.forcarTodosFiltros || 
      (resultQuantitativo?.aprovado && (!resultQualitativo || resultQualitativo.aprovado !== false));
    
    if (deveExecutarMargem) {
      try {
        // Verificar se o browser foi fornecido para busca real no ML
        if (!browser) {
          logInfo(`⚠️ Browser não fornecido - usando dados simulados para margem`);
        }
        
        logInfo(`💰 Fase 3/3: Validando margem de lucro com dados ${browser ? 'reais do ML' : 'simulados'}...`);
        resultMargem = await validarMargemOtimizada(produto, browser);
        
        if (resultMargem) {
          resultado.filtros.margem = resultMargem;
          
          if (configuracao.logDetalhado && resultMargem.sucesso) {
            const margemRealista = resultMargem.analiseMargens?.realista?.margemPercentual || 0;
            logInfo(`💎 Margem realista: ${margemRealista.toFixed(1)}%`);
            logInfo(`✓ Margem viável: ${resultMargem.recomendacao?.viavel ? 'SIM' : 'NÃO'}`);
          }
        }
        
      } catch (errorMargem) {
        const mensagemErro = `Erro na validação de margem: ${errorMargem.message}`;
        logErro(mensagemErro, errorMargem);
        resultado.erros.push({
          fase: 'margem',
          erro: mensagemErro,
          timestamp: new Date().toISOString()
        });
        
        if (!configuracao.forcarTodosFiltros) {
          console.warn(`⚠️ Continuando sem validação de margem devido ao erro`);
        }
      }
    } else {
      logInfo(`⏭️ Pulando validação de margem (critérios prévios não atendidos)`);
    }
    
    // === CÁLCULO DA APROVAÇÃO FINAL ===
    try {
      logInfo(`🔄 Calculando aprovação final...`);
      resultado.aprovacao = calcularAprovacaoFinal(resultQuantitativo, resultQualitativo, resultMargem);
      
      if (resultado.aprovacao.aprovado) {
        logSucesso(`✅ PRODUTO APROVADO: ${produto.nome} (Score: ${resultado.aprovacao.scoreFinal})`);
      } else {
        logInfo(`❌ Produto reprovado: ${resultado.aprovacao.motivo}`);
      }
      
    } catch (errorAprovacao) {
      const mensagemErro = `Erro no cálculo de aprovação final: ${errorAprovacao.message}`;
      logErro(mensagemErro, errorAprovacao);
      
      // Fallback para aprovação
      resultado.aprovacao = {
        aprovado: false,
        motivo: 'Erro no cálculo de aprovação',
        scoreFinal: 0,
        nivel: 'Erro',
        erro: mensagemErro
      };
    }
    
    // Calcular tempo total de processamento
    resultado.tempoProcessamento = Date.now() - inicioProcessamento;
    
    if (configuracao.logDetalhado) {
      logInfo(`⏱️ Tempo de processamento: ${resultado.tempoProcessamento}ms`);
      logInfo(`📊 Resultado final: ${resultado.aprovacao.aprovado ? 'APROVADO' : 'REPROVADO'}`);
    }
    
    return resultado;
    
  } catch (error) {
    const tempoTotal = Date.now() - inicioProcessamento;
    const mensagemErro = `Erro crítico na análise integrada de "${produto?.nome || 'produto desconhecido'}": ${error.message}`;
    
    logErro(mensagemErro, error);
    
    // Retornar resultado com erro mas estrutura consistente
    return {
      ...resultado,
      aprovacao: {
        aprovado: false,
        motivo: 'Erro crítico na análise',
        scoreFinal: 0,
        nivel: 'Erro',
        erro: error.message
      },
      tempoProcessamento: tempoTotal,
      erros: [
        ...resultado.erros,
        {
          fase: 'geral',
          erro: mensagemErro,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      ]
    };
  }
}

/**
 * Calcula aprovação final baseada nos resultados de todos os filtros
 * @description Aplica algoritmo de scoring ponderado com múltiplos critérios de aprovação
 * 
 * @param {Object|null} quantitativo - Resultado dos filtros quantitativos
 * @param {Object|null} qualitativo - Resultado dos filtros qualitativos
 * @param {Object|null} margem - Resultado da validação de margem
 * @returns {Object} Objeto com decisão final e detalhes da análise
 * @throws {Error} Em caso de erro no cálculo
 * 
 * @example
 * const aprovacao = calcularAprovacaoFinal(
 *   { aprovado: true, scoreFinal: 85 },
 *   { aprovado: true, scoreQualitativo: 78 },
 *   { sucesso: true, recomendacao: { viavel: true, scoreViabilidade: 92 } }
 * );
 */
function calcularAprovacaoFinal(quantitativo, qualitativo, margem) {
  try {
    logInfo(`🧮 Calculando aprovação final com base nos filtros aplicados...`);
    
    // Extrair scores com valores padrão seguros
    const scores = {
      quantitativo: 0,
      qualitativo: 0,
      margem: 0
    };
    
    // Score quantitativo
    try {
      if (quantitativo && typeof quantitativo === 'object') {
        scores.quantitativo = Math.max(0, Math.min(100, quantitativo.scoreFinal || 0));
      }
    } catch (error) {
      logErro(`Erro ao extrair score quantitativo`, error);
    }
    
    // Score qualitativo
    try {
      if (qualitativo && typeof qualitativo === 'object') {
        scores.qualitativo = Math.max(0, Math.min(100, qualitativo.scoreQualitativo || 0));
      }
    } catch (error) {
      logErro(`Erro ao extrair score qualitativo`, error);
    }
    
    // Score de margem
    try {
      if (margem && typeof margem === 'object' && margem.sucesso) {
        scores.margem = Math.max(0, Math.min(100, margem.recomendacao?.scoreViabilidade || 0));
      }
    } catch (error) {
      logErro(`Erro ao extrair score de margem`, error);
    }
    
    // Calcular score ponderado final
    const pesos = CONFIG_FILTROS.pesos;
    let scoreFinal = 0;
    
    try {
      scoreFinal = (
        scores.quantitativo * pesos.quantitativo +
        scores.qualitativo * pesos.qualitativo +
        scores.margem * pesos.margem
      );
      
      // Garantir que o score está no range válido
      scoreFinal = Math.max(0, Math.min(100, scoreFinal));
      
    } catch (error) {
      logErro(`Erro no cálculo do score ponderado`, error);
      scoreFinal = 0;
    }
    
    // Avaliar critérios individuais de aprovação
    const criteriosAprovacao = {
      quantitativoOK: false,
      qualitativoOK: false,
      margemOK: false,
      scoreSuficiente: false
    };
    
    try {
      criteriosAprovacao.quantitativoOK = quantitativo?.aprovado === true;
      criteriosAprovacao.qualitativoOK = qualitativo?.aprovado !== false; // null é neutro
      criteriosAprovacao.margemOK = margem?.sucesso === true && margem?.recomendacao?.viavel === true;
      criteriosAprovacao.scoreSuficiente = scoreFinal >= CONFIG_FILTROS.thresholds.scoreMinimo;
    } catch (error) {
      logErro(`Erro na avaliação de critérios`, error);
    }
    
    // Contar quantos critérios foram atendidos
    const criteriosAtendidos = Object.values(criteriosAprovacao).filter(Boolean).length;
    
    // Lógica de aprovação: deve atender critérios mínimos E ter score suficiente
    const aprovado = criteriosAtendidos >= CONFIG_FILTROS.thresholds.criteriosMinimos && 
                     criteriosAprovacao.scoreSuficiente;
    
    // Determinar motivo da decisão
    let motivo = '';
    try {
      if (aprovado) {
        motivo = `Aprovado: ${criteriosAtendidos}/4 critérios atendidos com score ${Math.round(scoreFinal)}`;
      } else if (!criteriosAprovacao.quantitativoOK) {
        motivo = 'Reprovado: Não passou nos filtros quantitativos básicos';
      } else if (!criteriosAprovacao.margemOK) {
        motivo = 'Reprovado: Margem de lucro insuficiente ou inviável';
      } else if (!criteriosAprovacao.scoreSuficiente) {
        motivo = `Reprovado: Score insuficiente (${Math.round(scoreFinal)} < ${CONFIG_FILTROS.thresholds.scoreMinimo})`;
      } else {
        motivo = `Reprovado: Apenas ${criteriosAtendidos}/${CONFIG_FILTROS.thresholds.criteriosMinimos} critérios atendidos`;
      }
    } catch (error) {
      logErro(`Erro na determinação do motivo`, error);
      motivo = 'Erro na determinação do motivo de aprovação/reprovação';
    }
    
    // Classificar nível do produto
    let nivel = 'Não Classificado';
    try {
      nivel = classificarNivel(scoreFinal);
    } catch (error) {
      logErro(`Erro na classificação de nível`, error);
    }
    
    // Gerar recomendação específica
    let recomendacao = null;
    try {
      recomendacao = gerarRecomendacao(aprovado, scoreFinal, margem);
    } catch (error) {
      logErro(`Erro na geração de recomendação`, error);
      recomendacao = {
        acao: 'Erro na Análise',
        confianca: 'Baixa',
        observacoes: 'Erro ao gerar recomendação específica'
      };
    }
    
    // Logging detalhado dos resultados
    logInfo(`📊 Scores individuais: Q=${scores.quantitativo} | L=${scores.qualitativo} | M=${scores.margem}`);
    logInfo(`🎯 Score final ponderado: ${Math.round(scoreFinal)}`);
    logInfo(`✅ Critérios atendidos: ${criteriosAtendidos}/4`);
    logInfo(`🏆 Nível classificado: ${nivel}`);
    
    const resultado = {
      aprovado,
      motivo,
      scoreFinal: Math.round(scoreFinal),
      scores: scores,
      criterios: criteriosAprovacao,
      criteriosAtendidos,
      nivel,
      recomendacao,
      pesos: pesos,
      thresholds: CONFIG_FILTROS.thresholds,
      detalhesCalculo: {
        formulaScore: `(${scores.quantitativo} × ${pesos.quantitativo}) + (${scores.qualitativo} × ${pesos.qualitativo}) + (${scores.margem} × ${pesos.margem})`,
        resultadoFormula: scoreFinal.toFixed(2)
      }
    };
    
    return resultado;
    
  } catch (error) {
    logErro(`Erro crítico no cálculo de aprovação final`, error);
    
    // Retornar resultado de erro mas estruturado
    return {
      aprovado: false,
      motivo: `Erro no cálculo de aprovação: ${error.message}`,
      scoreFinal: 0,
      scores: { quantitativo: 0, qualitativo: 0, margem: 0 },
      criterios: { quantitativoOK: false, qualitativoOK: false, margemOK: false, scoreSuficiente: false },
      criteriosAtendidos: 0,
      nivel: 'Erro',
      recomendacao: {
        acao: 'Erro na Análise',
        confianca: 'Nenhuma',
        observacoes: 'Falha crítica no sistema de cálculo'
      },
      erro: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Classifica o nível de qualidade do produto baseado no score final
 * @description Sistema de classificação em 6 níveis para categorização de produtos
 * @param {number} score - Score final do produto (0-100)
 * @returns {string} Nível classificado do produto
 * @throws {Error} Em caso de score inválido
 * 
 * @example
 * classificarNivel(95); // "Premium"
 * classificarNivel(75); // "Bom"
 * classificarNivel(40); // "Inadequado"
 */
function classificarNivel(score) {
  try {
    // Validação do score
    if (typeof score !== 'number' || isNaN(score)) {
      console.warn(`⚠️ Score inválido para classificação: ${score}, usando 0`);
      score = 0;
    }
    
    // Garantir que score está no range válido
    score = Math.max(0, Math.min(100, score));
    
    // Sistema de classificação com thresholds claros
    if (score >= 90) return 'Premium';      // 90-100: Excelência absoluta
    if (score >= 80) return 'Excelente';    // 80-89:  Muito alta qualidade
    if (score >= 70) return 'Bom';          // 70-79:  Boa oportunidade
    if (score >= 60) return 'Regular';      // 60-69:  Aceitável com ressalvas
    if (score >= 50) return 'Marginal';     // 50-59:  Limítrofe, alto risco
    return 'Inadequado';                    // 0-49:   Não recomendado
    
  } catch (error) {
    logErro(`Erro na classificação de nível para score ${score}`, error);
    return 'Erro na Classificação';
  }
}

/**
 * Gera recomendação específica de ação baseada na análise completa
 * @description Cria recomendação contextualizada considerando score, margem e viabilidade
 * @param {boolean} aprovado - Se o produto foi aprovado
 * @param {number} score - Score final do produto
 * @param {Object|null} margem - Resultado da análise de margem
 * @returns {Object} Objeto com ação recomendada e detalhes
 * @throws {Error} Em caso de erro na geração da recomendação
 * 
 * @example
 * const rec = gerarRecomendacao(true, 85, { sucesso: true, analiseMargens: { realista: { margemPercentual: 25 } } });
 * // { acao: "Aprovação Recomendada", confianca: "Alta", observacoes: "..." }
 */
function gerarRecomendacao(aprovado, score, margem) {
  try {
    // Validação dos parâmetros
    if (typeof aprovado !== 'boolean') {
      console.warn(`⚠️ Status de aprovação inválido: ${aprovado}`);
      aprovado = false;
    }
    
    if (typeof score !== 'number' || isNaN(score)) {
      console.warn(`⚠️ Score inválido para recomendação: ${score}, usando 0`);
      score = 0;
    }
    
    // Se não foi aprovado, recomendação de rejeição
    if (!aprovado) {
      const motivoRejeicao = score < 50 ? 
        'Score muito baixo indicando produto inadequado' : 
        'Não atende aos critérios mínimos de aprovação';
        
      return {
        acao: 'Rejeitar Produto',
        confianca: 'Alta',
        observacoes: motivoRejeicao,
        proximosPassos: ['Buscar produtos similares com melhor performance', 'Revisar critérios de seleção'],
        riscos: ['Baixa margem de lucro', 'Possível baixa demanda', 'Concorrência desfavorável']
      };
    }
    
    // Extrair margem realista se disponível
    let margemRealista = 0;
    let margemDisponivel = false;
    
    try {
      if (margem?.sucesso && margem.analiseMargens?.realista?.margemPercentual) {
        margemRealista = margem.analiseMargens.realista.margemPercentual;
        margemDisponivel = true;
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao extrair margem realista: ${error.message}`);
    }
    
    // Recomendações baseadas em score e margem
    if (score >= 85 && margemRealista >= 30) {
      return {
        acao: 'Aprovação Imediata - Prioridade Alta',
        confianca: 'Muito Alta',
        observacoes: `Produto excepcional com ${margemRealista.toFixed(1)}% de margem realista`,
        proximosPassos: [
          'Proceder com importação imediatamente',
          'Considerar volumes maiores',
          'Monitorar concorrência de perto'
        ],
        oportunidades: [
          'Alta margem de lucro',
          'Excelente potencial de mercado',
          'Possível produto âncora'
        ]
      };
      
    } else if (score >= 75 && margemRealista >= 20) {
      return {
        acao: 'Aprovação Recomendada',
        confianca: 'Alta',
        observacoes: `Bom produto com ${margemRealista.toFixed(1)}% de margem realista`,
        proximosPassos: [
          'Fazer teste com lote menor',
          'Analisar tendências de mercado',
          'Definir estratégia de precificação'
        ],
        oportunidades: [
          'Margem satisfatória',
          'Bom equilíbrio risco/retorno',
          'Potencial de crescimento'
        ]
      };
      
    } else if (score >= 70 && margemRealista >= 15) {
      return {
        acao: 'Aprovação Condicional',
        confianca: 'Média',
        observacoes: `Produto aceitável com ${margemRealista.toFixed(1)}% de margem, requer monitoramento`,
        proximosPassos: [
          'Teste com volume mínimo',
          'Monitorar performance semanalmente',
          'Ter plano de saída definido'
        ],
        condicoes: [
          'Margem acima de 15% mantida',
          'Vendas consistentes por 30 dias',
          'Sem deterioração da concorrência'
        ]
      };
      
    } else if (score >= 70 && !margemDisponivel) {
      return {
        acao: 'Aprovação com Análise Adicional Necessária',
        confianca: 'Média',
        observacoes: 'Score satisfatório mas falta análise detalhada de margem',
        proximosPassos: [
          'Realizar análise completa de custos',
          'Validar margem com fornecedores',
          'Calcular ponto de equilíbrio'
        ],
        alertas: [
          'Margem não validada adequadamente',
          'Riscos financeiros não calculados'
        ]
      };
      
    } else {
      return {
        acao: 'Aprovação com Restrições',
        confianca: 'Baixa a Média',
        observacoes: 'Produto no limite dos critérios, alta atenção necessária',
        proximosPassos: [
          'Análise detalhada de riscos',
          'Teste com investimento mínimo',
          'Revisão semanal obrigatória'
        ],
        restricoes: [
          'Volume máximo limitado',
          'Margem mínima rigorosamente monitorada',
          'Prazo de avaliação de 15 dias'
        ]
      };
    }
    
  } catch (error) {
    logErro(`Erro na geração de recomendação`, error);
    
    // Fallback para recomendação segura
    return {
      acao: 'Análise Manual Necessária',
      confianca: 'Baixa',
      observacoes: 'Erro no sistema de recomendação automática',
      proximosPassos: ['Revisar dados manualmente', 'Consultar especialista'],
      erro: error.message
    };
  }
}

/**
 * Função auxiliar para cálculo de aprovação simplificada (para testes unitários)
 * @description Versão simplificada do cálculo de aprovação para validação e testes
 * @param {Object} scores - Scores individuais dos filtros
 * @param {number} scores.quantitativo - Score quantitativo (0-100)
 * @param {number} scores.qualitativo - Score qualitativo (0-100)
 * @param {number} scores.margem - Score de margem (0-100)
 * @returns {Object} Resultado simplificado da aprovação
 * @throws {Error} Em caso de scores inválidos
 * 
 * @example
 * const resultado = calcularAprovacaoFinalSimples({
 *   quantitativo: 80,
 *   qualitativo: 75,
 *   margem: 85
 * });
 */
export function calcularAprovacaoFinalSimples(scores) {
  try {
    // Validação dos scores
    if (!scores || typeof scores !== 'object') {
      throw new Error('Objeto de scores inválido ou não fornecido');
    }
    
    const scoresValidados = {
      quantitativo: Math.max(0, Math.min(100, scores.quantitativo || 0)),
      qualitativo: Math.max(0, Math.min(100, scores.qualitativo || 0)),
      margem: Math.max(0, Math.min(100, scores.margem || 0))
    };
    
    // Usar configuração global para pesos
    const pesos = CONFIG_FILTROS.pesos;
    const pesosPercentuais = {
      quantitativo: pesos.quantitativo * 100,
      qualitativo: pesos.qualitativo * 100,
      margem: pesos.margem * 100
    };
    
    // Calcular score total ponderado
    const scoreTotal = (
      (scoresValidados.quantitativo * pesos.quantitativo) +
      (scoresValidados.qualitativo * pesos.qualitativo) +
      (scoresValidados.margem * pesos.margem)
    );
    
    const aprovado = scoreTotal >= CONFIG_FILTROS.thresholds.scoreMinimo;
    
    return {
      scoreTotal: Math.round(scoreTotal * 100) / 100, // Arredondar para 2 casas decimais
      aprovado,
      pesos: pesosPercentuais,
      criterios: scoresValidados,
      threshold: CONFIG_FILTROS.thresholds.scoreMinimo,
      calculo: {
        formula: `(${scoresValidados.quantitativo} × ${pesos.quantitativo}) + (${scoresValidados.qualitativo} × ${pesos.qualitativo}) + (${scoresValidados.margem} × ${pesos.margem})`,
        resultado: scoreTotal
      }
    };
    
  } catch (error) {
    logErro(`Erro no cálculo de aprovação simplificada`, error);
    
    return {
      scoreTotal: 0,
      aprovado: false,
      erro: error.message,
      pesos: { quantitativo: 30, qualitativo: 30, margem: 40 },
      criterios: { quantitativo: 0, qualitativo: 0, margem: 0 }
    };
  }
}

/**
 * Processa lista de produtos com filtros integrados em lotes controlados
 * @description Aplica filtros integrados em múltiplos produtos com controle de concorrência
 * e relatório de progresso em tempo real
 * 
 * @param {Array} produtos - Array de produtos para processar
 * @param {Object} [opcoes={}] - Opções de processamento
 * @param {number} [opcoes.maxConcorrente=3] - Máximo de produtos processados simultaneamente
 * @param {number} [opcoes.delayEntreLotes=500] - Delay entre lotes em milissegundos
 * @param {boolean} [opcoes.continuarComErros=true] - Se deve continuar processamento mesmo com erros
 * @param {Function} [opcoes.callbackProgresso] - Callback para relatório de progresso
 * 
 * @returns {Promise<Array>} Array com resultados de todos os produtos processados
 * @throws {Error} Em caso de erro crítico no processamento
 * 
 * @example
 * const resultados = await processIntegratedFilters(listaProdutos, {
 *   maxConcorrente: 5,
 *   callbackProgresso: (progresso) => console.log(`${progresso.porcentagem}% concluído`)
 * });
 */
export async function processIntegratedFilters(produtos, opcoes = {}, browser = null) {
  const configuracao = {
    maxConcorrente: CONFIG_FILTROS.processamento.maxConcorrente,
    delayEntreLotes: CONFIG_FILTROS.processamento.delayEntreLotes,
    continuarComErros: true,
    callbackProgresso: null,
    logDetalhado: false,
    ...opcoes
  };
  
  try {
    // Validação de entrada
    if (!Array.isArray(produtos)) {
      throw new Error('Lista de produtos deve ser um array');
    }
    
    if (produtos.length === 0) {
      logInfo('📭 Lista de produtos vazia, nenhum processamento necessário');
      return [];
    }
    
    if (configuracao.maxConcorrente <= 0) {
      console.warn(`⚠️ maxConcorrente inválido (${configuracao.maxConcorrente}), usando valor padrão: 3`);
      configuracao.maxConcorrente = 3;
    }
    
    logInfo(`🚀 Iniciando processamento de ${produtos.length} produtos com filtros integrados...`);
    logInfo(`⚙️ Configuração: ${configuracao.maxConcorrente} produtos simultâneos, delay ${configuracao.delayEntreLotes}ms`);
    
    const resultados = [];
    const errosCriticos = [];
    const inicioProcessamento = Date.now();
    let produtosProcessados = 0;
    
    // Processar em lotes controlados
    for (let i = 0; i < produtos.length; i += configuracao.maxConcorrente) {
      const loteAtual = i / configuracao.maxConcorrente + 1;
      const totalLotes = Math.ceil(produtos.length / configuracao.maxConcorrente);
      
      logInfo(`📦 Processando lote ${loteAtual}/${totalLotes}...`);
      
      const lote = produtos.slice(i, i + configuracao.maxConcorrente);
      const inicioLote = Date.now();
      
      try {
        // Processar produtos do lote em paralelo
        const promessasLote = lote.map(async (produto, indexNoLote) => {
          const indexGlobal = i + indexNoLote;
          
          try {
            logInfo(`🔄 Processando ${indexGlobal + 1}/${produtos.length}: ${produto.nome || 'Produto sem nome'}`);
            
            const resultado = await applyIntegratedFilters(produto, {
              logDetalhado: configuracao.logDetalhado
            }, browser);
            
            // Adicionar metadados de processamento
            resultado.metadados = {
              indexOriginal: indexGlobal,
              lote: loteAtual,
              tempoProcessamento: resultado.tempoProcessamento || 0
            };
            
            return resultado;
            
          } catch (errorProduto) {
            const mensagemErro = `Erro ao processar produto ${indexGlobal + 1} (${produto.nome || 'sem nome'}): ${errorProduto.message}`;
            logErro(mensagemErro, errorProduto);
            
            errosCriticos.push({
              produto: produto.nome || `Produto ${indexGlobal + 1}`,
              index: indexGlobal,
              erro: errorProduto.message,
              timestamp: new Date().toISOString()
            });
            
            if (!configuracao.continuarComErros) {
              throw new Error(`Processamento interrompido: ${mensagemErro}`);
            }
            
            // Retornar resultado de erro estruturado
            return {
              produto: {
                nome: produto.nome || `Produto ${indexGlobal + 1}`,
                categoria: produto.categoria || 'Não informada',
                preco: produto.preco || 0,
                url: produto.url || ''
              },
              aprovacao: {
                aprovado: false,
                motivo: 'Erro no processamento',
                scoreFinal: 0,
                nivel: 'Erro'
              },
              erro: errorProduto.message,
              timestamp: new Date().toISOString(),
              metadados: {
                indexOriginal: indexGlobal,
                lote: loteAtual,
                processadoComErro: true
              }
            };
          }
        });
        
        // Aguardar conclusão do lote
        const resultadosLote = await Promise.all(promessasLote);
        resultados.push(...resultadosLote);
        produtosProcessados += lote.length;
        
        const tempoLote = Date.now() - inicioLote;
        const tempoMedioItem = Math.round(tempoLote / lote.length);
        
        logSucesso(`✅ Lote ${loteAtual} concluído em ${tempoLote}ms (${tempoMedioItem}ms/produto)`);
        
        // Callback de progresso se fornecido
        if (typeof configuracao.callbackProgresso === 'function') {
          try {
            configuracao.callbackProgresso({
              produtosProcessados,
              totalProdutos: produtos.length,
              porcentagem: Math.round((produtosProcessados / produtos.length) * 100),
              loteAtual,
              totalLotes,
              tempoDecorrido: Date.now() - inicioProcessamento,
              tempoMedioItem,
              errosCriticos: errosCriticos.length
            });
          } catch (callbackError) {
            logErro(`Erro no callback de progresso`, callbackError);
          }
        }
        
        // Delay entre lotes (exceto no último)
        if (i + configuracao.maxConcorrente < produtos.length) {
          await new Promise(resolve => setTimeout(resolve, configuracao.delayEntreLotes));
        }
        
      } catch (errorLote) {
        logErro(`Erro crítico no processamento do lote ${loteAtual}`, errorLote);
        
        if (!configuracao.continuarComErros) {
          throw new Error(`Processamento interrompido no lote ${loteAtual}: ${errorLote.message}`);
        }
      }
    }
    
    // Estatísticas finais
    const tempoTotal = Date.now() - inicioProcessamento;
    const tempoMedioProduto = Math.round(tempoTotal / produtos.length);
    const aprovados = resultados.filter(r => r.aprovacao?.aprovado).length;
    const taxaAprovacao = Math.round((aprovados / produtos.length) * 100);
    
    logSucesso(`🎉 Processamento concluído!`);
    logInfo(`📊 Estatísticas: ${produtos.length} produtos em ${tempoTotal}ms (${tempoMedioProduto}ms/produto)`);
    logInfo(`✅ Taxa de aprovação: ${aprovados}/${produtos.length} (${taxaAprovacao}%)`);
    
    if (errosCriticos.length > 0) {
      logErro(`⚠️ ${errosCriticos.length} produtos com erros críticos`);
    }
    
    return resultados;
    
  } catch (error) {
    const mensagemErro = `Erro crítico no processamento de filtros integrados: ${error.message}`;
    logErro(mensagemErro, error);
    
    // Se já temos alguns resultados, retorná-los com informação de erro
    if (resultados.length > 0) {
      logInfo(`📦 Retornando ${resultados.length} resultados parciais devido ao erro`);
      return resultados;
    }
    
    throw new Error(mensagemErro);
  }
}

/**
 * Gera relatório completo e detalhado dos resultados dos filtros integrados
 * @description Cria análise estatística abrangente dos resultados de processamento
 * incluindo distribuições, médias, tendências e recomendações estratégicas
 * 
 * @param {Array} resultados - Array com resultados dos filtros integrados
 * @param {Object} [opcoes={}] - Opções para geração do relatório
 * @param {boolean} [opcoes.incluirDetalhes=true] - Se deve incluir análises detalhadas
 * @param {boolean} [opcoes.incluirRecomendacoes=true] - Se deve incluir recomendações estratégicas
 * @param {number} [opcoes.topProdutos=10] - Quantos produtos destacar no top
 * 
 * @returns {Object} Relatório completo estruturado
 * @throws {Error} Em caso de erro na geração do relatório
 * 
 * @example
 * const relatorio = gerarRelatorioFiltros(resultados, {
 *   incluirDetalhes: true,
 *   topProdutos: 5
 * });
 * 
 * console.log(`Taxa de aprovação: ${relatorio.taxaAprovacao}%`);
 */
export function gerarRelatorioFiltros(resultados, opcoes = {}) {
  const configuracao = {
    incluirDetalhes: true,
    incluirRecomendacoes: true,
    topProdutos: 10,
    ...opcoes
  };
  
  try {
    // Validação de entrada
    if (!Array.isArray(resultados)) {
      throw new Error('Resultados devem ser fornecidos como array');
    }
    
    if (resultados.length === 0) {
      logInfo('📋 Gerando relatório para dataset vazio');
      return {
        estatisticas: {
          total: 0,
          aprovados: 0,
          reprovados: 0,
          comErros: 0
        },
        taxaAprovacao: 0,
        observacoes: 'Nenhum produto foi processado',
        dataRelatorio: new Date().toISOString()
      };
    }
    
    logInfo(`📊 Gerando relatório para ${resultados.length} produtos...`);
    
    // Inicializar estruturas de dados
    const stats = {
      total: resultados.length,
      aprovados: 0,
      reprovados: 0,
      comErros: 0,
      scoresMedios: {
        quantitativo: 0,
        qualitativo: 0,
        margem: 0,
        final: 0
      },
      niveisDistribuicao: {
        'Premium': 0,
        'Excelente': 0,
        'Bom': 0,
        'Regular': 0,
        'Marginal': 0,
        'Inadequado': 0,
        'Erro': 0
      },
      motivosReprovacao: {},
      margensMedias: {
        otimista: 0,
        realista: 0,
        conservadora: 0
      },
      temposProcessamento: {
        total: 0,
        medio: 0,
        minimo: Infinity,
        maximo: 0
      },
      categorias: {},
      faixasPreco: {
        'Até R$ 50': 0,
        'R$ 50-100': 0,
        'R$ 100-200': 0,
        'R$ 200-500': 0,
        'Acima R$ 500': 0
      }
    };
    
    const produtosComDados = [];
    const produtosComErro = [];
    
    // Processar cada resultado
    resultados.forEach((resultado, index) => {
      try {
        // Contadores básicos
        if (resultado.erro || resultado.aprovacao?.nivel === 'Erro') {
          stats.comErros++;
          produtosComErro.push({ ...resultado, indexOriginal: index });
        } else if (resultado.aprovacao?.aprovado) {
          stats.aprovados++;
        } else {
          stats.reprovados++;
        }
        
        // Níveis de distribuição
        const nivel = resultado.aprovacao?.nivel || 'Não Classificado';
        if (stats.niveisDistribuicao.hasOwnProperty(nivel)) {
          stats.niveisDistribuicao[nivel]++;
        } else {
          stats.niveisDistribuicao['Inadequado']++;
        }
        
        // Motivos de reprovação
        if (!resultado.aprovacao?.aprovado && resultado.aprovacao?.motivo) {
          const motivo = resultado.aprovacao.motivo;
          stats.motivosReprovacao[motivo] = (stats.motivosReprovacao[motivo] || 0) + 1;
        }
        
        // Scores (apenas se dados válidos)
        if (resultado.aprovacao?.scores && typeof resultado.aprovacao.scoreFinal === 'number') {
          Object.keys(stats.scoresMedios).forEach(key => {
            if (key === 'final') {
              stats.scoresMedios[key] += resultado.aprovacao.scoreFinal || 0;
            } else if (resultado.aprovacao.scores[key] !== undefined) {
              stats.scoresMedios[key] += resultado.aprovacao.scores[key] || 0;
            }
          });
        }
        
        // Margens (apenas se sucesso na validação)
        if (resultado.filtros?.margem?.sucesso && resultado.filtros.margem.analiseMargens) {
          const margens = resultado.filtros.margem.analiseMargens;
          if (margens.otimista?.margemPercentual) stats.margensMedias.otimista += margens.otimista.margemPercentual;
          if (margens.realista?.margemPercentual) stats.margensMedias.realista += margens.realista.margemPercentual;
          if (margens.conservadora?.margemPercentual) stats.margensMedias.conservadora += margens.conservadora.margemPercentual;
        }
        
        // Tempos de processamento
        if (typeof resultado.tempoProcessamento === 'number' && resultado.tempoProcessamento > 0) {
          stats.temposProcessamento.total += resultado.tempoProcessamento;
          stats.temposProcessamento.minimo = Math.min(stats.temposProcessamento.minimo, resultado.tempoProcessamento);
          stats.temposProcessamento.maximo = Math.max(stats.temposProcessamento.maximo, resultado.tempoProcessamento);
        }
        
        // Categorias
        const categoria = resultado.produto?.categoria || 'Não Classificada';
        stats.categorias[categoria] = (stats.categorias[categoria] || 0) + 1;
        
        // Faixas de preço
        const preco = resultado.produto?.preco || 0;
        if (preco <= 50) stats.faixasPreco['Até R$ 50']++;
        else if (preco <= 100) stats.faixasPreco['R$ 50-100']++;
        else if (preco <= 200) stats.faixasPreco['R$ 100-200']++;
        else if (preco <= 500) stats.faixasPreco['R$ 200-500']++;
        else stats.faixasPreco['Acima R$ 500']++;
        
        // Guardar produtos com dados válidos para análises adicionais
        if (!resultado.erro && resultado.aprovacao) {
          produtosComDados.push({ ...resultado, indexOriginal: index });
        }
        
      } catch (errorItem) {
        logErro(`Erro ao processar item ${index} do relatório`, errorItem);
        stats.comErros++;
      }
    });
    
    // Calcular médias (apenas se temos dados válidos)
    const produtosValidos = produtosComDados.length;
    if (produtosValidos > 0) {
      Object.keys(stats.scoresMedios).forEach(key => {
        stats.scoresMedios[key] = Math.round(stats.scoresMedios[key] / produtosValidos);
      });
      
      Object.keys(stats.margensMedias).forEach(key => {
        stats.margensMedias[key] = Math.round((stats.margensMedias[key] / produtosValidos) * 100) / 100;
      });
      
      stats.temposProcessamento.medio = Math.round(stats.temposProcessamento.total / produtosValidos);
    }
    
    // Ajustar mínimo se não houve dados
    if (stats.temposProcessamento.minimo === Infinity) {
      stats.temposProcessamento.minimo = 0;
    }
    
    // Calcular taxa de aprovação
    const taxaAprovacao = stats.total > 0 ? Math.round((stats.aprovados / stats.total) * 100) : 0;
    
    // Encontrar melhor produto
    let melhorProduto = null;
    if (produtosComDados.length > 0) {
      melhorProduto = produtosComDados
        .filter(r => r.aprovacao?.aprovado)
        .sort((a, b) => (b.aprovacao?.scoreFinal || 0) - (a.aprovacao?.scoreFinal || 0))[0] || null;
    }
    
    // Top produtos (se solicitado)
    let topProdutos = [];
    if (configuracao.incluirDetalhes && configuracao.topProdutos > 0) {
      topProdutos = produtosComDados
        .filter(r => r.aprovacao?.aprovado)
        .sort((a, b) => (b.aprovacao?.scoreFinal || 0) - (a.aprovacao?.scoreFinal || 0))
        .slice(0, configuracao.topProdutos)
        .map(produto => ({
          nome: produto.produto?.nome,
          categoria: produto.produto?.categoria,
          preco: produto.produto?.preco,
          scoreFinal: produto.aprovacao?.scoreFinal,
          nivel: produto.aprovacao?.nivel,
          margemRealista: produto.filtros?.margem?.analiseMargens?.realista?.margemPercentual || 0
        }));
    }
    
    // Análises adicionais (se solicitado)
    let analises = null;
    if (configuracao.incluirDetalhes) {
      analises = {
        categoriaMaisPromissora: Object.entries(stats.categorias)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A',
        faixaPrecoMaisComum: Object.entries(stats.faixasPreco)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A',
        principalMotivoReprovacao: Object.entries(stats.motivosReprovacao)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A',
        eficienciaProcessamento: {
          produtosPorSegundo: stats.temposProcessamento.medio > 0 ? 
            Math.round(1000 / stats.temposProcessamento.medio * 100) / 100 : 0,
          tempoTotalFormatado: `${Math.round(stats.temposProcessamento.total / 1000)}s`
        }
      };
    }
    
    // Recomendações estratégicas (se solicitado)
    let recomendacoes = null;
    if (configuracao.incluirRecomendacoes) {
      recomendacoes = gerarRecomendacoesEstrategicas(stats, taxaAprovacao, analises);
    }
    
    const relatorioFinal = {
      estatisticas: stats,
      taxaAprovacao,
      melhorProduto: melhorProduto ? {
        nome: melhorProduto.produto?.nome,
        categoria: melhorProduto.produto?.categoria,
        scoreFinal: melhorProduto.aprovacao?.scoreFinal,
        nivel: melhorProduto.aprovacao?.nivel
      } : null,
      topProdutos,
      analises,
      recomendacoes,
      erros: produtosComErro.length > 0 ? {
        quantidade: produtosComErro.length,
        exemplos: produtosComErro.slice(0, 3).map(p => ({
          nome: p.produto?.nome || 'Nome não disponível',
          erro: p.erro || p.aprovacao?.erro || 'Erro não especificado'
        }))
      } : null,
      dataRelatorio: new Date().toISOString(),
      versaoRelatorio: '2.0.0'
    };
    
    logSucesso(`✅ Relatório gerado com sucesso para ${stats.total} produtos`);
    logInfo(`📈 Taxa de aprovação: ${taxaAprovacao}% (${stats.aprovados}/${stats.total})`);
    
    return relatorioFinal;
    
  } catch (error) {
    logErro(`Erro na geração do relatório de filtros`, error);
    
    // Retornar relatório mínimo em caso de erro
    return {
      erro: error.message,
      estatisticas: {
        total: resultados?.length || 0,
        aprovados: 0,
        reprovados: 0,
        comErros: resultados?.length || 0
      },
      taxaAprovacao: 0,
      observacoes: 'Erro na geração do relatório completo',
      dataRelatorio: new Date().toISOString()
    };
  }
}

/**
 * Gera recomendações estratégicas baseadas nas estatísticas do relatório
 * @private
 * @param {Object} stats - Estatísticas compiladas
 * @param {number} taxaAprovacao - Taxa de aprovação percentual
 * @param {Object} analises - Análises adicionais
 * @returns {Object} Recomendações estratégicas estruturadas
 */
function gerarRecomendacoesEstrategicas(stats, taxaAprovacao, analises) {
  try {
    const recomendacoes = {
      prioridade: 'alta',
      acoes: [],
      alertas: [],
      oportunidades: []
    };
    
    // Análise da taxa de aprovação
    if (taxaAprovacao < 20) {
      recomendacoes.prioridade = 'crítica';
      recomendacoes.acoes.push('Revisar critérios de seleção - taxa de aprovação muito baixa');
      recomendacoes.alertas.push('Sistema pode estar rejeitando produtos viáveis');
    } else if (taxaAprovacao > 80) {
      recomendacoes.alertas.push('Taxa de aprovação muito alta - critérios podem estar lenientes');
      recomendacoes.acoes.push('Considerar tornar filtros mais rigorosos');
    } else if (taxaAprovacao >= 50) {
      recomendacoes.oportunidades.push('Taxa de aprovação equilibrada indica bom ajuste dos filtros');
    }
    
    // Análise de margens
    if (stats.margensMedias.realista < 15) {
      recomendacoes.alertas.push('Margem média realista abaixo do recomendado (15%)');
      recomendacoes.acoes.push('Focar em produtos com maior potencial de margem');
    } else if (stats.margensMedias.realista > 30) {
      recomendacoes.oportunidades.push('Excelentes margens médias - considerar expandir volume');
    }
    
    // Análise de performance
    if (stats.scoresMedios.final < 60) {
      recomendacoes.acoes.push('Score médio baixo - revisar fontes de produtos');
    }
    
    // Análise de erros
    if (stats.comErros > stats.total * 0.1) {
      recomendacoes.alertas.push('Alta taxa de erros no processamento');
      recomendacoes.acoes.push('Investigar e corrigir problemas de qualidade de dados');
    }
    
    // Recomendações por categoria
    if (analises?.categoriaMaisPromissora && analises.categoriaMaisPromissora !== 'N/A') {
      recomendacoes.oportunidades.push(`Categoria mais promissora: ${analises.categoriaMaisPromissora}`);
    }
    
    return recomendacoes;
    
  } catch (error) {
    logErro(`Erro na geração de recomendações estratégicas`, error);
    return {
      erro: 'Falha na geração de recomendações',
      observacao: 'Analise manual recomendada'
    };
  }
}
