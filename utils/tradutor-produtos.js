/**
 * @fileoverview Tradutor Inteligente de Produtos para Busca no Mercado Livre
 * @description Detecta idioma, traduz nomes de produtos e gera termos de busca otimizados
 * para garantir melhor compatibilidade com o mercado brasileiro
 * 
 * @author Sistema de Scraping AliExpress - Tradução
 * @version 1.0.0
 * @since 2024-08-06
 */

import { franc } from 'franc';
import slugify from 'slugify';
import { logInfo, logSucesso, logErro, limparTexto } from '../scraper/utils.js';

// Função logAviso simplificada
const logAviso = (msg) => {
    console.log(`⚠️ ${msg}`);
};

/**
 * Configurações do tradutor
 */
const TRADUTOR_CONFIG = {
    // Idiomas aceitos (que não precisam tradução)
    idiomasAceitos: ['por', 'pt', 'portuguese'],
    
    // Confiança mínima para detecção de idioma
    confiancaMinima: 0.7,
    
    // Google Translate settings
    googleTranslate: {
        projectId: process.env.GOOGLE_TRANSLATE_PROJECT_ID || 'aliexpress-scraper',
        apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
        target: 'pt' // Português brasileiro
    },
    
    // Blacklist de palavras para filtrar do termo de busca
    blacklist: [
        // Palavras comuns
        'frete', 'grátis', 'novo', 'nova', 'oferta', 'produto', 'original', 
        'promoção', 'para', 'de', 'com', 'sem', 'da', 'do', 'das', 'dos',
        'em', 'na', 'no', 'nas', 'nos', 'por', 'pelo', 'pela', 'pelos', 'pelas',
        
        // Anos
        '2023', '2024', '2025', '2026',
        
        // Palavras de marketing
        'hot', 'sale', 'deal', 'best', 'top', 'super', 'mega', 'ultra',
        'premium', 'deluxe', 'professional', 'pro', 'plus', 'max',
        
        // Palavras técnicas comuns
        'kit', 'set', 'pack', 'peça', 'peças', 'unidade', 'unidades',
        'modelo', 'versão', 'tipo', 'style', 'design',
        
        // Conectores
        'and', 'or', 'with', 'without', 'for', 'to', 'from', 'in', 'on', 'at'
    ],
    
    // Configurações do slug
    slug: {
        maxPalavras: 6,
        tamanhoMinimoPalavra: 2,
        removerNumeros: false // Manter números importantes como "5g", "4k", etc.
    }
};

/**
 * Instância do Google Translate (será inicializada quando necessário)
 */
let googleTranslateInstance = null;
let Translate = null;

/**
 * Inicializa o Google Translate de forma assíncrona
 */
async function carregarGoogleTranslate() {
    try {
        if (!Translate) {
            const module = await import('@google-cloud/translate');
            Translate = module.v2.Translate; // Usar a versão v2
        }
        return true;
    } catch (error) {
        logAviso('⚠️ Google Translate não disponível, usando simulação');
        return false;
    }
}

/**
 * Inicializa o Google Translate
 * @returns {Promise<Translate|null>} Instância do Google Translate ou null se não configurado
 */
async function inicializarGoogleTranslate() {
    try {
        if (googleTranslateInstance) {
            return googleTranslateInstance;
        }
        
        // Carregar o Google Translate
        const carregado = await carregarGoogleTranslate();
        if (!carregado) {
            return null;
        }
        
        // Verificar se tem configuração do Google Translate
        if (!Translate || (!process.env.GOOGLE_TRANSLATE_PROJECT_ID && !process.env.GOOGLE_TRANSLATE_API_KEY)) {
            logAviso('⚠️ Google Translate não configurado - tradução será simulada');
            return null;
        }

        const config = {};
        
        if (TRADUTOR_CONFIG.googleTranslate.projectId) {
            config.projectId = TRADUTOR_CONFIG.googleTranslate.projectId;
        }
        
        if (TRADUTOR_CONFIG.googleTranslate.apiKey) {
            config.key = TRADUTOR_CONFIG.googleTranslate.apiKey;
        }
        
        googleTranslateInstance = new Translate(config);
        logSucesso('✅ Google Translate inicializado');
        
        return googleTranslateInstance;
        
    } catch (error) {
        logErro(`❌ Erro ao inicializar Google Translate: ${error.message}`);
        return null;
    }
}

/**
 * Detecta o idioma de um texto usando franc
 * @param {string} texto - Texto para detectar idioma
 * @returns {Object} Resultado da detecção com idioma e confiança
 */
function detectarIdioma(texto) {
    try {
        if (!texto || typeof texto !== 'string' || texto.trim().length < 3) {
            return {
                idioma: 'unknown',
                confianca: 0,
                precisaTraducao: true,
                motivo: 'Texto muito curto ou inválido'
            };
        }
        
        const textoLimpo = limparTexto(texto);
        
        // Usar franc para detectar idioma
        const idiomaDetectado = franc(textoLimpo);
        
        // Verificar se é português
        const ehPortugues = TRADUTOR_CONFIG.idiomasAceitos.includes(idiomaDetectado.toLowerCase());
        
        // Calcular confiança baseada no tamanho do texto e caracteres
        let confianca = 0.8; // Confiança base do franc
        
        // Reduzir confiança para textos muito curtos
        if (textoLimpo.length < 10) {
            confianca *= 0.6;
        } else if (textoLimpo.length < 20) {
            confianca *= 0.8;
        }
        
        // Aumentar confiança se tem acentos portugueses
        if (/[áéíóúâêôãõç]/i.test(textoLimpo)) {
            confianca = Math.min(confianca * 1.2, 1.0);
        }
        
        const resultado = {
            idioma: idiomaDetectado,
            ehPortugues,
            confianca,
            precisaTraducao: !ehPortugues || confianca < TRADUTOR_CONFIG.confiancaMinima,
            motivo: ehPortugues ? 
                'Detectado como português' : 
                `Detectado como ${idiomaDetectado}, necessário traduzir`
        };
        
        logInfo(`🔍 Idioma detectado: ${idiomaDetectado} (confiança: ${(confianca * 100).toFixed(1)}%)`);
        
        return resultado;
        
    } catch (error) {
        logErro(`❌ Erro na detecção de idioma: ${error.message}`);
        
        return {
            idioma: 'unknown',
            confianca: 0,
            precisaTraducao: true,
            motivo: `Erro na detecção: ${error.message}`
        };
    }
}

/**
 * Traduz texto para português usando Google Translate
 * @param {string} texto - Texto para traduzir
 * @param {string} idiomaOrigem - Idioma de origem (opcional)
 * @returns {Promise<Object>} Resultado da tradução
 */
async function traduzirTexto(texto, idiomaOrigem = null) {
    try {
        if (!texto || typeof texto !== 'string') {
            throw new Error('Texto inválido para tradução');
        }
        
        const googleTranslate = await inicializarGoogleTranslate();
        
        if (!googleTranslate) {
            // Simulação para desenvolvimento sem API key
            logAviso('⚠️ Simulando tradução (Google Translate não configurado)');
            
            return {
                textoOriginal: texto,
                textoTraduzido: texto, // Retorna o mesmo texto
                idiomaDetectado: idiomaOrigem || 'en',
                confianca: 0.5,
                simulado: true,
                erro: null
            };
        }
        
        logInfo(`🌐 Traduzindo: "${texto.substring(0, 50)}..."`);
        
        // Configurar opções da tradução
        const opcoes = {
            to: TRADUTOR_CONFIG.googleTranslate.target
        };
        
        if (idiomaOrigem) {
            opcoes.from = idiomaOrigem;
        }
        
        // Realizar tradução
        const [translation, metadata] = await googleTranslate.translate(texto, opcoes);
        
        const resultado = {
            textoOriginal: texto,
            textoTraduzido: translation,
            idiomaDetectado: metadata?.detectedSourceLanguage || idiomaOrigem || 'unknown',
            confianca: 0.9, // Google Translate tem alta confiança
            simulado: false,
            erro: null
        };
        
        logSucesso(`✅ Tradução concluída: "${resultado.textoTraduzido.substring(0, 50)}..."`);
        
        return resultado;
        
    } catch (error) {
        logErro(`❌ Erro na tradução: ${error.message}`);
        
        return {
            textoOriginal: texto,
            textoTraduzido: texto, // Fallback para texto original
            idiomaDetectado: idiomaOrigem || 'unknown',
            confianca: 0,
            simulado: false,
            erro: error.message
        };
    }
}

/**
 * Gera termos de busca otimizados a partir do nome do produto
 * @param {string} nomeTraduzido - Nome do produto em português
 * @returns {Object} Termos de busca gerados
 */
function gerarTermosDeBusca(nomeTraduzido) {
    try {
        if (!nomeTraduzido || typeof nomeTraduzido !== 'string') {
            throw new Error('Nome traduzido inválido');
        }
        
        logInfo(`🔧 Gerando termos de busca para: "${nomeTraduzido}"`);
        
        // Limpar e preparar texto
        let textoLimpo = limparTexto(nomeTraduzido);
        
        // Criar slug inicial
        let slug = slugify(textoLimpo, {
            lower: true,
            strict: true,
            locale: 'pt'
        });
        
        // Dividir em palavras
        let palavras = slug.split('-').filter(palavra => {
            // Filtrar palavras muito curtas
            if (palavra.length < TRADUTOR_CONFIG.slug.tamanhoMinimoPalavra) {
                return false;
            }
            
            // Filtrar blacklist
            if (TRADUTOR_CONFIG.blacklist.includes(palavra.toLowerCase())) {
                return false;
            }
            
            // Filtrar apenas números (mas manter códigos como "5g", "4k")
            if (/^\d+$/.test(palavra) && palavra.length < 3) {
                return false;
            }
            
            return true;
        });
        
        // Limitar número de palavras
        palavras = palavras.slice(0, TRADUTOR_CONFIG.slug.maxPalavras);
        
        // Gerar diferentes versões dos termos
        const termoPrincipal = palavras.join(' ');
        const termoReduzido = palavras.slice(0, 4).join(' '); // Versão mais curta
        const termoEssencial = palavras.slice(0, 3).join(' '); // Apenas palavras essenciais
        
        const resultado = {
            original: nomeTraduzido,
            slug: slug,
            palavras: palavras,
            termoPrincipal,
            termoReduzido,
            termoEssencial,
            variantes: [termoPrincipal, termoReduzido, termoEssencial].filter(t => t.length > 0),
            estatisticas: {
                palavrasOriginais: textoLimpo.split(/\s+/).length,
                palavrasFiltradas: palavras.length,
                palavrasRemovidas: textoLimpo.split(/\s+/).length - palavras.length
            }
        };
        
        logSucesso(`✅ Termos gerados: "${resultado.termoPrincipal}" (${resultado.palavras.length} palavras)`);
        
        return resultado;
        
    } catch (error) {
        logErro(`❌ Erro ao gerar termos de busca: ${error.message}`);
        
        return {
            original: nomeTraduzido,
            slug: '',
            palavras: [],
            termoPrincipal: nomeTraduzido,
            termoReduzido: nomeTraduzido,
            termoEssencial: nomeTraduzido,
            variantes: [nomeTraduzido],
            estatisticas: {
                palavrasOriginais: 0,
                palavrasFiltradas: 0,
                palavrasRemovidas: 0
            },
            erro: error.message
        };
    }
}

/**
 * Processa nome de produto do AliExpress para busca no Mercado Livre
 * Função principal que orquestra detecção, tradução e geração de termos
 * 
 * @param {string} nomeOriginal - Nome original do produto do AliExpress
 * @returns {Promise<Object>} Objeto completo com todas as informações processadas
 */
export async function processarNomeProduto(nomeOriginal) {
    try {
        if (!nomeOriginal || typeof nomeOriginal !== 'string') {
            throw new Error('Nome do produto é obrigatório');
        }
        
        logInfo(`🎯 Processando nome do produto: "${nomeOriginal}"`);
        
        // PASSO 1: Detectar idioma
        const deteccaoIdioma = detectarIdioma(nomeOriginal);
        
        // PASSO 2: Traduzir se necessário
        let resultadoTraducao = null;
        let nomePortugues = nomeOriginal;
        
        if (deteccaoIdioma.precisaTraducao) {
            logInfo(`🌐 Nome precisa ser traduzido (${deteccaoIdioma.motivo})`);
            resultadoTraducao = await traduzirTexto(nomeOriginal, deteccaoIdioma.idioma);
            nomePortugues = resultadoTraducao.textoTraduzido;
        } else {
            logInfo(`✅ Nome já está em português (${deteccaoIdioma.motivo})`);
        }
        
        // PASSO 3: Gerar termos de busca
        const termosBusca = gerarTermosDeBusca(nomePortugues);
        
        // PASSO 4: Montar resultado final
        const resultado = {
            nomeOriginal,
            deteccaoIdioma,
            traducao: resultadoTraducao,
            nomePortugues,
            termosBusca,
            processamento: {
                precisouTraducao: !!resultadoTraducao,
                sucessoTraducao: resultadoTraducao ? !resultadoTraducao.erro : true,
                termoFinalGerado: termosBusca.termoPrincipal,
                timestamp: new Date().toISOString()
            }
        };
        
        logSucesso(`🎉 Processamento concluído:`);
        logInfo(`   📝 Original: "${nomeOriginal}"`);
        logInfo(`   🌐 Português: "${nomePortugues}"`);
        logInfo(`   🔍 Termo busca: "${termosBusca.termoPrincipal}"`);
        
        return resultado;
        
    } catch (error) {
        logErro(`💥 Erro no processamento do nome: ${error.message}`);
        
        // Retornar resultado de fallback
        return {
            nomeOriginal,
            deteccaoIdioma: { idioma: 'unknown', confianca: 0, precisaTraducao: true },
            traducao: null,
            nomePortugues: nomeOriginal,
            termosBusca: {
                original: nomeOriginal,
                termoPrincipal: nomeOriginal,
                termoReduzido: nomeOriginal,
                termoEssencial: nomeOriginal,
                variantes: [nomeOriginal]
            },
            processamento: {
                precisouTraducao: false,
                sucessoTraducao: false,
                termoFinalGerado: nomeOriginal,
                timestamp: new Date().toISOString(),
                erro: error.message
            }
        };
    }
}

/**
 * Função simplificada para obter apenas o termo de busca
 * @param {string} nomeOriginal - Nome original do produto
 * @returns {Promise<string>} Termo de busca otimizado
 */
export async function obterTermoBusca(nomeOriginal) {
    try {
        const resultado = await processarNomeProduto(nomeOriginal);
        return resultado.termosBusca.termoPrincipal;
    } catch (error) {
        logErro(`❌ Erro ao obter termo de busca: ${error.message}`);
        return nomeOriginal; // Fallback
    }
}

/**
 * Testa o sistema de tradução com alguns exemplos
 * @returns {Promise<void>}
 */
export async function testarSistemaTraducao() {
    try {
        logInfo('🧪 Testando sistema de tradução...');
        
        const exemplos = [
            'Smartphone Samsung Galaxy A54 128GB',
            'Wireless Bluetooth Earphones with Charging Case',
            'Kitchen Knife Set Professional Stainless Steel',
            'Smart Watch Fitness Tracker Heart Rate Monitor',
            'Camiseta Masculina Algodão 100% Premium'
        ];
        
        for (const exemplo of exemplos) {
            logInfo(`\n📱 Testando: "${exemplo}"`);
            const resultado = await processarNomeProduto(exemplo);
            logInfo(`   🎯 Resultado: "${resultado.termosBusca.termoPrincipal}"`);
        }
        
        logSucesso('✅ Teste do sistema de tradução concluído');
        
    } catch (error) {
        logErro(`❌ Erro no teste: ${error.message}`);
    }
}

export {
    TRADUTOR_CONFIG,
    detectarIdioma,
    traduzirTexto,
    gerarTermosDeBusca,
    inicializarGoogleTranslate
};
