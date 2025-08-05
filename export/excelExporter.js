/**
 * @fileoverview Exportador de dados para Excel com formatação avançada
 * @description Módulo responsável por exportar dados de produtos scraped para planilhas Excel
 * com formatação profissional, validação de dados e tratamento robusto de exceções.
 * Suporta múltiplas abas, formatação condicional e estruturas de dados complexas.
 * 
 * @author Sistema de Scraping AliExpress
 * @version 2.0.0
 * @since 2024-01-01
 */

import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import path from 'path';
import { slugify, logInfo, logErro, logSucesso } from '../scraper/utils.js';
import { CONFIG } from '../config.js';

/**
 * Configurações do exportador Excel
 */
const EXCEL_CONFIG = {
  formatacao: {
    larguraMinima: 12,
    larguraMaxima: 50,
    alturaCabecalho: 25,
    alturaLinha: 20
  },
  cores: {
    cabecalho: 'FF366092',        // Azul profissional
    aprovado: 'FF90EE90',         // Verde claro
    reprovado: 'FFFFCCCB',        // Vermelho claro
    warning: 'FFFFFF99',          // Amarelo claro
    bordas: 'FF000000'            // Preto
  },
  limites: {
    maxLinhasPorAba: 1000000,     // Limite Excel
    maxCaracteresCelula: 32767,   // Limite Excel
    maxColunas: 16384             // Limite Excel
  }
};

/**
 * Exporta dados de produtos para arquivo Excel com formatação profissional
 * @description Cria planilha Excel formatada com dados de produtos, incluindo
 * múltiplas abas, formatação condicional e validação de dados
 * 
 * @param {Array} produtos - Array de produtos para exportar
 * @param {string} categoria - Categoria dos produtos (para nome do arquivo)
 * @param {Object} [opcoes={}] - Opções de exportação
 * @param {boolean} [opcoes.incluirMetadados=true] - Se deve incluir aba de metadados
 * @param {boolean} [opcoes.formatacaoCondicional=true] - Se deve aplicar formatação condicional
 * @param {boolean} [opcoes.validarDados=true] - Se deve validar dados antes da exportação
 * @param {string} [opcoes.diretorioCustom] - Diretório customizado para salvar arquivo
 * @param {Array} [opcoes.colunasPersonalizadas] - Colunas específicas a incluir
 * 
 * @returns {Promise<string>} Caminho completo do arquivo Excel criado
 * @throws {Error} Em caso de falha na exportação
 * 
 * @example
 * const arquivo = await exportToExcel(produtos, "eletronicos", {
 *   incluirMetadados: true,
 *   formatacaoCondicional: true
 * });
 * 
 * @example
 * const arquivo = await exportToExcel(produtos, "roupas", {
 *   colunasPersonalizadas: ["nome", "preco", "aprovacao.aprovado"]
 * });
 */
export async function exportToExcel(produtos, categoria, opcoes = {}) {
  const configuracao = {
    incluirMetadados: true,
    formatacaoCondicional: true,
    validarDados: true,
    diretorioCustom: null,
    colunasPersonalizadas: null,
    ...opcoes
  };
  
  const inicioExportacao = Date.now();
  
  try {
    // Validação de parâmetros de entrada
    if (!Array.isArray(produtos)) {
      throw new Error('Parâmetro "produtos" deve ser um array');
    }
    
    if (produtos.length === 0) {
      throw new Error('Array de produtos está vazio - nada para exportar');
    }
    
    if (typeof categoria !== 'string' || categoria.length === 0) {
      console.warn('⚠️ Categoria inválida, usando "categoria-desconhecida"');
      categoria = 'categoria-desconhecida';
    }
    
    if (produtos.length > EXCEL_CONFIG.limites.maxLinhasPorAba) {
      console.warn(`⚠️ Muitos produtos (${produtos.length}), pode haver limitações no Excel`);
    }
    
    logInfo(`📊 Iniciando exportação de ${produtos.length} produtos para Excel...`);
    logInfo(`🏷️ Categoria: ${categoria}`);
    
    // Validar dados se solicitado
    if (configuracao.validarDados) {
      const produtosValidos = await validarDadosParaExcel(produtos);
      if (produtosValidos.length !== produtos.length) {
        logInfo(`⚠️ ${produtos.length - produtosValidos.length} produtos removidos por dados inválidos`);
        produtos = produtosValidos;
      }
    }
    
    // Determinar diretório de saída
    const diretorioSaida = configuracao.diretorioCustom || 
                          CONFIG?.general?.debugDir || 
                          './debug';
    
    // Garantir que diretório existe
    await fs.ensureDir(diretorioSaida);
    
    // Gerar nome único do arquivo
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
    const categoriaSlug = slugify(categoria);
    const nomeArquivo = `Mineracao_${categoriaSlug}_${timestamp}.xlsx`;
    const caminhoCompleto = path.join(diretorioSaida, nomeArquivo);
    
    logInfo(`💾 Criando arquivo: ${nomeArquivo}`);
    
    // Criar workbook Excel
    const workbook = new ExcelJS.Workbook();
    
    // Configurar metadados do workbook
    workbook.creator = 'Sistema de Scraping AliExpress';
    workbook.lastModifiedBy = 'Exportador Automático';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = `Dados de produtos - ${categoria}`;
    workbook.description = `Exportação de ${produtos.length} produtos da categoria ${categoria}`;
    
    // === ABA PRINCIPAL: PRODUTOS ===
    await criarAbaProdutos(workbook, produtos, categoria, configuracao);
    
    // === ABA DE METADADOS (se solicitada) ===
    if (configuracao.incluirMetadados) {
      await criarAbaMetadados(workbook, produtos, categoria);
    }
    
    // === ABA DE ESTATÍSTICAS ===
    await criarAbaEstatisticas(workbook, produtos, categoria);
    
    // Salvar arquivo
    logInfo('💾 Salvando arquivo Excel...');
    await workbook.xlsx.writeFile(caminhoCompleto);
    
    // Verificar se arquivo foi criado corretamente
    const arquivoExiste = await fs.pathExists(caminhoCompleto);
    if (!arquivoExiste) {
      throw new Error('Arquivo Excel não foi criado corretamente');
    }
    
    // Obter informações do arquivo
    const stats = await fs.stat(caminhoCompleto);
    const tamanhoMB = Math.round(stats.size / (1024 * 1024) * 100) / 100;
    const tempoExportacao = Date.now() - inicioExportacao;
    
    logSucesso(`✅ Excel exportado com sucesso!`);
    logInfo(`📁 Arquivo: ${path.basename(caminhoCompleto)}`);
    logInfo(`📏 Tamanho: ${tamanhoMB}MB`);
    logInfo(`⏱️  Tempo: ${tempoExportacao}ms`);
    logInfo(`📍 Local: ${caminhoCompleto}`);
    
    return caminhoCompleto;
    
  } catch (error) {
    const tempoTotal = Date.now() - inicioExportacao;
    const mensagemErro = `Erro na exportação para Excel: ${error.message}`;
    
    logErro(mensagemErro, error);
    logInfo(`⏱️ Tempo até falha: ${tempoTotal}ms`);
    
    // Tentar limpeza de arquivos parciais
    try {
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
      const categoriaSlug = slugify(categoria || 'erro');
      const nomeArquivoErro = `Mineracao_${categoriaSlug}_${timestamp}.xlsx`;
      const diretorioSaida = configuracao.diretorioCustom || CONFIG?.general?.debugDir || './debug';
      const caminhoComErro = path.join(diretorioSaida, nomeArquivoErro);
      
      if (await fs.pathExists(caminhoComErro)) {
        await fs.remove(caminhoComErro);
        logInfo('🧹 Arquivo parcial removido');
      }
    } catch (cleanupError) {
      logErro('Erro na limpeza de arquivo parcial', cleanupError);
    }
    
    throw new Error(mensagemErro);
  }
}

/**
 * Valida dados de produtos antes da exportação para Excel
 * @description Remove ou corrige produtos com dados inválidos que podem causar problemas no Excel
 * @param {Array} produtos - Array de produtos para validar
 * @returns {Promise<Array>} Array de produtos validados e limpos
 * @private
 */
async function validarDadosParaExcel(produtos) {
  try {
    logInfo('🔍 Validando dados para compatibilidade com Excel...');
    
    const produtosValidos = [];
    let produtosComProblemas = 0;
    
    for (let i = 0; i < produtos.length; i++) {
      const produto = produtos[i];
      
      try {
        // Verificar se produto é objeto válido
        if (!produto || typeof produto !== 'object') {
          throw new Error(`Item ${i} não é um objeto válido`);
        }
        
        // Criar cópia do produto para limpeza
        const produtoLimpo = await limparDadosProduto(produto, i);
        
        if (produtoLimpo) {
          produtosValidos.push(produtoLimpo);
        } else {
          produtosComProblemas++;
        }
        
      } catch (errorProduto) {
        console.warn(`⚠️ Produto ${i} ignorado: ${errorProduto.message}`);
        produtosComProblemas++;
      }
    }
    
    if (produtosComProblemas > 0) {
      logInfo(`⚠️ ${produtosComProblemas} produtos ignorados por problemas de dados`);
    }
    
    logInfo(`✅ ${produtosValidos.length} produtos validados para Excel`);
    return produtosValidos;
    
  } catch (error) {
    logErro('Erro na validação de dados para Excel', error);
    return produtos; // Retornar dados originais em caso de erro
  }
}

/**
 * Limpa e normaliza dados de um produto para compatibilidade com Excel
 * @description Remove caracteres problemáticos e trunca valores muito longos
 * @param {Object} produto - Produto a ser limpo
 * @param {number} index - Índice do produto (para logging)
 * @returns {Promise<Object|null>} Produto limpo ou null se não pôde ser limpo
 * @private
 */
async function limparDadosProduto(produto, index) {
  try {
    // Função recursiva para limpar objeto
    const limparObjeto = (obj, profundidade = 0) => {
      if (profundidade > 10) {
        return '[Objeto muito profundo]';
      }
      
      if (obj === null || obj === undefined) {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.slice(0, 100).map(item => limparObjeto(item, profundidade + 1));
      }
      
      if (typeof obj === 'object') {
        const objetoLimpo = {};
        
        for (const [chave, valor] of Object.entries(obj)) {
          // Limitar tamanho da chave
          const chaveLimpa = String(chave).slice(0, 100);
          objetoLimpo[chaveLimpa] = limparObjeto(valor, profundidade + 1);
        }
        
        return objetoLimpo;
      }
      
      if (typeof obj === 'string') {
        // Remover caracteres problemáticos e truncar se muito longo
        return obj
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remover caracteres de controle
          .slice(0, EXCEL_CONFIG.limites.maxCaracteresCelula - 1);
      }
      
      if (typeof obj === 'number') {
        // Verificar se é um número válido
        if (isNaN(obj) || !isFinite(obj)) {
          return 0;
        }
        return obj;
      }
      
      return obj;
    };
    
    return limparObjeto(produto);
    
  } catch (error) {
    console.warn(`⚠️ Erro ao limpar produto ${index}: ${error.message}`);
    return null;
  }
}

/**
 * Cria aba principal com dados dos produtos formatada profissionalmente
 * @description Cria planilha principal com formatação condicional e estrutura otimizada
 * @param {ExcelJS.Workbook} workbook - Instância do workbook Excel
 * @param {Array} produtos - Array de produtos
 * @param {string} categoria - Categoria dos produtos
 * @param {Object} configuracao - Configurações de exportação
 * @returns {Promise<void>}
 * @private
 */
async function criarAbaProdutos(workbook, produtos, categoria, configuracao) {
  try {
    logInfo('📋 Criando aba principal de produtos...');
    
    const sheet = workbook.addWorksheet('Produtos', {
      properties: {
        defaultRowHeight: EXCEL_CONFIG.formatacao.alturaLinha,
        defaultColWidth: EXCEL_CONFIG.formatacao.larguraMinima
      }
    });
    
    // Determinar colunas a incluir
    let colunas;
    if (configuracao.colunasPersonalizadas && Array.isArray(configuracao.colunasPersonalizadas)) {
      colunas = configuracao.colunasPersonalizadas;
      logInfo(`📊 Usando ${colunas.length} colunas personalizadas`);
    } else {
      // Extrair todas as colunas únicas dos produtos
      const colunasSet = new Set();
      produtos.forEach(prod => {
        Object.keys(flattenObject(prod)).forEach(k => colunasSet.add(k));
      });
      colunas = Array.from(colunasSet).sort();
      logInfo(`📊 Detectadas ${colunas.length} colunas únicas`);
    }
    
    // Verificar limite de colunas
    if (colunas.length > EXCEL_CONFIG.limites.maxColunas) {
      console.warn(`⚠️ Muitas colunas (${colunas.length}), truncando para ${EXCEL_CONFIG.limites.maxColunas}`);
      colunas = colunas.slice(0, EXCEL_CONFIG.limites.maxColunas);
    }
    
    // Configurar colunas da planilha
    sheet.columns = colunas.map(key => {
      const largura = Math.max(
        EXCEL_CONFIG.formatacao.larguraMinima,
        Math.min(EXCEL_CONFIG.formatacao.larguraMaxima, key.length + 5)
      );
      
      return {
        header: formatarNomeColunaParaExcel(key),
        key: key,
        width: largura
      };
    });
    
    // Configurar linha de cabeçalho
    const linhaCabecalho = sheet.getRow(1);
    linhaCabecalho.height = EXCEL_CONFIG.formatacao.alturaCabecalho;
    
    // Aplicar formatação ao cabeçalho
    linhaCabecalho.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_CONFIG.cores.cabecalho }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 12
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: EXCEL_CONFIG.cores.bordas } },
        left: { style: 'thin', color: { argb: EXCEL_CONFIG.cores.bordas } },
        bottom: { style: 'thin', color: { argb: EXCEL_CONFIG.cores.bordas } },
        right: { style: 'thin', color: { argb: EXCEL_CONFIG.cores.bordas } }
      };
    });
    
    // Adicionar dados dos produtos
    logInfo(`📝 Adicionando ${produtos.length} linhas de dados...`);
    
    produtos.forEach((produto, index) => {
      try {
        const flat = flattenObject(produto);
        const row = sheet.addRow(flat);
        
        // Aplicar formatação condicional se habilitada
        if (configuracao.formatacaoCondicional) {
          aplicarFormatacaoCondicional(row, flat, index + 2); // +2 porque linha 1 é cabeçalho
        }
        
      } catch (errorLinha) {
        console.warn(`⚠️ Erro ao adicionar produto ${index}: ${errorLinha.message}`);
      }
    });
    
    // Aplicar filtros automáticos
    if (produtos.length > 0) {
      const ultimaColuna = sheet.columns.length;
      const ultimaLinha = produtos.length + 1;
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: ultimaLinha, column: ultimaColuna }
      };
    }
    
    // Congelar primeira linha
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    
    logSucesso(`✅ Aba de produtos criada com ${produtos.length} registros`);
    
  } catch (error) {
    logErro('Erro ao criar aba de produtos', error);
    throw error;
  }
}

/**
 * Cria aba de metadados com informações sobre a exportação
 * @description Adiciona aba informativa com detalhes sobre os dados exportados
 * @param {ExcelJS.Workbook} workbook - Instância do workbook Excel
 * @param {Array} produtos - Array de produtos
 * @param {string} categoria - Categoria dos produtos
 * @returns {Promise<void>}
 * @private
 */
async function criarAbaMetadados(workbook, produtos, categoria) {
  try {
    logInfo('📝 Criando aba de metadados...');
    
    const sheet = workbook.addWorksheet('Metadados');
    
    // Configurar colunas
    sheet.columns = [
      { header: 'Propriedade', key: 'propriedade', width: 30 },
      { header: 'Valor', key: 'valor', width: 50 }
    ];
    
    // Calcular estatísticas básicas
    const aprovados = produtos.filter(p => p.aprovacao?.aprovado).length;
    const comMargem = produtos.filter(p => p.filtros?.margem?.sucesso).length;
    const scoresMedios = calcularScoresMedios(produtos);
    
    // Dados de metadados
    const metadados = [
      { propriedade: 'Data de Exportação', valor: new Date().toLocaleString('pt-BR') },
      { propriedade: 'Categoria', valor: categoria },
      { propriedade: 'Total de Produtos', valor: produtos.length },
      { propriedade: 'Produtos Aprovados', valor: `${aprovados} (${Math.round(aprovados/produtos.length*100)}%)` },
      { propriedade: 'Com Análise de Margem', valor: comMargem },
      { propriedade: 'Score Médio Quantitativo', valor: scoresMedios.quantitativo || 'N/A' },
      { propriedade: 'Score Médio Qualitativo', valor: scoresMedios.qualitativo || 'N/A' },
      { propriedade: 'Score Médio Final', valor: scoresMedios.final || 'N/A' },
      { propriedade: 'Sistema', valor: 'AliExpress Scraper v2.0.0' },
      { propriedade: 'Formato de Exportação', valor: 'Excel (.xlsx)' }
    ];
    
    // Adicionar dados
    metadados.forEach((item, index) => {
      const row = sheet.addRow(item);
      
      // Formatação alternada
      if (index % 2 === 0) {
        row.getCell('propriedade').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
        row.getCell('valor').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      }
    });
    
    // Formatação do cabeçalho
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_CONFIG.cores.cabecalho }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    
    logSucesso('✅ Aba de metadados criada');
    
  } catch (error) {
    logErro('Erro ao criar aba de metadados', error);
    // Não propagar o erro - metadados são opcionais
  }
}

/**
 * Cria aba de estatísticas resumidas
 * @description Adiciona aba com estatísticas e gráficos dos dados
 * @param {ExcelJS.Workbook} workbook - Instância do workbook Excel
 * @param {Array} produtos - Array de produtos
 * @param {string} categoria - Categoria dos produtos
 * @returns {Promise<void>}
 * @private
 */
async function criarAbaEstatisticas(workbook, produtos, categoria) {
  try {
    logInfo('📊 Criando aba de estatísticas...');
    
    const sheet = workbook.addWorksheet('Estatísticas');
    
    // Calcular estatísticas
    const stats = calcularEstatisticasDetalhadas(produtos);
    
    // Seção 1: Resumo Geral
    sheet.addRow(['RESUMO GERAL']);
    sheet.addRow(['Total de Produtos', produtos.length]);
    sheet.addRow(['Produtos Aprovados', stats.aprovados]);
    sheet.addRow(['Taxa de Aprovação', `${stats.taxaAprovacao}%`]);
    sheet.addRow(['']); // Linha vazia
    
    // Seção 2: Scores Médios
    sheet.addRow(['SCORES MÉDIOS']);
    sheet.addRow(['Score Quantitativo', stats.scoresMedios.quantitativo || 'N/A']);
    sheet.addRow(['Score Qualitativo', stats.scoresMedios.qualitativo || 'N/A']);
    sheet.addRow(['Score Final', stats.scoresMedios.final || 'N/A']);
    sheet.addRow(['']); // Linha vazia
    
    // Seção 3: Distribuição por Níveis
    sheet.addRow(['DISTRIBUIÇÃO POR NÍVEIS']);
    Object.entries(stats.niveisDistribuicao).forEach(([nivel, quantidade]) => {
      if (quantidade > 0) {
        sheet.addRow([nivel, quantidade]);
      }
    });
    sheet.addRow(['']); // Linha vazia
    
    // Seção 4: Faixas de Preço
    if (stats.faixasPreco) {
      sheet.addRow(['DISTRIBUIÇÃO POR FAIXA DE PREÇO']);
      Object.entries(stats.faixasPreco).forEach(([faixa, quantidade]) => {
        if (quantidade > 0) {
          sheet.addRow([faixa, quantidade]);
        }
      });
    }
    
    // Formatação da planilha
    sheet.columns = [
      { width: 30 },
      { width: 20 }
    ];
    
    // Aplicar formatação aos títulos das seções
    [1, 6, 11, 16].forEach(rowNum => {
      const row = sheet.getRow(rowNum);
      if (row && row.getCell(1).value) {
        row.getCell(1).font = { bold: true, size: 14 };
        row.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE6E6FA' }
        };
      }
    });
    
    logSucesso('✅ Aba de estatísticas criada');
    
  } catch (error) {
    logErro('Erro ao criar aba de estatísticas', error);
    // Não propagar o erro - estatísticas são opcionais
  }
}

/**
 * Aplica formatação condicional a uma linha de dados
 * @description Adiciona cores baseadas no status de aprovação e scores
 * @param {ExcelJS.Row} row - Linha do Excel
 * @param {Object} dados - Dados achatados do produto
 * @param {number} numeroLinha - Número da linha
 * @private
 */
function aplicarFormatacaoCondicional(row, dados, numeroLinha) {
  try {
    // Determinar cor baseada no status de aprovação
    let corFundo = null;
    
    if (dados['aprovacao.aprovado'] === true) {
      corFundo = EXCEL_CONFIG.cores.aprovado;
    } else if (dados['aprovacao.aprovado'] === false) {
      corFundo = EXCEL_CONFIG.cores.reprovado;
    } else if (dados['aprovacao.scoreFinal'] && dados['aprovacao.scoreFinal'] >= 50) {
      corFundo = EXCEL_CONFIG.cores.warning;
    }
    
    // Aplicar formatação se cor foi definida
    if (corFundo) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: corFundo }
        };
      });
    }
    
    // Formatação especial para células de score
    const cellScore = row.getCell('aprovacao.scoreFinal');
    if (cellScore && typeof cellScore.value === 'number') {
      const score = cellScore.value;
      if (score >= 80) {
        cellScore.font = { bold: true, color: { argb: 'FF006400' } }; // Verde escuro
      } else if (score >= 70) {
        cellScore.font = { bold: true, color: { argb: 'FF228B22' } }; // Verde
      } else if (score >= 50) {
        cellScore.font = { bold: true, color: { argb: 'FFFF8C00' } }; // Laranja
      } else {
        cellScore.font = { bold: true, color: { argb: 'FFDC143C' } }; // Vermelho
      }
    }
    
  } catch (error) {
    // Ignorar erros de formatação - não críticos
    console.warn(`⚠️ Erro na formatação condicional da linha ${numeroLinha}: ${error.message}`);
  }
}

/**
 * Calcula scores médios dos produtos
 * @description Calcula médias dos diferentes tipos de scores
 * @param {Array} produtos - Array de produtos
 * @returns {Object} Objeto com scores médios
 * @private
 */
function calcularScoresMedios(produtos) {
  try {
    const scores = {
      quantitativo: 0,
      qualitativo: 0,
      final: 0
    };
    
    let contadores = {
      quantitativo: 0,
      qualitativo: 0,
      final: 0
    };
    
    produtos.forEach(produto => {
      if (produto.aprovacao?.scores?.quantitativo) {
        scores.quantitativo += produto.aprovacao.scores.quantitativo;
        contadores.quantitativo++;
      }
      
      if (produto.aprovacao?.scores?.qualitativo) {
        scores.qualitativo += produto.aprovacao.scores.qualitativo;
        contadores.qualitativo++;
      }
      
      if (produto.aprovacao?.scoreFinal) {
        scores.final += produto.aprovacao.scoreFinal;
        contadores.final++;
      }
    });
    
    // Calcular médias
    Object.keys(scores).forEach(key => {
      if (contadores[key] > 0) {
        scores[key] = Math.round(scores[key] / contadores[key]);
      } else {
        scores[key] = null;
      }
    });
    
    return scores;
    
  } catch (error) {
    logErro('Erro ao calcular scores médios', error);
    return { quantitativo: null, qualitativo: null, final: null };
  }
}

/**
 * Calcula estatísticas detalhadas dos produtos
 * @description Gera estatísticas completas para uso na aba de estatísticas
 * @param {Array} produtos - Array de produtos
 * @returns {Object} Objeto com estatísticas detalhadas
 * @private
 */
function calcularEstatisticasDetalhadas(produtos) {
  try {
    const stats = {
      total: produtos.length,
      aprovados: 0,
      taxaAprovacao: 0,
      scoresMedios: calcularScoresMedios(produtos),
      niveisDistribuicao: {},
      faixasPreco: {
        'Até R$ 50': 0,
        'R$ 50-100': 0,
        'R$ 100-200': 0,
        'R$ 200-500': 0,
        'Acima R$ 500': 0
      }
    };
    
    produtos.forEach(produto => {
      // Contagem de aprovados
      if (produto.aprovacao?.aprovado) {
        stats.aprovados++;
      }
      
      // Distribuição por níveis
      const nivel = produto.aprovacao?.nivel || 'Não Classificado';
      stats.niveisDistribuicao[nivel] = (stats.niveisDistribuicao[nivel] || 0) + 1;
      
      // Faixas de preço
      const preco = produto.produto?.preco || 0;
      if (preco <= 50) stats.faixasPreco['Até R$ 50']++;
      else if (preco <= 100) stats.faixasPreco['R$ 50-100']++;
      else if (preco <= 200) stats.faixasPreco['R$ 100-200']++;
      else if (preco <= 500) stats.faixasPreco['R$ 200-500']++;
      else stats.faixasPreco['Acima R$ 500']++;
    });
    
    // Calcular taxa de aprovação
    stats.taxaAprovacao = stats.total > 0 ? Math.round((stats.aprovados / stats.total) * 100) : 0;
    
    return stats;
    
  } catch (error) {
    logErro('Erro ao calcular estatísticas detalhadas', error);
    return {
      total: produtos.length,
      aprovados: 0,
      taxaAprovacao: 0,
      scoresMedios: { quantitativo: null, qualitativo: null, final: null },
      niveisDistribuicao: {},
      faixasPreco: {}
    };
  }
}

/**
 * Formata nome de coluna para exibição no Excel
 * @description Converte chaves de objeto em nomes amigáveis para cabeçalhos
 * @param {string} nomeOriginal - Nome original da chave
 * @returns {string} Nome formatado para cabeçalho
 * @private
 */
function formatarNomeColunaParaExcel(nomeOriginal) {
  try {
    return nomeOriginal
      .replace(/\./g, ' → ')           // Pontos viram setas
      .replace(/_/g, ' ')              // Underscores viram espaços
      .replace(/([A-Z])/g, ' $1')      // CamelCase vira espaçado
      .replace(/^\w/, c => c.toUpperCase())  // Primeira letra maiúscula
      .trim();
  } catch (error) {
    return String(nomeOriginal || 'Coluna');
  }
}

/**
 * Utilitário para "achatar" objetos aninhados para estrutura plana do Excel
 * @description Converte objetos com estruturas aninhadas em formato plano
 * @param {Object} obj - Objeto para achatar
 * @param {string} [prefix=''] - Prefixo para chaves aninhadas
 * @param {Object} [result={}] - Objeto resultado acumulado
 * @returns {Object} Objeto achatado com chaves concatenadas
 * 
 * @example
 * flattenObject({ user: { name: "João", age: 30 } });
 * // Resultado: { "user.name": "João", "user.age": 30 }
 */
function flattenObject(obj, prefix = '', result = {}) {
  try {
    // Verificar se objeto é válido
    if (obj === null || obj === undefined) {
      return result;
    }
    
    // Se não é objeto, retornar valor simples
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      if (prefix) {
        result[prefix] = Array.isArray(obj) ? obj.join(', ') : obj;
      }
      return result;
    }
    
    // Iterar sobre propriedades do objeto
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const val = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        // Recursão para objetos aninhados
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          flattenObject(val, newKey, result);
        } else {
          // Tratar arrays convertendo para string
          result[newKey] = Array.isArray(val) ? val.join(', ') : val;
        }
      }
    }
    
    return result;
    
  } catch (error) {
    logErro(`Erro ao achatar objeto`, error);
    return result;
  }
}
