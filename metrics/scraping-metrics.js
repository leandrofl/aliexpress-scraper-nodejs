/**
 * @fileoverview Sistema completo de métricas e logging para scraping
 * @description Coleta e analisa métricas detalhadas de performance e decisões
 * 
 * @author Sistema de Scraping AliExpress - Metrics Logger v1.0
 * @version 1.0.0 - Sistema de métricas avançado
 * @since 2024-01-01
 */

import fs from 'fs/promises';
import path from 'path';

const METRICS_DIR = path.join(process.cwd(), 'metrics');
const DAILY_METRICS_FILE = path.join(METRICS_DIR, `metrics-${new Date().toISOString().split('T')[0]}.json`);

/**
 * Classe para gerenciar métricas de scraping
 */
class ScrapingMetrics {
    constructor() {
        this.sessionId = Date.now().toString();
        this.startTime = Date.now();
        this.metrics = {
            sessao: {
                id: this.sessionId,
                inicio: new Date().toISOString(),
                categoria: null,
                configuracao: {}
            },
            produtos: {
                coletados: 0,
                processados: 0,
                aprovadosQuantitativo: 0,
                aprovadosQualitativo: 0,
                aprovadosFinal: 0,
                duplicados: 0,
                comErro: 0,
                traduzidos: 0,
                comMatchML: 0,
                semImagem: 0
            },
            filtros: {
                reprovadosPorPreco: 0,
                reprovadosPorVendas: 0,
                reprovadosPorAvaliacoes: 0,
                reprovadosPorFrete: 0,
                reprovadosPorEnvio: 0,
                reprovadosPorMargem: 0,
                reprovadosPorQualitativo: 0
            },
            tempos: {
                medioPorProduto: 0,
                totalProcessamento: 0,
                tradução: 0,
                buscaML: 0,
                analiseImagem: 0,
                filtrosQuantitativos: 0,
                filtrosQualitativos: 0
            },
            mercadoLivre: {
                buscasRealizadas: 0,
                produtosEncontrados: 0,
                errosDeRede: 0,
                rateLimits: 0,
                tempoMedioBusca: 0
            },
            qualidade: {
                scoresMedio: 0,
                distribuicaoScores: { bronze: 0, prata: 0, ouro: 0, diamante: 0 },
                produtosEstrela: 0,
                margemMedia: 0
            },
            erros: []
        };
        
        this.temposPorProduto = [];
        this.inicializarMetricas();
    }

    /**
     * Inicializar diretório de métricas
     */
    async inicializarMetricas() {
        try {
            await fs.mkdir(METRICS_DIR, { recursive: true });
        } catch (error) {
            console.error('❌ Erro ao criar diretório de métricas:', error.message);
        }
    }

    /**
     * Iniciar processamento de um produto
     * @param {Object} produto - Produto sendo processado
     * @returns {string} ID único para tracking
     */
    iniciarProduto(produto) {
        const trackingId = `${produto.product_id}-${Date.now()}`;
        this.temposPorProduto[trackingId] = {
            inicio: Date.now(),
            produto_id: produto.product_id,
            categoria: produto.categoria,
            etapas: {}
        };
        return trackingId;
    }

    /**
     * Marcar tempo de uma etapa específica
     * @param {string} trackingId - ID do produto sendo tracked
     * @param {string} etapa - Nome da etapa
     * @param {number} tempo - Tempo em ms (opcional, usa atual se não informado)
     */
    marcarEtapa(trackingId, etapa, tempo = null) {
        if (this.temposPorProduto[trackingId]) {
            this.temposPorProduto[trackingId].etapas[etapa] = tempo || Date.now();
        }
    }

    /**
     * Finalizar processamento de um produto
     * @param {string} trackingId - ID do produto
     * @param {Object} resultadoFinal - Resultado do processamento
     */
    finalizarProduto(trackingId, resultadoFinal) {
        if (!this.temposPorProduto[trackingId]) return;

        const tempo = this.temposPorProduto[trackingId];
        const tempoTotal = Date.now() - tempo.inicio;
        
        // Atualizar métricas gerais
        this.metrics.produtos.processados++;
        
        // Atualizar aprovações
        if (resultadoFinal.aprovadoQuantitativo) this.metrics.produtos.aprovadosQuantitativo++;
        if (resultadoFinal.aprovadoQualitativo) this.metrics.produtos.aprovadosQualitativo++;
        if (resultadoFinal.aprovadoFinal) this.metrics.produtos.aprovadosFinal++;
        if (resultadoFinal.isDuplicado) this.metrics.produtos.duplicados++;
        if (resultadoFinal.nomeTraduzido) this.metrics.produtos.traduzidos++;
        if (resultadoFinal.dadosMercadoLivre?.encontrouProdutos) this.metrics.produtos.comMatchML++;
        if (!resultadoFinal.imagemURL) this.metrics.produtos.semImagem++;

        // Atualizar reprovações por filtro
        this.atualizarFiltrosReprovados(resultadoFinal);

        // Atualizar scores
        this.atualizarQualidade(resultadoFinal);

        // Calcular tempo médio
        this.temposPorProduto[trackingId].total = tempoTotal;
        this.calcularTemposMedios();
    }

    /**
     * Atualizar métricas de filtros reprovados
     * @param {Object} produto - Produto com filtros aplicados
     */
    atualizarFiltrosReprovados(produto) {
        if (!produto.filtros) return;

        if (produto.filtros.preco && !produto.filtros.preco.aprovado) {
            this.metrics.filtros.reprovadosPorPreco++;
        }
        if (produto.filtros.vendas && !produto.filtros.vendas.aprovado) {
            this.metrics.filtros.reprovadosPorVendas++;
        }
        if (produto.filtros.avaliacoes && !produto.filtros.avaliacoes.aprovado) {
            this.metrics.filtros.reprovadosPorAvaliacoes++;
        }
        if (produto.filtros.frete && !produto.filtros.frete.aprovado) {
            this.metrics.filtros.reprovadosPorFrete++;
        }
        if (produto.filtros.envio && !produto.filtros.envio.aprovado) {
            this.metrics.filtros.reprovadosPorEnvio++;
        }
        if (produto.analiseMargem && !produto.analiseMargem.recomendacao?.viavel) {
            this.metrics.filtros.reprovadosPorMargem++;
        }
        if (!produto.aprovadoQualitativo) {
            this.metrics.filtros.reprovadosPorQualitativo++;
        }
    }

    /**
     * Atualizar métricas de qualidade
     * @param {Object} produto - Produto com score calculado
     */
    atualizarQualidade(produto) {
        if (produto.scoreTotal) {
            const scores = Object.values(this.metrics.qualidade.distribuicaoScores);
            const totalComScore = scores.reduce((a, b) => a + b, 0);
            
            // Score médio ponderado
            const scoreAtual = produto.scoreTotal.total || 0;
            this.metrics.qualidade.scoresMedio = totalComScore > 0 ? 
                Math.round((this.metrics.qualidade.scoresMedio * totalComScore + scoreAtual) / (totalComScore + 1)) :
                scoreAtual;

            // Distribuição por categoria
            const categoria = produto.scoreTotal.categoria || 'bronze';
            this.metrics.qualidade.distribuicaoScores[categoria]++;

            // Produtos estrela (score >= 85)
            if (scoreAtual >= 85) {
                this.metrics.qualidade.produtosEstrela++;
            }
        }

        // Margem média
        if (produto.analiseMargem?.analise?.margemCalculada) {
            const margem = produto.analiseMargem.analise.margemCalculada;
            const totalProdutos = this.metrics.produtos.processados;
            this.metrics.qualidade.margemMedia = 
                Math.round((this.metrics.qualidade.margemMedia * (totalProdutos - 1) + margem) / totalProdutos);
        }
    }

    /**
     * Calcular tempos médios
     */
    calcularTemposMedios() {
        const tempos = Object.values(this.temposPorProduto).filter(t => t.total);
        if (tempos.length === 0) return;

        const totalTempo = tempos.reduce((sum, t) => sum + t.total, 0);
        this.metrics.tempos.medioPorProduto = Math.round(totalTempo / tempos.length);
        this.metrics.tempos.totalProcessamento = totalTempo;
    }

    /**
     * Registrar erro
     * @param {string} tipo - Tipo do erro
     * @param {string} mensagem - Mensagem do erro
     * @param {Object} contexto - Contexto adicional
     */
    registrarErro(tipo, mensagem, contexto = {}) {
        this.metrics.produtos.comErro++;
        this.metrics.erros.push({
            timestamp: new Date().toISOString(),
            tipo,
            mensagem,
            contexto
        });

        // Manter apenas últimos 50 erros para não inflar o arquivo
        if (this.metrics.erros.length > 50) {
            this.metrics.erros = this.metrics.erros.slice(-50);
        }
    }

    /**
     * Registrar métrica do Mercado Livre
     * @param {string} evento - Tipo de evento (busca, erro, sucesso)
     * @param {Object} dados - Dados do evento
     */
    registrarML(evento, dados = {}) {
        switch (evento) {
            case 'busca_realizada':
                this.metrics.mercadoLivre.buscasRealizadas++;
                if (dados.tempoMs) {
                    const buscas = this.metrics.mercadoLivre.buscasRealizadas;
                    this.metrics.mercadoLivre.tempoMedioBusca = 
                        Math.round((this.metrics.mercadoLivre.tempoMedioBusca * (buscas - 1) + dados.tempoMs) / buscas);
                }
                break;
            case 'produtos_encontrados':
                this.metrics.mercadoLivre.produtosEncontrados += dados.quantidade || 0;
                break;
            case 'erro_rede':
                this.metrics.mercadoLivre.errosDeRede++;
                break;
            case 'rate_limit':
                this.metrics.mercadoLivre.rateLimits++;
                break;
        }
    }

    /**
     * Definir configuração da sessão
     * @param {Object} config - Configuração utilizada
     */
    definirConfiguracao(config) {
        this.metrics.sessao.categoria = config.categoria;
        this.metrics.sessao.configuracao = {
            maxProdutos: config.maxProdutos,
            maxPaginas: config.maxPaginas,
            targetProdutos: config.targetProdutos,
            filtrosAtivos: config.filtrosAtivos || []
        };
    }

    /**
     * Finalizar sessão e salvar métricas
     */
    async finalizarSessao() {
        this.metrics.sessao.fim = new Date().toISOString();
        this.metrics.sessao.duracaoTotal = Date.now() - this.startTime;
        
        // Calcular estatísticas finais
        const processed = this.metrics.produtos.processados;
        if (processed > 0) {
            this.metrics.produtos.taxaAprovacaoQuantitativa = 
                Math.round((this.metrics.produtos.aprovadosQuantitativo / processed) * 100);
            this.metrics.produtos.taxaAprovacaoQualitativa = 
                Math.round((this.metrics.produtos.aprovadosQualitativo / processed) * 100);
            this.metrics.produtos.taxaAprovacaoFinal = 
                Math.round((this.metrics.produtos.aprovadosFinal / processed) * 100);
            this.metrics.produtos.taxaDuplicacao = 
                Math.round((this.metrics.produtos.duplicados / processed) * 100);
        }

        await this.salvarMetricas();
        return this.gerarRelatorio();
    }

    /**
     * Salvar métricas no arquivo
     */
    async salvarMetricas() {
        try {
            await fs.writeFile(DAILY_METRICS_FILE, JSON.stringify(this.metrics, null, 2));
            console.log(`📊 Métricas salvas: ${DAILY_METRICS_FILE}`);
        } catch (error) {
            console.error('❌ Erro ao salvar métricas:', error.message);
        }
    }

    /**
     * Gerar relatório resumido
     * @returns {string} Relatório formatado
     */
    gerarRelatorio() {
        const m = this.metrics;
        const duracao = Math.round(m.sessao.duracaoTotal / 1000 / 60); // minutos

        return `
📊 RELATÓRIO DE MÉTRICAS - SESSÃO ${m.sessao.id}
═══════════════════════════════════════════════════

⏱ TEMPO:
  • Duração total: ${duracao} minutos
  • Tempo médio por produto: ${m.tempos.medioPorProduto}ms
  • Produtos processados: ${m.produtos.processados}

📈 APROVAÇÕES:
  • Taxa aprovação quantitativa: ${m.produtos.taxaAprovacaoQuantitativa || 0}%
  • Taxa aprovação qualitativa: ${m.produtos.taxaAprovacaoQualitativa || 0}%
  • Taxa aprovação final: ${m.produtos.taxaAprovacaoFinal || 0}%
  • Produtos estrela (score 85+): ${m.qualidade.produtosEstrela}

🔍 MERCADO LIVRE:
  • Buscas realizadas: ${m.mercadoLivre.buscasRealizadas}
  • Produtos encontrados: ${m.mercadoLivre.produtosEncontrados}
  • Tempo médio busca: ${m.mercadoLivre.tempoMedioBusca}ms
  • Erros de rede: ${m.mercadoLivre.errosDeRede}

🎯 QUALIDADE:
  • Score médio: ${m.qualidade.scoresMedio}
  • Margem média: ${m.qualidade.margemMedia}%
  • Distribuição: 💎${m.qualidade.distribuicaoScores.diamante} 🥇${m.qualidade.distribuicaoScores.ouro} 🥈${m.qualidade.distribuicaoScores.prata} 🥉${m.qualidade.distribuicaoScores.bronze}

⚠ FILTROS (Reprovações):
  • Preço: ${m.filtros.reprovadosPorPreco}
  • Vendas: ${m.filtros.reprovadosPorVendas}
  • Avaliações: ${m.filtros.reprovadosPorAvaliacoes}
  • Margem: ${m.filtros.reprovadosPorMargem}
  • Qualitativo: ${m.filtros.reprovadosPorQualitativo}

🔄 DUPLICADOS: ${m.produtos.duplicados} (${m.produtos.taxaDuplicacao || 0}%)
❌ ERROS: ${m.produtos.comErro}
═══════════════════════════════════════════════════
        `.trim();
    }
}

// Instância global das métricas
let globalMetrics = null;

/**
 * Inicializar sistema de métricas
 * @param {Object} configuracao - Configuração da sessão
 * @returns {ScrapingMetrics} Instância das métricas
 */
export function iniciarMetricas(configuracao = {}) {
    globalMetrics = new ScrapingMetrics();
    globalMetrics.definirConfiguracao(configuracao);
    return globalMetrics;
}

/**
 * Obter instância atual das métricas
 * @returns {ScrapingMetrics} Instância das métricas
 */
export function obterMetricas() {
    return globalMetrics;
}

/**
 * Helpers para uso fácil
 */
export const metricas = {
    iniciarProduto: (produto) => globalMetrics?.iniciarProduto(produto),
    finalizarProduto: (trackingId, resultado) => globalMetrics?.finalizarProduto(trackingId, resultado),
    marcarEtapa: (trackingId, etapa) => globalMetrics?.marcarEtapa(trackingId, etapa),
    registrarErro: (tipo, mensagem, contexto) => globalMetrics?.registrarErro(tipo, mensagem, contexto),
    registrarML: (evento, dados) => globalMetrics?.registrarML(evento, dados),
    finalizar: () => globalMetrics?.finalizarSessao()
};
