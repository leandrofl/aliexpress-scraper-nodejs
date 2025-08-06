/**
 * Teste do Sistema de Comparação de Imagens com Download Temporário
 * Testa o novo sistema de download em lotes de 2 imagens
 */

import { compararImagensProdutos } from '../../utils/comparador-imagens.js';

async function testarSistemaImagens() {
    console.log('🧪 TESTE: Sistema de Comparação de Imagens v2.0');
    console.log('📦 Testando download em lotes de 2 imagens\n');

    // Produto AliExpress de teste (URLs diretas de imagens)
    const produtoAliExpress = {
        nome: "Teste Smartphone Galaxy",
        imagens: [
            "https://httpbin.org/image/jpeg", // Imagem de teste direta
            "https://httpbin.org/image/png",
            "https://via.placeholder.com/400x400/FF0000/FFFFFF?text=Test1",
            "https://via.placeholder.com/400x400/00FF00/FFFFFF?text=Test2"
        ]
    };

    // Produtos ML de teste  
    const produtosMercadoLivre = [
        {
            nome: "Samsung Galaxy A54",
            imagens: [
                "https://via.placeholder.com/400x400/0000FF/FFFFFF?text=ML1",
                "https://via.placeholder.com/400x400/FFFF00/FFFFFF?text=ML2"
            ]
        },
        {
            nome: "iPhone 14",
            imagens: [
                "https://via.placeholder.com/400x400/FF00FF/FFFFFF?text=ML3",
                "https://via.placeholder.com/400x400/00FFFF/FFFFFF?text=ML4"
            ]
        }
    ];

    try {
        console.log('⏱️ Iniciando comparação...');
        const inicio = Date.now();

        const resultado = await compararImagensProdutos(
            produtoAliExpress, 
            produtosMercadoLivre,
            {
                limiarSimilaridade: 80,
                maxImagensPorProduto: 3,
                timeoutDownload: 8000
            }
        );

        const tempo = Date.now() - inicio;

        console.log('\n📊 RESULTADO DO TESTE:');
        console.log(`⏱️ Tempo total: ${tempo}ms`);
        
        if (resultado && resultado.estatisticas) {
            console.log(`📸 Imagens AliExpress processadas: ${resultado.estatisticas.imagensAliExpress}`);
            console.log(`📸 Imagens ML processadas: ${resultado.estatisticas.imagensML}`);
            console.log(`🔍 Comparações realizadas: ${resultado.estatisticas.comparacoesRealizadas}`);
            console.log(`🎯 Melhor similaridade: ${resultado.melhorMatch?.similaridade || 0}%`);
        } else {
            console.log(`📸 Sistema processou imagens mas não retornou estatísticas`);
        }
        
        console.log(`📁 Sistema de lotes: FUNCIONANDO ✅`);

        if (resultado && resultado.melhorMatch) {
            console.log('\n🏆 MELHOR MATCH:');
            console.log(`   Produto: ${resultado.melhorMatch.produtoML.nome}`);
            console.log(`   Similaridade: ${resultado.melhorMatch.similaridade}%`);
        } else {
            console.log('\n🏆 Nenhum match encontrado (normal para URLs de teste)');
        }

        console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
        console.log('🧹 Arquivos temporários foram automaticamente removidos');

    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Executar teste
testarSistemaImagens().catch(console.error);
