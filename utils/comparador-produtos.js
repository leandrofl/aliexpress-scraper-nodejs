/**
 * @fileoverview Comparador Inteligente de Produtos AliExpress ↔ Mercado Livre
 * @description Sistema otimizado com melhorias do ChatGPT para:
 * - Geração de termos de busca limpos
 * - Comparação inteligente de produtos
 * - Integração com sistema de tradução
 * 
 * @author Sistema de Scraping - Versão ChatGPT v2.0
 * @version 2.0.0
 * @since 2024-01-01
 */

import { logInfo, logSucesso, logErro, logAviso, limparTexto, slugify } from '../scraper/utils.js';
import { compararImagensPorHash } from './comparador-imagens.js';
import { processarNomeProduto, obterTermoBusca } from './tradutor-produtos.js';

// Gera um termo de busca limpo para busca no ML a partir do nome traduzido
export function gerarTermosDeBusca(nome) {
  const blacklist = ['frete', 'grátis', 'novo', '2023', '2024', 'oferta', 'produto', 'original', 'promoção', 'para', 'de', 'com', 'sem', 'e', 'o', 'a'];
  return slugify(nome || '')
    .split('-')
    .filter(p => p.length > 2 && !blacklist.includes(p))
    .slice(0, 6)
    .join(' ');
}

// Verifica compatibilidade entre produtos Ali e ML
export function produtosSaoCompativeis(prodAli, prodML) {
  const slugAli = gerarTermosDeBusca(prodAli.nomeTraduzido || prodAli.nome);
  const slugML = gerarTermosDeBusca(prodML.nome || prodML.titulo);

  const termosAli = slugAli.split(' ');
  const termosML = slugML.split(' ');

  const intersecao = termosAli.filter(t => termosML.includes(t));
  const cobertura = intersecao.length / termosAli.length;

  const precoAli = parseFloat(prodAli.precoBRL || prodAli.preco || 0);
  const precoML = parseFloat(prodML.preco || prodML.precoNumerico || 0);
  const precoOk = precoML > precoAli * 1.5 && precoML < precoAli * 5;

  return {
    compatível: cobertura >= 0.6 && precoOk,
    score: Math.round(cobertura * 100),
    precoAli,
    precoML,
    termosAli,
    termosML,
    intersecao
  };
}

// Função legada mantida para compatibilidade
export async function gerarTermoBuscaML(nomeAliExpress, opcoes = {}) {
    try {
        logInfo(`🎯 Gerando termo de busca ML para: "${nomeAliExpress}"`);
        
        const config = {
            usarTraducao: true,
            usarFallback: true,
            logDetalhado: false,
            ...opcoes
        };

        if (config.usarTraducao) {
            try {
                // Usar o novo sistema de tradução
                const resultado = await processarNomeProduto(nomeAliExpress);
                
                if (resultado.processamento.sucessoTraducao) {
                    const termoOtimizado = gerarTermosDeBusca(resultado.nomePortugues);
                    
                    if (config.logDetalhado) {
                        logSucesso(`✅ Termo gerado com tradução:`);
                        logInfo(`   📝 Original: "${nomeAliExpress}"`);
                        logInfo(`   🌐 Português: "${resultado.nomePortugues}"`);
                        logInfo(`   🔍 Termo: "${termoOtimizado}"`);
                    }
                    
                    return termoOtimizado;
                } else {
                    logAviso(`⚠️ Falha na tradução, usando fallback`);
                }
                
            } catch (traducaoError) {
                logErro(`❌ Erro na tradução: ${traducaoError.message}`);
            }
        }

        // Fallback: usar geração direta
        if (config.usarFallback) {
            logInfo(`🔄 Usando geração de termo fallback`);
            return gerarTermosDeBusca(nomeAliExpress);
        }

        return '';

    } catch (error) {
        logErro(`❌ Erro ao gerar termo de busca ML: ${error.message}`);
        return gerarTermosDeBusca(nomeAliExpress); // Fallback final
    }
}

// Função legada para compatibilidade com sistema antigo
export async function compararProdutosComImagens(produtoAliExpress, produtosML, opcoes = {}) {
    try {
        logInfo(`🖼️ Comparando produto AliExpress com ${produtosML.length} produtos ML`);
        
        const resultados = [];
        
        for (const produtoML of produtosML) {
            try {
                // Usar a nova função de comparação
                const compatibilidade = produtosSaoCompativeis(produtoAliExpress, produtoML);
                
                resultados.push({
                    produtoML,
                    compatibilidade: compatibilidade.compatível,
                    score: compatibilidade.score,
                    detalhes: compatibilidade
                });
                
            } catch (err) {
                logErro(`❌ Erro ao comparar produto: ${err.message}`);
            }
        }
        
        // Ordenar por score
        resultados.sort((a, b) => b.score - a.score);
        
        return {
            sucesso: true,
            totalComparacoes: resultados.length,
            melhorMatch: resultados[0] || null,
            resultados
        };
        
    } catch (error) {
        logErro(`❌ Erro na comparação com imagens: ${error.message}`);
        return {
            sucesso: false,
            erro: error.message,
            resultados: []
        };
    }
}
