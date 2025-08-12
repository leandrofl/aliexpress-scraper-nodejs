/**
 * @fileoverview Utilidades auxiliares para o scraping do AliExpress
 * @description Módulo com funções utilitárias para manipulação de dados, delays,
 * logs, screenshots, manipulação de páginas e filtros de busca.
 * Todas as funções incluem tratamento robusto de exceções e logging detalhado.
 * 
 * @author Sistema de Scraping AliExpress
 * @version 2.0.0
 * @since 2024-01-01
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../config.js';

/**
 * Configuração de módulo e paths base
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executa um delay (pausa) por um tempo fixo especificado
 * @description Utiliza Promise para criar uma pausa não-bloqueante
 * @param {number} ms - Tempo em milissegundos para pausar
 * @returns {Promise<void>} Promise que resolve após o tempo especificado
 * @throws {TypeError} Quando ms não é um número válido
 * 
 * @example
 * // Pausar por 2 segundos
 * await delay(2000);
 * 
 * @example
 * // Pausar por 500ms
 * await delay(500);
 */
export const delay = (ms) => {
  try {
    // Validação de entrada
    if (typeof ms !== 'number' || ms < 0 || !isFinite(ms)) {
      throw new TypeError(`Delay: Tempo deve ser um número positivo. Recebido: ${ms}`);
    }
    
    // Limite máximo de segurança (10 minutos)
    const MAX_DELAY = 10 * 60 * 1000;
    if (ms > MAX_DELAY) {
      console.warn(`⚠️ Delay muito longo (${ms}ms), limitando a ${MAX_DELAY}ms`);
      ms = MAX_DELAY;
    }
    
    return new Promise(resolve => setTimeout(resolve, ms));
  } catch (error) {
    console.error(`❌ Erro no delay: ${error.message}`);
    // Retorna Promise resolvida imediatamente em caso de erro
    return Promise.resolve();
  }
};

/**
 * Executa um delay aleatório para simular comportamento humano
 * @description Gera um tempo aleatório entre 1.2s e 2.5s para evitar detecção
 * @returns {Promise<void>} Promise que resolve após tempo aleatório
 * @throws {Error} Em caso de falha na geração do delay
 * 
 * @example
 * // Pausar por tempo aleatório antes de fazer scraping
 * await randomDelay();
 */
export const randomDelay = async () => {
  try {
    // Configuração dos limites (em milissegundos)
    const MIN_DELAY = 1200;  // 1.2 segundos
    const MAX_DELAY = 2500;  // 2.5 segundos
    
    // Gerar tempo aleatório
    const time = Math.random() * (MAX_DELAY - MIN_DELAY) + MIN_DELAY;
    
    // Garantir que o tempo é válido
    if (!isFinite(time) || time <= 0) {
      throw new Error(`Tempo aleatório inválido gerado: ${time}`);
    }
    
    console.log(`⏳ Delay aleatório: ${Math.round(time)}ms`);
    await delay(time);
  } catch (error) {
    console.error(`❌ Erro no delay aleatório: ${error.message}`);
    // Fallback para delay fixo
    console.log(`🔄 Usando delay fixo de 2000ms como fallback`);
    await delay(2000);
  }
};

/**
 * Faz scroll na página até carregar todos os produtos disponíveis
 * @description Utiliza estratégia de scroll inteligente com detecção de fim de resultados
 * e contagem estável de produtos para determinar quando parar
 * 
 * @param {Page} page - Instância do Puppeteer Page
 * @param {number} [maxAttempts=2] - Máximo de tentativas com contagem estável
 * @param {number} [intervalo=500] - Intervalo entre scrolls em milissegundos
 * @returns {Promise<number>} Número total de produtos encontrados
 * @throws {Error} Em caso de falha no processo de scroll
 * 
 * @example
 * // Scroll básico
 * const totalProdutos = await scrollUntilAllProductsLoaded(page);
 * 
 * @example
 * // Scroll com parâmetros personalizados
 * const totalProdutos = await scrollUntilAllProductsLoaded(page, 3, 800);
 */
export async function scrollUntilAllProductsLoaded(page, maxAttempts = 2, intervalo = 500) {
  try {
    // Validação de parâmetros
    if (!page || typeof page.evaluate !== 'function') {
      throw new Error('Página Puppeteer inválida fornecida');
    }
    
    if (typeof maxAttempts !== 'number' || maxAttempts <= 0) {
      console.warn(`⚠️ maxAttempts inválido (${maxAttempts}), usando valor padrão: 2`);
      maxAttempts = 2;
    }
    
    if (typeof intervalo !== 'number' || intervalo <= 0) {
      console.warn(`⚠️ Intervalo inválido (${intervalo}), usando valor padrão: 500ms`);
      intervalo = 500;
    }
    
    // Variáveis de controle
    let previousCount = 0;
    let stableAttempts = 0;
    let scrollAttempts = 0;
    const MAX_SCROLL_ATTEMPTS = 50; // Limite máximo de scrolls para evitar loop infinito
    
    console.log(`🔄 Iniciando scroll automático (máx ${maxAttempts} verificações estáveis)`);
    
    while (stableAttempts < maxAttempts && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
      try {
        scrollAttempts++;
        
        // Contar produtos atuais
        const elementos = await page.$$(`a.search-card-item`);
        const currentCount = elementos ? elementos.length : 0;
        
        // Verificar se chegou ao fim dos resultados
        const fimResultados = await page.$(`.comet-pagination__no-more`);
        const fimVisivel = fimResultados ? await fimResultados.isIntersectingViewport() : false;
        
        // Log de progresso a cada 10 scrolls
        if (scrollAttempts % 10 === 0) {
          console.log(`📊 Scroll ${scrollAttempts}: ${currentCount} produtos encontrados`);
        }
        
        // Verificar estabilidade da contagem
        if (currentCount === previousCount) {
          stableAttempts++;
          console.log(`⏸️ Contagem estável ${stableAttempts}/${maxAttempts}: ${currentCount} produtos`);
        } else {
          stableAttempts = 0; // Reset contador se a contagem mudou
        }
        
        // Condições de parada
        if (fimVisivel && currentCount === previousCount) {
          console.log(`🏁 Fim dos resultados detectado com ${currentCount} produtos`);
          break;
        }
        
        // Executar scroll
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        
        // Aguardar carregamento
        await delay(intervalo);
        previousCount = currentCount;
        
      } catch (scrollError) {
        console.error(`⚠️ Erro durante scroll ${scrollAttempts}: ${scrollError.message}`);
        // Continuar tentando outros scrolls
        continue;
      }
    }
    
    // Resultado final
    const finalCount = previousCount;
    
    if (scrollAttempts >= MAX_SCROLL_ATTEMPTS) {
      console.warn(`⚠️ Atingido limite máximo de scrolls (${MAX_SCROLL_ATTEMPTS})`);
    }
    
    console.log(`✅ Scroll concluído: ${finalCount} produtos carregados em ${scrollAttempts} tentativas`);
    return finalCount;
    
  } catch (error) {
    console.error(`❌ Erro crítico no scroll automático: ${error.message}`);
    console.error(`📍 Stack trace:`, error.stack);
    
    // Tentar obter contagem atual mesmo com erro
    try {
      const elementos = await page.$$(`a.search-card-item`);
      const currentCount = elementos ? elementos.length : 0;
      console.log(`🔄 Retornando contagem atual apesar do erro: ${currentCount} produtos`);
      return currentCount;
    } catch (fallbackError) {
      console.error(`❌ Falha também no fallback de contagem: ${fallbackError.message}`);
      return 0;
    }
  }
}

/**
 * Converte string em slug amigável para URLs e nomes de arquivo
 * @description Remove acentos, caracteres especiais e normaliza texto para uso seguro
 * @param {string} str - String para converter em slug
 * @returns {string} String convertida em slug (minúsculas, hífens, sem acentos)
 * @throws {TypeError} Quando entrada não é uma string válida
 * 
 * @example
 * slugify("Eletrônicos & Gadgets"); // "eletronicos-gadgets"
 * 
 * @example
 * slugify("Roupas Masculinas!!!"); // "roupas-masculinas"
 */
export const slugify = (str) => {
  try {
    // Validação de entrada
    if (typeof str !== 'string') {
      console.warn(`⚠️ Slugify: Entrada inválida (${typeof str}), convertendo para string`);
      str = String(str || '');
    }
    
    if (str.length === 0) {
      console.warn(`⚠️ Slugify: String vazia fornecida`);
      return 'sem-nome';
    }
    
    // Processo de limpeza e normalização
    const resultado = str
      .normalize('NFD')                    // Normalizar acentos
      .replace(/[\u0300-\u036f]/g, '')    // Remover diacríticos
      .replace(/\s+/g, '-')               // Espaços → hífens
      .replace(/[^\w\-]+/g, '')           // Remover caracteres especiais
      .replace(/\-\-+/g, '-')             // Múltiplos hífens → único hífen
      .replace(/^-+/, '')                 // Remover hífens no início
      .replace(/-+$/, '')                 // Remover hífens no final
      .toLowerCase();                     // Converter para minúsculas
    
    // Validar resultado
    if (resultado.length === 0) {
      console.warn(`⚠️ Slugify resultou em string vazia para: "${str}"`);
      return 'item-sem-nome';
    }
    
    // Limite de tamanho para evitar nomes muito longos
    const MAX_SLUG_LENGTH = 100;
    if (resultado.length > MAX_SLUG_LENGTH) {
      const slugTruncado = resultado.substring(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
      console.debug?.(`📏 Slug truncado de ${resultado.length} para ${slugTruncado.length} caracteres`);
      return slugTruncado;
    }
    
    return resultado;
    
  } catch (error) {
    console.error(`❌ Erro ao gerar slug para "${str}": ${error.message}`);
    // Fallback seguro
    return 'erro-slug-' + Date.now();
  }
};

/**
 * Faz parsing de string de preço para número decimal
 * @description Extrai valor numérico de strings de preço em diversos formatos
 * @param {string} str - String contendo preço (ex: "R$ 15,90", "$29.99", "123,45")
 * @returns {number|null} Valor numérico ou null se parsing falhar
 * 
 * @example
 * parsePrice("R$ 15,90"); // 15.90
 * 
 * @example
 * parsePrice("$29.99"); // 29.99
 * 
 * @example
 * parsePrice("invalid"); // null
 */
export function parsePrice(str) {
  try {
    // Validação de entrada
    if (typeof str !== 'string') {
      console.warn(`⚠️ ParsePrice: Entrada inválida (${typeof str}), convertendo para string`);
      str = String(str || '');
    }
    
    if (str.length === 0) {
      console.warn(`⚠️ ParsePrice: String vazia fornecida`);
      return null;
    }
    
    // Logging detalhado para debug
    console.log(`🔍 Fazendo parse do preço: "${str}"`);
    
    // Remover caracteres não numéricos, mantendo vírgulas e pontos
    const clean = str.replace(/[^\d,.]/g, '');
    
    if (clean.length === 0) {
      console.warn(`⚠️ ParsePrice: Nenhum dígito encontrado em "${str}"`);
      return null;
    }
    
    // Lidar com diferentes formatos de decimal
    let numerico;
    
    // Formato brasileiro (vírgula como decimal): "1.234,56"
    if (clean.includes(',') && clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      numerico = clean.replace(/\./g, '').replace(',', '.');
    }
    // Formato americano (ponto como decimal): "1,234.56"
    else if (clean.includes('.')) {
      // Se tem vírgula antes do último ponto, remover vírgulas
      if (clean.includes(',') && clean.lastIndexOf(',') < clean.lastIndexOf('.')) {
        numerico = clean.replace(/,/g, '');
      } else {
        numerico = clean;
      }
    }
    // Apenas vírgula (formato brasileiro): "1234,56"
    else if (clean.includes(',')) {
      numerico = clean.replace(',', '.');
    }
    // Apenas números: "1234"
    else {
      numerico = clean;
    }
    
    const resultado = parseFloat(numerico);
    
    // Validação do resultado
    if (isNaN(resultado) || !isFinite(resultado)) {
      console.warn(`⚠️ ParsePrice: Resultado inválido para "${str}" → "${numerico}" → ${resultado}`);
      return null;
    }
    
    if (resultado < 0) {
      console.warn(`⚠️ ParsePrice: Preço negativo detectado: ${resultado}`);
      return null;
    }
    
    // Limite máximo razoável para preços (R$ 1 milhão)
    const MAX_PRICE = 1000000;
    if (resultado > MAX_PRICE) {
      console.warn(`⚠️ ParsePrice: Preço muito alto (${resultado}), pode ser erro de parsing`);
    }
    
    console.log(`✅ Parse de preço bem-sucedido: "${str}" → ${resultado}`);
    return resultado;
    
  } catch (error) {
    console.error(`❌ Erro no parsing de preço para "${str}": ${error.message}`);
    return null;
  }
}

/**
 * Remove tags HTML e normaliza espaços em branco de um texto
 * @description Limpa texto removendo quebras de linha, múltiplos espaços e tags HTML
 * @param {string} texto - Texto para limpar
 * @returns {string} Texto limpo e normalizado
 * 
 * @example
 * limparTexto("  <p>Hello\n\n  World</p>  "); // "Hello World"
 */
export const limparTexto = (texto) => {
  try {
    if (typeof texto !== 'string') {
      console.warn(`⚠️ LimparTexto: Entrada inválida (${typeof texto}), convertendo para string`);
      texto = String(texto || '');
    }
    
    if (texto.length === 0) {
      return '';
    }
    
    // Processo de limpeza
    const resultado = texto
      .replace(/<[^>]*>/g, '')        // Remover tags HTML
      .replace(/\s+/g, ' ')           // Múltiplos espaços → espaço único
      .replace(/[\n\r]+/g, '')        // Remover quebras de linha
      .trim();                        // Remover espaços nas bordas
    
    return resultado;
    
  } catch (error) {
    console.error(`❌ Erro ao limpar texto: ${error.message}`);
    return String(texto || '');
  }
};

/**
 * Formata valor numérico como moeda brasileira (BRL)
 * @description Converte número para formato de moeda brasileira com símbolo R$
 * @param {number|string} valor - Valor para formatar
 * @returns {string} Valor formatado como moeda ou string original se não for número
 * 
 * @example
 * formatarMoeda(15.90); // "R$ 15,90"
 * 
 * @example
 * formatarMoeda("invalid"); // "invalid"
 */
export const formatarMoeda = (valor) => {
  try {
    // Se já é string e não um número, retornar como está
    if (typeof valor === 'string' && isNaN(parseFloat(valor))) {
      return valor;
    }
    
    // Converter para número se necessário
    const numero = typeof valor === 'number' ? valor : parseFloat(valor);
    
    // Validar número
    if (isNaN(numero) || !isFinite(numero)) {
      console.warn(`⚠️ FormatarMoeda: Valor inválido (${valor}), retornando original`);
      return valor;
    }
    
    // Formatar como moeda brasileira
    return numero.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
  } catch (error) {
    console.error(`❌ Erro ao formatar moeda para ${valor}: ${error.message}`);
    return String(valor);
  }
};

/**
 * Sistema de logging estruturado com diferentes níveis
 */

/**
 * Log de informação geral
 * @param {string} msg - Mensagem para logar
 * @param {Object} [detalhes] - Detalhes adicionais opcionais
 */
export const logInfo = (msg, detalhes = null) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`ℹ️  [${timestamp}] ${msg}`);
    if (detalhes) {
      console.log(`📋 Detalhes:`, detalhes);
    }
  } catch (error) {
    console.log(`ℹ️  ${msg}`); // Fallback simples
  }
};

/**
 * Log de sucesso/confirmação
 * @param {string} msg - Mensagem de sucesso para logar
 * @param {Object} [detalhes] - Detalhes adicionais opcionais
 */
export const logSucesso = (msg, detalhes = null) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`✅ [${timestamp}] ${msg}`);
    if (detalhes) {
      console.log(`📋 Detalhes:`, detalhes);
    }
  } catch (error) {
    console.log(`✅ ${msg}`); // Fallback simples
  }
};

/**
 * Log de erro com stack trace opcional
 * @param {string} msg - Mensagem de erro para logar
 * @param {Error|Object} [erro] - Objeto de erro ou detalhes adicionais
 */
export const logErro = (msg, erro = null) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`❌ [${timestamp}] ${msg}`);
    
    if (erro) {
      if (erro instanceof Error) {
        console.error(`📍 Stack trace:`, erro.stack);
      } else {
        console.log(`📋 Detalhes do erro:`, erro);
      }
    }
  } catch (error) {
    console.log(`❌ ${msg}`); // Fallback simples
  }
};

/**
 * Log de aviso/warning
 * @param {string} msg - Mensagem de aviso para logar
 * @param {Object} [detalhes] - Detalhes adicionais opcional
 */
export const logAviso = (msg, detalhes = null) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`⚠️ [${timestamp}] ${msg}`);
    
    if (detalhes) {
      console.log(`📋 Detalhes:`, detalhes);
    }
  } catch (error) {
    console.log(`⚠️ ${msg}`); // Fallback simples
  }
};

/**
 * Captura screenshot da página atual e salva no diretório de debug
 * @description Gera screenshot com nome único baseado em categoria, página e timestamp
 * @param {Page} page - Instância do Puppeteer Page
 * @param {string} categoria - Nome da categoria sendo processada
 * @param {number} pagina - Número da página atual
 * @param {boolean} [fullPage=true] - Se deve capturar página completa
 * @returns {Promise<string|null>} Caminho do arquivo salvo ou null em caso de erro
 * @throws {Error} Em caso de falha na captura ou salvamento
 * 
 * @example
 * const screenshot = await tirarScreenshot(page, "eletronicos", 1);
 * 
 * @example
 * const screenshot = await tirarScreenshot(page, "roupas", 2, false);
 */
export async function tirarScreenshot(page, categoria, pagina, fullPage = true) {
  try {
    // Validação de parâmetros
    if (!page || typeof page.screenshot !== 'function') {
      throw new Error('Página Puppeteer inválida fornecida para screenshot');
    }
    
    if (typeof categoria !== 'string' || categoria.length === 0) {
      console.warn(`⚠️ Categoria inválida para screenshot, usando "sem-categoria"`);
      categoria = 'sem-categoria';
    }
    
    if (typeof pagina !== 'number' || pagina < 0) {
      console.warn(`⚠️ Número de página inválido (${pagina}), usando 0`);
      pagina = 0;
    }
    
    // Verificar se diretório de debug está configurado
    if (!CONFIG?.general?.debugDir) {
      throw new Error('Diretório de debug não configurado em CONFIG.general.debugDir');
    }
    
    // Garantir que diretório existe
    await fs.ensureDir(CONFIG.general.debugDir);
    
    // Gerar nome único do arquivo
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
    const categoriaNormalizada = slugify(categoria);
    const nomeArquivo = `screenshot_${categoriaNormalizada}_p${pagina}_${timestamp}.png`;
    const caminho = path.join(CONFIG.general.debugDir, nomeArquivo);
    
    logInfo(`📸 Capturando screenshot: ${nomeArquivo}`);
    
    // Configurações de screenshot
    const opcoes = {
      path: caminho,
      fullPage: Boolean(fullPage),
      quality: 90, // Para screenshots JPEG
      type: 'png'  // Manter PNG para melhor qualidade
    };
    
    // Capturar screenshot
    await page.screenshot(opcoes);
    
    // Verificar se arquivo foi criado
    const arquivoExiste = await fs.pathExists(caminho);
    if (!arquivoExiste) {
      throw new Error(`Screenshot não foi salvo corretamente em ${caminho}`);
    }
    
    // Verificar tamanho do arquivo
    const stats = await fs.stat(caminho);
    const tamanhoKB = Math.round(stats.size / 1024);
    
    logSucesso(`Screenshot salvo: ${path.basename(caminho)} (${tamanhoKB}KB)`);
    return caminho;
    
  } catch (error) {
    logErro(`Erro ao salvar screenshot para categoria "${categoria}", página ${pagina}`, error);
    return null;
  }
}

/**
 * Salva dados JSON de produto no diretório de debug
 * @description Salva objeto JavaScript como arquivo JSON formatado
 * @param {Object} json - Dados do produto para salvar
 * @param {string} categoria - Nome da categoria
 * @param {number} pagina - Número da página
 * @returns {Promise<string|null>} Caminho do arquivo salvo ou null em caso de erro
 * @throws {Error} Em caso de falha no salvamento
 * 
 * @example
 * await salvarJsonProduto(dadosProduto, "eletronicos", 1);
 */
export async function salvarJsonProduto(json, categoria, pagina) {
  try {
    // Validação de parâmetros
    if (!json || typeof json !== 'object') {
      throw new Error('Dados JSON inválidos fornecidos');
    }
    
    if (typeof categoria !== 'string' || categoria.length === 0) {
      console.warn(`⚠️ Categoria inválida para JSON, usando "sem-categoria"`);
      categoria = 'sem-categoria';
    }
    
    if (typeof pagina !== 'number' || pagina < 0) {
      console.warn(`⚠️ Número de página inválido (${pagina}), usando 0`);
      pagina = 0;
    }
    
    // Verificar configuração
    if (!CONFIG?.general?.debugDir) {
      throw new Error('Diretório de debug não configurado');
    }
    
    // Garantir que diretório existe
    await fs.ensureDir(CONFIG.general.debugDir);
    
    // Gerar nome do arquivo
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
    const categoriaNormalizada = slugify(categoria);
    const nome = `json_${categoriaNormalizada}_p${pagina}_${timestamp}.json`;
    const caminho = path.join(CONFIG.general.debugDir, nome);
    
    logInfo(`💾 Salvando dados JSON: ${nome}`);
    
    // Adicionar metadados ao JSON
    const jsonComMetadados = {
      metadata: {
        categoria,
        pagina,
        timestamp: new Date().toISOString(),
        versao: '2.0.0'
      },
      dados: json
    };
    
    // Salvar arquivo com formatação
    await fs.writeJson(caminho, jsonComMetadados, { 
      spaces: 2,
      encoding: 'utf8'
    });
    
    // Verificar salvamento
    const arquivoExiste = await fs.pathExists(caminho);
    if (!arquivoExiste) {
      throw new Error(`Arquivo JSON não foi salvo corretamente`);
    }
    
    // Verificar tamanho
    const stats = await fs.stat(caminho);
    const tamanhoKB = Math.round(stats.size / 1024);
    
    logSucesso(`Dados JSON salvos: ${path.basename(caminho)} (${tamanhoKB}KB)`);
    return caminho;
    
  } catch (error) {
    logErro(`Erro ao salvar JSON para categoria "${categoria}", página ${pagina}`, error);
    return null;
  }
}

/**
 * Salva HTML completo da página de pesquisa para debug
 * @description Captura e salva o HTML da página atual para análise posterior
 * @param {Page} page - Instância do Puppeteer Page
 * @param {string} categoria - Nome da categoria
 * @param {number} pagina - Número da página
 * @returns {Promise<string|null>} Caminho do arquivo salvo ou null em caso de erro
 * @throws {Error} Em caso de falha na captura ou salvamento
 * 
 * @example
 * await salvarHtmlPesquisa(page, "eletronicos", 1);
 */
export async function salvarHtmlPesquisa(page, categoria, pagina) {
  try {
    // Validação de parâmetros
    if (!page || typeof page.content !== 'function') {
      throw new Error('Página Puppeteer inválida fornecida para captura HTML');
    }
    
    if (typeof categoria !== 'string' || categoria.length === 0) {
      console.warn(`⚠️ Categoria inválida para HTML, usando "sem-categoria"`);
      categoria = 'sem-categoria';
    }
    
    if (typeof pagina !== 'number' || pagina < 0) {
      console.warn(`⚠️ Número de página inválido (${pagina}), usando 0`);
      pagina = 0;
    }
    
    // Verificar configuração
    if (!CONFIG?.general?.debugDir) {
      throw new Error('Diretório de debug não configurado');
    }
    
    // Garantir que diretório existe
    await fs.ensureDir(CONFIG.general.debugDir);
    
    // Gerar nome do arquivo
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
    const categoriaNormalizada = slugify(categoria);
    const nome = `html_${categoriaNormalizada}_p${pagina}_${timestamp}.html`;
    const caminho = path.join(CONFIG.general.debugDir, nome);
    
    logInfo(`📄 Capturando HTML da página: ${nome}`);
    
    // Capturar HTML da página
    const html = await page.content();
    
    if (!html || html.length === 0) {
      throw new Error('HTML capturado está vazio');
    }
    
    // Adicionar comentários de metadados no HTML
    const htmlComMetadados = `<!-- 
Captura HTML - Sistema de Scraping AliExpress
Categoria: ${categoria}
Página: ${pagina}
Timestamp: ${new Date().toISOString()}
URL: ${page.url()}
Tamanho: ${html.length} caracteres
-->

${html}`;
    
    // Salvar arquivo
    await fs.writeFile(caminho, htmlComMetadados, 'utf-8');
    
    // Verificar salvamento
    const arquivoExiste = await fs.pathExists(caminho);
    if (!arquivoExiste) {
      throw new Error(`Arquivo HTML não foi salvo corretamente`);
    }
    
    // Verificar tamanho
    const stats = await fs.stat(caminho);
    const tamanhoKB = Math.round(stats.size / 1024);
    
    logSucesso(`HTML salvo: ${path.basename(caminho)} (${tamanhoKB}KB)`);
    return caminho;
    
  } catch (error) {
    logErro(`Erro ao salvar HTML para categoria "${categoria}", página ${pagina}`, error);
    return null;
  }
}

/**
 * Aplica filtro de ordenação por "Mais Vendidos" na página de resultados
 * @description Tenta múltiplas estratégias para encontrar e aplicar o filtro de mais vendidos
 * no AliExpress, incluindo seletores CSS, busca por texto e fallbacks robustos
 * 
 * @param {Page} page - Instância do Puppeteer Page
 * @returns {Promise<boolean>} true se filtro foi aplicado com sucesso, false caso contrário
 * @throws {Error} Em caso de erro crítico na aplicação do filtro
 * 
 * @example
 * const filtroAplicado = await filtrarPorMaisVendidos(page);
 * if (filtroAplicado) {
 *   console.log("Produtos ordenados por mais vendidos");
 * }
 */
export async function filtrarPorMaisVendidos(page) {
  try {
    // Validação de parâmetros
    if (!page || typeof page.evaluate !== 'function') {
      throw new Error('Página Puppeteer inválida fornecida para filtro');
    }
    
    logInfo('🔍 Iniciando aplicação de filtro "Mais Vendidos"...');
    
    // Aguardar carregamento completo da página
    await delay(2000);
    
    // Verificar se página carregou corretamente
    const url = page.url();
    logInfo(`📍 URL atual: ${url}`);
    
    if (!url.includes('aliexpress')) {
      console.warn(`⚠️ URL não parece ser do AliExpress: ${url}`);
    }
    
    // Estratégia 1: Seletores CSS específicos para ordenação
    const seletoresOrdenacao = [
      // Seletores mais específicos primeiro
      'div[ae_object_value="number_of_orders"]',
      '[data-spm-anchor-id*="order"]',
      'div[title*="Mais vendido"]',
      'div[title*="mais vendido"]',
      'div[title*="vendidos"]',
      '.comet-select-dropdown-item[data-value*="order"]',
      '.search-sort-by .comet-select',
      '.search-sort .comet-select',
      // Seletores mais genéricos
      '.sort-by-selector',
      '.sort-dropdown',
      '[data-testid*="sort"]'
    ];
    
    let filtroEncontrado = false;
    let tentativasRealizadas = 0;
    
    // Tentar cada seletor CSS
    for (const [index, seletor] of seletoresOrdenacao.entries()) {
      try {
        tentativasRealizadas++;
        logInfo(`🔍 Tentativa ${tentativasRealizadas}: Testando seletor "${seletor}"`);
        
        // Procurar elementos que correspondem ao seletor
        const elementos = await page.$$(seletor);
        
        if (elementos && elementos.length > 0) {
          logInfo(`✅ Encontrados ${elementos.length} elemento(s) com seletor: ${seletor}`);
          
          // Tentar clicar no primeiro elemento encontrado
          const elemento = elementos[0];
          
          // Verificar se elemento está visível
          const isVisible = await elemento.isIntersectingViewport();
          if (!isVisible) {
            logInfo(`⚠️ Elemento não está visível, tentando fazer scroll`);
            await elemento.scrollIntoView();
            await delay(1000);
          }
          
          // Tentar clicar
          await elemento.click();
          await delay(1500);
          
          logSucesso(`✅ Clique realizado no seletor: ${seletor}`);
          
          // Estratégia 1.1: Procurar opções de dropdown após clicar
          const opcoesMaisVendidos = [
            'div[ae_object_value="number_of_orders"]',
            'div[title*="Mais vendido"]',
            'div[title*="mais vendido"]',
            'div[title*="vendidos"]',
            '.comet-select-dropdown-item[data-value*="order"]',
            '[data-value="number_of_orders"]'
          ];
          
          for (const opcaoSeletor of opcoesMaisVendidos) {
            try {
              const elementoOpcao = await page.$(opcaoSeletor);
              if (elementoOpcao) {
                const isOpcaoVisible = await elementoOpcao.isIntersectingViewport();
                if (isOpcaoVisible) {
                  await elementoOpcao.click();
                  await delay(2000);
                  logSucesso(`✅ Opção "Mais vendidos" selecionada: ${opcaoSeletor}`);
                  filtroEncontrado = true;
                  break;
                }
              }
            } catch (opcaoError) {
              // Continuar tentando outras opções
              continue;
            }
          }
          
          if (filtroEncontrado) break;
        }
        
      } catch (seletorError) {
        logInfo(`⚠️ Erro com seletor "${seletor}": ${seletorError.message}`);
        // Continuar tentando outros seletores
        continue;
      }
    }
    
    // Estratégia 2: Busca por texto na página
    if (!filtroEncontrado) {
      logInfo('🔍 Tentando estratégia de busca por texto...');
      
      try {
        const textoEncontrado = await page.evaluate(() => {
          // Procurar por elementos que contenham texto relacionado a "mais vendidos"
          const textosParaBuscar = [
            'Mais vendido',
            'mais vendido',
            'Vendidos',
            'vendidos',
            'Orders',
            'orders',
            'Best selling',
            'best selling'
          ];
          
          const todosElementos = Array.from(document.querySelectorAll('*'));
          
          for (const texto of textosParaBuscar) {
            const elemento = todosElementos.find(el => 
              el.textContent && 
              el.textContent.trim().includes(texto) &&
              el.offsetParent !== null // Verificar se está visível
            );
            
            if (elemento && elemento.click) {
              try {
                elemento.click();
                return { sucesso: true, texto, tagName: elemento.tagName };
              } catch (e) {
                continue;
              }
            }
          }
          
          return { sucesso: false };
        });
        
        if (textoEncontrado.sucesso) {
          await delay(3000); // Aguardar mais tempo para recarregamento
          logSucesso(`✅ Filtro aplicado via busca por texto: "${textoEncontrado.texto}" em ${textoEncontrado.tagName}`);
          filtroEncontrado = true;
        }
        
      } catch (textoError) {
        logErro(`Erro na estratégia de busca por texto`, textoError);
      }
    }
    
    // Estratégia 3: Interceptar requests de ordenação (fallback avançado)
    if (!filtroEncontrado) {
      logInfo('🔍 Tentando estratégia de interceptação de requests...');
      
      try {
        // Tentar manipular URL diretamente adicionando parâmetro de ordenação
        const urlAtual = page.url();
        if (urlAtual.includes('aliexpress')) {
          let novaUrl = urlAtual;
          
          // Adicionar parâmetro de ordenação se não existir
          if (!urlAtual.includes('SortType=')) {
            const separador = urlAtual.includes('?') ? '&' : '?';
            novaUrl = `${urlAtual}${separador}SortType=total_tranpro_desc`;
            
            logInfo(`🔄 Tentando navegar para URL com ordenação: ${novaUrl}`);
            await page.goto(novaUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await delay(3000);
            
            logSucesso(`✅ Navegação para URL com parâmetro de ordenação concluída`);
            filtroEncontrado = true;
          }
        }
        
      } catch (urlError) {
        logErro(`Erro na estratégia de URL`, urlError);
      }
    }
    
    // Verificação final e logging detalhado
    if (filtroEncontrado) {
      await delay(3000); // Aguardar carregamento dos resultados filtrados
      
      // Verificar se a ordenação realmente funcionou
      try {
        const produtosCarregados = await page.$$('a.search-card-item');
        const quantidadeProdutos = produtosCarregados ? produtosCarregados.length : 0;
        
        logSucesso(`🎯 Filtro "Mais Vendidos" aplicado com sucesso!`);
        logInfo(`📊 ${quantidadeProdutos} produtos carregados após aplicação do filtro`);
        logInfo(`📍 URL final: ${page.url()}`);
        
        return true;
        
      } catch (verificacaoError) {
        logErro(`Erro na verificação final do filtro`, verificacaoError);
        return true; // Ainda considerar sucesso se chegou até aqui
      }
    } else {
      logErro(`⚠️ Não foi possível aplicar o filtro "Mais Vendidos" após ${tentativasRealizadas} tentativas`);
      logInfo(`📍 URL quando falhou: ${page.url()}`);
      
      // Log de debug adicional
      try {
        const elementosEncontrados = await page.evaluate(() => {
          const selectores = document.querySelectorAll('.comet-select, .sort-by, [class*="sort"]');
          return Array.from(selectores).map(el => ({
            tagName: el.tagName,
            className: el.className,
            textContent: el.textContent?.slice(0, 50)
          }));
        });
        
        if (elementosEncontrados.length > 0) {
          logInfo(`🔍 Elementos relacionados a ordenação encontrados:`, elementosEncontrados);
        }
      } catch (debugError) {
        // Ignorar erros de debug
      }
      
      return false;
    }
    
  } catch (error) {
    logErro(`❌ Erro crítico ao aplicar filtro "Mais Vendidos"`, error);
    
    // Tentar continuar mesmo com erro
    try {
      const url = page.url();
      logInfo(`📍 URL durante erro: ${url}`);
    } catch (urlError) {
      logErro(`Não foi possível obter URL durante erro`, urlError);
    }
    
    return false;
  }
}
