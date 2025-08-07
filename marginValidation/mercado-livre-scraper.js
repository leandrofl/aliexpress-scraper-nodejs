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
import { gerarTermosDeBusca, produtosSaoCompativeis } from '../utils/comparador-produtos.js';

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

    // 🎯 FALLBACK TEXTUAL - Sugestão do ChatGPT
    // Se não encontrou match por imagem, tentar verificação textual
    if (!melhorProduto && itens.length > 0) {
      console.log('🔍 Nenhum match por imagem encontrado. Tentando fallback textual...');
      
      let melhorCompatibilidade = null;
      let maiorScore = 0;

      for (const item of itens) {
        try {
          // Verificar compatibilidade textual
          const compatibilidade = produtosSaoCompativeis(produtoAli, {
            nome: item.nome,
            preco: item.preco
          });

          if (compatibilidade.compatível && compatibilidade.score >= 60) {
            // Verificar se preço está em faixa segura (2x a 5x do preço original)
            const ratioPreco = item.preco / produtoAli.preco;
            
            if (ratioPreco >= 2 && ratioPreco <= 5 && compatibilidade.score > maiorScore) {
              maiorScore = compatibilidade.score;
              melhorCompatibilidade = {
                ...item,
                similaridade: compatibilidade.score,
                imagemComparada: false,
                fonteDeVerificacao: 'texto',
                riscoImagem: true,
                compatibilidadeTextual: compatibilidade,
                ratioPreco: ratioPreco
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
        console.log(`⚠️ ATENÇÃO: Produto marcado com risco de imagem para revisão`);
      } else {
        console.log('❌ Nenhum produto compatível encontrado nem por imagem nem por texto');
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
