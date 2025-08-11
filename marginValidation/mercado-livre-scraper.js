/**
 * @fileoverview Busca real de produtos no Mercado Livre com comparação visual
 * @description Implementa busca real no Mercado Livre usando axios/cheerio + comparação visual
 * com tratamento robusto de exceções e integração com sistema de tradução
 * 
 * @author Sistema de Scraping AliExpress - Busca ML v2.0
 * @version 2.0.0 - Versão otimizada com comparação visual
 * @since 2024-01-01
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as cheerio from 'cheerio';
import { compararImagensPorHash } from '../utils/comparador-imagens.js';
import { produtosSaoCompativeis } from '../utils/comparador-produtos.js';
import { calcularRiscoProduto, determinarMetodoValidacao, permiteValidacaoTextual } from '../utils/calculadora-risco.js';
import { compararSemantica, analisarProdutosSemantico, calcularEstatisticasPreco, calcularDesvioPreco } from '../utils/analisador-semantico.js';

// 🛡 Melhoria 2: Configurar retry automático para falhas de rede
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.response?.status === 429 || 
           error.response?.status >= 500;
  }
});

// Busca os top 3 produtos no ML e retorna o mais parecido visualmente
export async function buscarMelhorProdutoML(produtoAli) {
  const termosBusca = gerarTermosDeBusca(produtoAli.nomeTraduzido || produtoAli.nome);
  const url = `https://lista.mercadolivre.com.br/${encodeURIComponent(termosBusca)}`;
  
  try {
    // 🛡 Melhoria 2: Configurações robustas para requisições
    const { data } = await axios.get(url, { 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });
    const $ = cheerio.load(data);
    const itens = [];

    $('li.ui-search-layout__item').slice(0, 5).each((i, el) => {
      const nome = $(el).find('h2').text().trim();
      const precoTxt = $(el).find('.ui-search-price__second-line .price-tag-fraction').first().text();
      const imagem = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      const link = $(el).find('a').attr('href');
      const preco = parseFloat(precoTxt.replace('.', '').replace(',', '.'));
      if (nome && preco && imagem) {
        itens.push({ nome, preco, imagem, link });
      }
    });

    let melhorProduto = null;
    let maiorSimilaridade = 0;
    const top3Produtos = []; // 📦 Melhoria 1: Salvar top 3 produtos

    for (const item of itens) {
      try {
        const comp = await compararImagensPorHash(produtoAli.imagemURL, item.imagem);
        const produtoComSimilaridade = { 
          ...item, 
          similaridade: comp.similaridade,
          imagemComparada: true,
          fonteDeVerificacao: 'imagem',
          riscoImagem: false
        };
        
        // Adicionar ao array de top 3
        top3Produtos.push(produtoComSimilaridade);
        
        if (comp.similar && comp.similaridade > maiorSimilaridade) {
          maiorSimilaridade = comp.similaridade;
          melhorProduto = produtoComSimilaridade;
        }
      } catch (e) {
        console.warn('Erro na comparação de imagem:', e.message);
        // Adicionar mesmo sem comparação visual
        top3Produtos.push({ 
          ...item, 
          similaridade: 0,
          imagemComparada: false,
          fonteDeVerificacao: 'erro',
          riscoImagem: true
        });
      }
    }

    // 🎯 FALLBACK TEXTUAL + SEMÂNTICO - Sugestão do ChatGPT aprimorada
    // Se não encontrou match por imagem, tentar verificação semântica
    if (!melhorProduto && itens.length > 0) {
      console.log('🔍 Nenhum match por imagem encontrado. Tentando análise semântica...');
      
      // Calcular estatísticas de preço dos top 3 (ChatGPT)
      const top3 = itens.slice(0, 3);
      const estatisticasPreco = calcularEstatisticasPreco(top3);
      
      console.log(`📊 Preço médio ML (top 3): R$ ${estatisticasPreco.precoMedioML}`);
      
      // Análise semântica dos produtos
      const analiseSemantica = await analisarProdutosSemantico(produtoAli, itens);
      
      if (analiseSemantica.melhorMatch && analiseSemantica.scoreSemantico >= 70) {
        console.log(`🧠 Match semântico encontrado: Score ${analiseSemantica.scoreSemantico}%`);
        
        const produtoSelecionado = analiseSemantica.melhorMatch;
        const desvioPreco = calcularDesvioPreco(produtoSelecionado.preco, produtoAli.preco);
        
        // Verificar se desvio de preço é aceitável (ChatGPT)
        if (desvioPreco <= 250) {
          console.log(`✅ Desvio de preço aceitável: ${desvioPreco}%`);
          
          // Criar dados para análise de risco com novos campos
          const dadosParaRisco = {
            ...produtoAli,
            imagem_comparada: false,
            imagem_match: false,
            score_imagem: 0,
            score_semantico: analiseSemantica.scoreSemantico,
            score_texto: analiseSemantica.scoreSemantico, // Compatibilidade
            match_por_texto: true,
            aprovado_fallback_texto: true,
            desvio_preco: desvioPreco,
            preco_medio_ml: estatisticasPreco.precoMedioML,
            metodo_analise_titulo: analiseSemantica.metodoUsado,
            fonte_de_verificacao: 'semantico'
          };
          
          // Calcular risco final
          const analiseRisco = calcularRiscoProduto(dadosParaRisco);
          const metodoValidacao = determinarMetodoValidacao(dadosParaRisco);
          
          melhorProduto = {
            ...produtoSelecionado,
            similaridade: analiseSemantica.scoreSemantico,
            // Campos de controle de qualidade expandidos (ChatGPT)
            imagemComparada: false,
            fonteDeVerificacao: 'semantico',
            riscoImagem: true,
            metodoValidacaoMargem: metodoValidacao,
            scoreImagem: 0,
            imagemMatch: false,
            scoreTexto: analiseSemantica.scoreSemantico,
            scoreSemantico: analiseSemantica.scoreSemantico,
            matchPorTexto: true,
            aprovadoFallbackTexto: true,
            riscoFinal: analiseRisco.riscoFinal,
            pendenteRevisao: analiseRisco.pendenteRevisao,
            desvioPreco: desvioPreco,
            precoMedioML: estatisticasPreco.precoMedioML,
            metodoAnaliseTitulo: analiseSemantica.metodoUsado,
            
            // Dados de compatibilidade expandidos
            compatibilidadeTextual: {
              score: analiseSemantica.scoreSemantico,
              motivo: analiseSemantica.analiseCompleta?.motivo || 'Análise semântica',
              detalhesRisco: analiseRisco.detalhesRisco,
              classificacao: analiseRisco.classificacaoRisco,
              metodoAnalise: analiseSemantica.metodoUsado,
              estatisticasPreco: estatisticasPreco
            }
          };
          
          console.log(`✅ Produto aprovado via análise semântica`);
          console.log(`⚠️ Risco: ${analiseRisco.classificacaoRisco} (${analiseRisco.riscoFinal}%)`);
          
        } else {
          console.log(`❌ Desvio de preço muito alto: ${desvioPreco}% (máximo 250%)`);
        }
      } else if (analiseSemantica.scoreSemantico > 0) {
        console.log(`❌ Score semântico insuficiente: ${analiseSemantica.scoreSemantico}% (mínimo 70%)`);
      }
      
      // Fallback para análise textual tradicional se semântica falhar
      if (!melhorProduto) {
        console.log('🔄 Tentando fallback textual tradicional...');
        
        let melhorCompatibilidade = null;
        let maiorScore = 0;

        for (const item of itens) {
          try {
            // Verificar se categoria permite fallback textual
            if (!permiteValidacaoTextual(produtoAli)) {
              console.log('❌ Categoria não permite fallback textual');
              continue;
            }
            
            // Verificar compatibilidade textual
            const compatibilidade = produtosSaoCompativeis(produtoAli, {
              nome: item.nome,
              preco: item.preco
            });

            if (compatibilidade.compatível && compatibilidade.score >= 60) {
              const desvioPreco = calcularDesvioPreco(item.preco, produtoAli.preco);
              
              // Validar desvio de preço (ChatGPT)
              if (desvioPreco <= 250 && compatibilidade.score > maiorScore) {
                maiorScore = compatibilidade.score;
                
                // Criar dados para análise de risco
                const dadosParaRisco = {
                  ...produtoAli,
                  imagem_comparada: false,
                  imagem_match: false,
                  score_imagem: 0,
                  score_texto: compatibilidade.score,
                  match_por_texto: true,
                  aprovado_fallback_texto: true,
                  desvio_preco: desvioPreco,
                  preco_medio_ml: estatisticasPreco.precoMedioML,
                  metodo_analise_titulo: 'textual_fallback',
                  fonte_de_verificacao: 'texto'
                };
                
                // Calcular risco
                const analiseRisco = calcularRiscoProduto(dadosParaRisco);
                const metodoValidacao = determinarMetodoValidacao(dadosParaRisco);
                
                melhorCompatibilidade = {
                  ...item,
                  similaridade: compatibilidade.score,
                  // Campos de controle de qualidade expandidos
                  imagemComparada: false,
                  fonteDeVerificacao: 'texto',
                  riscoImagem: true,
                  metodoValidacaoMargem: metodoValidacao,
                  scoreImagem: 0,
                  imagemMatch: false,
                  scoreTexto: compatibilidade.score,
                  scoreSemantico: 0,
                  matchPorTexto: true,
                  aprovadoFallbackTexto: true,
                  riscoFinal: analiseRisco.riscoFinal,
                  pendenteRevisao: analiseRisco.pendenteRevisao,
                  desvioPreco: desvioPreco,
                  precoMedioML: estatisticasPreco.precoMedioML,
                  metodoAnaliseTitulo: 'textual_fallback',
                  
                  // Dados de compatibilidade expandidos
                  compatibilidadeTextual: {
                    ...compatibilidade,
                    detalhesRisco: analiseRisco.detalhesRisco,
                    classificacao: analiseRisco.classificacaoRisco,
                    estatisticasPreco: estatisticasPreco
                  }
                };
              }
            }
          } catch (compatError) {
            console.warn('Erro na verificação de compatibilidade:', compatError.message);
          }
        }

        if (melhorCompatibilidade) {
          melhorProduto = melhorCompatibilidade;
          console.log(`✅ Fallback textual encontrou match: "${melhorProduto.nome}" (Score: ${maiorScore}%)`);
          console.log(`⚠️ ATENÇÃO: Produto marcado com risco para revisão`);
        } else {
          console.log('❌ Nenhum produto compatível encontrado (imagem, semântica ou textual)');
        }
      }
    }

    // Ordenar top 3 por similaridade
    top3Produtos.sort((a, b) => b.similaridade - a.similaridade);
    const top3Final = top3Produtos.slice(0, 3);

    return { 
      melhorProduto, 
      mlTop3Produtos: top3Final, // 📦 Dados brutos dos top 3
      totalEncontrados: itens.length 
    };

  } catch (err) {
    console.error('Erro ao buscar ML:', err.message);
    return null;
  }
}

// Manter compatibilidade com a função original
export async function buscarProdutosCompativeisML(browser, produtoAliExpress, opcoes = {}) {
  console.log('🔄 Usando nova implementação de busca ML com axios/cheerio...');
  
  try {
    // Extrair primeira imagem do produto AliExpress
    const imagemURL = Array.isArray(produtoAliExpress.imagens) && produtoAliExpress.imagens.length > 0
      ? produtoAliExpress.imagens[0]
      : produtoAliExpress.imagemURL || null;

    if (!imagemURL) {
      console.warn('⚠️ Produto sem imagem para comparação visual');
      return {
        encontrouProdutos: false,
        produtosCompatíveis: [],
        melhorMatch: null,
        erro: 'Sem imagem para comparação'
      };
    }

    // Criar objeto produto compatível com a nova função
    const produtoParaBusca = {
      nome: produtoAliExpress.nome,
      nomeTraduzido: produtoAliExpress.nomeTraduzido || produtoAliExpress.nome,
      imagemURL: imagemURL
    };

    const melhorProduto = await buscarMelhorProdutoML(produtoParaBusca);

    if (melhorProduto && melhorProduto.melhorProduto) {
      return {
        encontrouProdutos: true,
        produtosCompatíveis: melhorProduto.mlTop3Produtos || [],
        melhorMatch: melhorProduto.melhorProduto,
        totalEncontrados: melhorProduto.totalEncontrados || 0,
        termoBusca: gerarTermosDeBusca(produtoParaBusca.nomeTraduzido || produtoParaBusca.nome),
        erro: null
      };
    } else {
      return {
        encontrouProdutos: false,
        produtosCompatíveis: [],
        melhorMatch: null,
        totalEncontrados: 0,
        termoBusca: gerarTermosDeBusca(produtoParaBusca.nomeTraduzido || produtoParaBusca.nome),
        erro: 'Nenhum produto compatível encontrado'
      };
    }

  } catch (error) {
    console.error('❌ Erro na busca ML:', error.message);
    return {
      encontrouProdutos: false,
      produtosCompatíveis: [],
      melhorMatch: null,
      erro: error.message
    };
  }
}

// Função legacy mantida por compatibilidade
export async function buscarProdutosMercadoLivre(browser, termoBusca, opcoes = {}) {
  console.log('🔄 Redirecionando para nova implementação...');
  
  const produtoFake = {
    nome: termoBusca,
    nomeTraduzido: termoBusca,
    imagemURL: null // Será tratado como sem imagem
  };

  const resultado = await buscarMelhorProdutoML(produtoFake);
  
  return {
    produtos: resultado ? [resultado] : [],
    termoBusca: termoBusca,
    paginaAtual: 1,
    totalProdutos: resultado ? 1 : 0
  };
}
