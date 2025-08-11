/**
 * @fileoverview Integração entre o sistema de scraping e Supabase
 * @description Funções para salvar dados das 8 melhorias implementadas
 * 
 * @author Sistema de Scraping AliExpress - Database Integration v1.0
 * @version 1.0.0 - Integração completa com Supabase
 * @since 2024-01-01
 */

import { supabase } from './supabase-client.js';
import { gerarHashProduto } from '../utils/duplicate-checker.js';

/**
 * Salvar produto completo com todas as melhorias implementadas
 * @param {Object} produto - Produto processado com todos os dados
 * @param {string} tenantId - ID do tenant (usuário)
 * @returns {Promise<Object>} Resultado da operação
 */
export async function salvarProdutoCompleto(produto, tenantId = null) {
    try {
        // Gerar hash para anti-duplicidade
        const hashDuplicidade = gerarHashProduto(produto);
        
        // Mapear status baseado nas aprovações (sugestão do ChatGPT)
        let status = 'coletado';
        if (produto.aprovadoFinal) {
            status = 'aprovado';
        } else if (produto.aprovadoQuantitativo === false) {
            status = 'reprovado';
        } else if (produto.aprovadoQuantitativo && produto.aprovadoQualitativo === false) {
            status = 'analisado';
        }

        // Extrair dados do Mercado Livre
        const mlTop3 = produto.dadosMercadoLivre?.mlTop3Produtos || null;
        const precoMLMedio = mlTop3?.length > 0 ? 
            mlTop3.reduce((sum, p) => sum + (p.preco || 0), 0) / mlTop3.length : null;

        // Preparar dados para inserção
        const dadosProduto = {
            product_id_aliexpress: produto.product_id,
            tenant_id: tenantId,
            nome: produto.nome,
            nome_traduzido: produto.nomeTraduzido || produto.nome,
            categoria: produto.categoria,
            preco_aliexpress: parseFloat(produto.preco?.toString().replace(/[^\d,]/g, '').replace(',', '.')) || 0,
            url_aliexpress: produto.url || produto.href,
            
            // 🎯 Scores das melhorias implementadas
            score_total: produto.scoreTotal?.total || 0,
            score_categoria: produto.scoreTotal?.categoria || 'bronze',
            aprovado_quantitativo: produto.aprovadoQuantitativo || false,
            aprovado_qualitativo: produto.aprovadoQualitativo || false,
            aprovado_final: produto.aprovadoFinal || false,
            
            // 🛒 Dados Mercado Livre
            preco_ml_medio: precoMLMedio,
            ml_top3_produtos: mlTop3,
            similaridade_visual: produto.dadosMercadoLivre?.melhorMatch?.similaridade || null,
            
            // 📊 Métricas de qualidade
            vendas_aliexpress: produto.vendas || 0,
            rating_aliexpress: produto.rating || 0,
            reviews_aliexpress: produto.reviews || 0,
            peso: produto.peso || null,
            
            // 🏪 Dados do vendedor
            vendedor_nome: produto.vendedor || null,
            vendedor_rating: produto.avaliacaoVendedor || null,
            vendedor_tempo_abertura: produto.tempoAbertura || null,
            
            // 🔍 Status e controle
            status: status,
            hash_duplicidade: hashDuplicidade,
            
            // 🎯 Campos de fallback textual (sugestão ChatGPT)
            imagem_comparada: produto.dadosMercadoLivre?.melhorMatch?.imagemComparada ?? true,
            fonte_de_verificacao: produto.dadosMercadoLivre?.melhorMatch?.fonteDeVerificacao || 'imagem',
            risco_imagem: produto.dadosMercadoLivre?.melhorMatch?.riscoImagem || false,
            compatibilidade_textual: produto.dadosMercadoLivre?.melhorMatch?.compatibilidadeTextual || null,
            ratio_preco: produto.dadosMercadoLivre?.melhorMatch?.ratioPreco || null,
            
            // ⏰ Timestamps
            primeira_coleta_em: new Date().toISOString(),
            ultima_analise_em: new Date().toISOString()
        };

        // Tentar inserir ou atualizar se já existe
        const { data, error } = await supabase
            .from('produtos')
            .upsert(dadosProduto, {
                onConflict: 'product_id_aliexpress',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao salvar produto:', error.message);
            return { sucesso: false, erro: error.message };
        }

        console.log(`✅ Produto salvo: ${produto.product_id} (Score: ${produto.scoreTotal?.total || 0})`);
        return { sucesso: true, data: data, id: data.id };

    } catch (error) {
        console.error('❌ Erro ao salvar produto completo:', error.message);
        return { sucesso: false, erro: error.message };
    }
}

/**
 * Salvar métricas da sessão de scraping
 * @param {Object} metricas - Métricas coletadas durante a sessão
 * @param {string} tenantId - ID do tenant
 * @returns {Promise<Object>} Resultado da operação
 */
export async function salvarMetricasSessao(metricas, tenantId = null) {
    try {
        // Calcular distribuição de scores
        const distribuicaoScores = {
            produtos_bronze: 0,
            produtos_prata: 0,
            produtos_ouro: 0,
            produtos_diamante: 0
        };

        if (metricas.qualidade?.distribuicaoScores) {
            distribuicaoScores.produtos_bronze = metricas.qualidade.distribuicaoScores.bronze || 0;
            distribuicaoScores.produtos_prata = metricas.qualidade.distribuicaoScores.prata || 0;
            distribuicaoScores.produtos_ouro = metricas.qualidade.distribuicaoScores.ouro || 0;
            distribuicaoScores.produtos_diamante = metricas.qualidade.distribuicaoScores.diamante || 0;
        }

        const dadosMetricas = {
            tenant_id: tenantId,
            sessao_id: metricas.sessao?.id || Date.now().toString(),
            categoria: metricas.sessao?.categoria || 'desconhecida',
            
            // 📊 Estatísticas da sessão
            produtos_coletados: metricas.produtos?.coletados || 0,
            produtos_processados: metricas.produtos?.processados || 0,
            produtos_aprovados: metricas.produtos?.aprovadosFinal || 0,
            produtos_duplicados: metricas.produtos?.duplicados || 0,
            
            // ⏱ Métricas de tempo
            duracao_total_ms: metricas.sessao?.duracaoTotal || 0,
            tempo_medio_produto_ms: metricas.tempos?.medioPorProduto || 0,
            
            // 📈 Taxas de sucesso
            taxa_aprovacao_quantitativa: metricas.produtos?.taxaAprovacaoQuantitativa || 0,
            taxa_aprovacao_qualitativa: metricas.produtos?.taxaAprovacaoQualitativa || 0,
            taxa_aprovacao_final: metricas.produtos?.taxaAprovacaoFinal || 0,
            
            // 🛒 Dados Mercado Livre
            buscas_ml_realizadas: metricas.mercadoLivre?.buscasRealizadas || 0,
            produtos_ml_encontrados: metricas.mercadoLivre?.produtosEncontrados || 0,
            erros_ml: metricas.mercadoLivre?.errosDeRede || 0,
            tempo_medio_busca_ml_ms: metricas.mercadoLivre?.tempoMedioBusca || 0,
            
            // 🎯 Distribuição de scores
            ...distribuicaoScores,
            
            // 📋 Configurações da sessão
            config_max_produtos: metricas.sessao?.configuracao?.maxProdutos || 0,
            config_max_paginas: metricas.sessao?.configuracao?.maxPaginas || 0,
            config_target_final: metricas.sessao?.configuracao?.targetProdutos || 0
        };

        const { data, error } = await supabase
            .from('metricas_scraping')
            .insert(dadosMetricas)
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao salvar métricas:', error.message);
            return { sucesso: false, erro: error.message };
        }

        console.log(`✅ Métricas salvas: Sessão ${dadosMetricas.sessao_id}`);
        return { sucesso: true, data: data };

    } catch (error) {
        console.error('❌ Erro ao salvar métricas da sessão:', error.message);
        return { sucesso: false, erro: error.message };
    }
}

/**
 * Verificar duplicidade usando banco de dados
 * @param {Object} produto - Produto para verificar
 * @param {string} tenantId - ID do tenant
 * @returns {Promise<Object>} Resultado da verificação
 */
export async function verificarDuplicidadeDB(produto, tenantId = null) {
    try {
        const hash = gerarHashProduto(produto);
        
        const { data, error } = await supabase
            .from('produtos')
            .select('id, product_id_aliexpress, primeira_coleta_em, categoria, status')
            .eq('hash_duplicidade', hash)
            .eq('tenant_id', tenantId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('❌ Erro ao verificar duplicidade:', error.message);
            return { isDuplicado: false, erro: error.message };
        }

        if (data) {
            const diasApos = Math.floor(
                (Date.now() - new Date(data.primeira_coleta_em)) / (1000 * 60 * 60 * 24)
            );
            
            return {
                isDuplicado: true,
                hash: hash,
                primeiroProcessamento: data.primeira_coleta_em,
                categoria: data.categoria,
                diasApos: diasApos,
                status: data.status,
                motivo: 'Produto já processado anteriormente'
            };
        }

        return {
            isDuplicado: false,
            hash: hash,
            novo: true
        };

    } catch (error) {
        console.error('❌ Erro ao verificar duplicidade no DB:', error.message);
        return {
            isDuplicado: false,
            erro: error.message,
            hash: gerarHashProduto(produto)
        };
    }
}

/**
 * Obter produtos aprovados por categoria
 * @param {string} categoria - Categoria dos produtos
 * @param {string} tenantId - ID do tenant
 * @param {number} limite - Número máximo de produtos
 * @returns {Promise<Array>} Lista de produtos aprovados
 */
export async function obterProdutosAprovados(categoria = null, tenantId = null, limite = 50) {
    try {
        let query = supabase
            .from('produtos')
            .select('*')
            .eq('aprovado_final', true)
            .order('score_total', { ascending: false });

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        }

        if (categoria) {
            query = query.eq('categoria', categoria);
        }

        query = query.limit(limite);

        const { data, error } = await query;

        if (error) {
            console.error('❌ Erro ao obter produtos aprovados:', error.message);
            return [];
        }

        return data || [];

    } catch (error) {
        console.error('❌ Erro ao buscar produtos aprovados:', error.message);
        return [];
    }
}

/**
 * Obter estatísticas de produtos por categoria
 * @param {string} tenantId - ID do tenant
 * @returns {Promise<Object>} Estatísticas detalhadas
 */
export async function obterEstatisticasProdutos(tenantId = null) {
    try {
        let query = supabase
            .from('vw_produtos_resumo')
            .select('*');

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Erro ao obter estatísticas:', error.message);
            return {};
        }

        return data || [];

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error.message);
        return {};
    }
}

/**
 * Limpar produtos antigos (mais de X dias)
 * @param {number} dias - Dias para considerar produto antigo
 * @param {string} tenantId - ID do tenant
 * @returns {Promise<Object>} Resultado da limpeza
 */
export async function limparProdutosAntigos(dias = 30, tenantId = null) {
    try {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - dias);

        let query = supabase
            .from('produtos')
            .delete()
            .lt('primeira_coleta_em', dataLimite.toISOString())
            .neq('status', 'listado'); // Não deletar produtos já listados

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Erro ao limpar produtos antigos:', error.message);
            return { removidos: 0, erro: error.message };
        }

        console.log(`✅ ${data?.length || 0} produtos antigos removidos`);
        return { removidos: data?.length || 0 };

    } catch (error) {
        console.error('❌ Erro na limpeza de produtos:', error.message);
        return { removidos: 0, erro: error.message };
    }
}

/**
 * Obter estatísticas gerais do banco (função principal)
 * @returns {Promise<Object>} Estatísticas completas
 */
export async function obterEstatisticasGerais() {
    try {
        // Estatísticas básicas de contagem
        const [produtosResult, metricsResult, campanhasResult] = await Promise.all([
            supabase.from('produtos').select('*', { count: 'exact', head: true }),
            supabase.from('metricas_scraping').select('*', { count: 'exact', head: true }),
            supabase.from('campanhas').select('*', { count: 'exact', head: true })
        ]);

        // Estatísticas de produtos por categoria
        const { data: categorias } = await supabase
            .from('produtos')
            .select('categoria')
            .not('categoria', 'is', null);

        const categoriaPopular = categorias?.length > 0 
            ? categorias.reduce((acc, curr) => {
                acc[curr.categoria] = (acc[curr.categoria] || 0) + 1;
                return acc;
            }, {})
            : {};

        const categoriaMaisPopular = Object.keys(categoriaPopular).length > 0
            ? Object.keys(categoriaPopular).reduce((a, b) => 
                categoriaPopular[a] > categoriaPopular[b] ? a : b
            )
            : null;

        // Score médio dos produtos
        const { data: scores } = await supabase
            .from('produtos')
            .select('score_total')
            .not('score_total', 'is', null);

        const scoreMedia = scores?.length > 0
            ? (scores.reduce((sum, p) => sum + (p.score_total || 0), 0) / scores.length).toFixed(1)
            : null;

        // Contagem por categoria de score
        const { data: produtosPorScore } = await supabase
            .from('produtos')
            .select('score_categoria')
            .not('score_categoria', 'is', null);

        const scoreCounts = produtosPorScore?.reduce((acc, p) => {
            acc[p.score_categoria] = (acc[p.score_categoria] || 0) + 1;
            return acc;
        }, {}) || {};

        return {
            totalProdutos: produtosResult.count || 0,
            totalMetricas: metricsResult.count || 0,
            totalCampanhas: campanhasResult.count || 0,
            categoriaMaisPopular,
            scoreMedia,
            produtosDiamante: scoreCounts.diamante || 0,
            produtosOuro: scoreCounts.ouro || 0,
            produtosPrata: scoreCounts.prata || 0,
            produtosBronze: scoreCounts.bronze || 0,
            categoriasDisponiveis: Object.keys(categoriaPopular),
            ultimaAtualizacao: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Erro ao obter estatísticas gerais:', error.message);
        return {
            totalProdutos: 0,
            totalMetricas: 0,
            totalCampanhas: 0,
            categoriaMaisPopular: null,
            scoreMedia: null,
            erro: error.message
        };
    }
}

/**
 * Obter produtos com risco de imagem para revisão manual
 * @param {number} limite - Limite de produtos a retornar
 * @param {string} tenantId - ID do tenant (opcional)
 * @returns {Promise<Array>} Lista de produtos com risco
 */
export async function obterProdutosComRiscoImagem(limite = 50, tenantId = null) {
    try {
        // Por enquanto, vamos simular produtos com risco baseado em critérios básicos
        // até que os novos campos sejam aplicados no banco Supabase
        
        let query = supabase
            .from('produtos')
            .select(`
                nome,
                preco_aliexpress,
                preco_ml_medio,
                url_aliexpress,
                criado_em,
                score_total,
                status,
                aprovado_final
            `)
            .order('score_total', { ascending: false })
            .limit(limite);

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Erro ao obter produtos:', error.message);
            return [];
        }

        // Simular produtos com "risco" - produtos não aprovados ou com problemas
        const produtosComRisco = (data || []).filter(produto => 
            !produto.aprovado_final || 
            produto.status === 'coletado' || 
            produto.status === 'analisado'
        );

        console.log(`📊 Encontrados ${produtosComRisco.length} produtos com potencial risco`);
        return produtosComRisco;

    } catch (error) {
        console.error('❌ Erro ao buscar produtos com risco:', error.message);
        return [];
    }
}
