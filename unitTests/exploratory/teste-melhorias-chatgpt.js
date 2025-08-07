/**
 * Teste das melhorias implementadas pelo ChatGPT
 * - Comparação visual melhorada
 * - Busca no ML otimizada  
 * - Termos de busca traduzidos e limpos
 */

import { compararImagensPorHash } from './utils/comparador-imagens.js';
import { gerarTermosDeBusca, produtosSaoCompativeis } from './utils/comparador-produtos.js';
import { buscarMelhorProdutoML } from './marginValidation/mercado-livre-scraper.js';

async function testarMelhorias() {
    console.log('🧪 TESTE: Melhorias do ChatGPT\n');

    try {
        // Teste 1: Geração de termos de busca limpos
        console.log('📝 TESTE 1: Geração de Termos de Busca');
        const nomeSujo = "Premium Wireless Gaming Headset RGB LED Frete Grátis Novo 2024 Oferta";
        const termosLimpos = gerarTermosDeBusca(nomeSujo);
        console.log(`   📤 Original: "${nomeSujo}"`);
        console.log(`   🧹 Limpo: "${termosLimpos}"`);

        // Teste 2: Comparação de compatibilidade de produtos
        console.log('\n🔍 TESTE 2: Compatibilidade de Produtos');
        const produtoAli = {
            nome: "Wireless Gaming Headset",
            nomeTraduzido: "Headset Gamer Sem Fio",
            precoBRL: 50
        };
        
        const produtoML = {
            nome: "Headset Gamer Bluetooth RGB",
            preco: 120
        };

        const compatibilidade = produtosSaoCompativeis(produtoAli, produtoML);
        console.log(`   🎯 Compatível: ${compatibilidade.compatível ? '✅' : '❌'}`);
        console.log(`   📊 Score: ${compatibilidade.score}%`);
        console.log(`   💰 Preços: Ali R$${compatibilidade.precoAli} → ML R$${compatibilidade.precoML}`);
        console.log(`   🏷️ Termos comuns: [${compatibilidade.intersecao.join(', ')}]`);

        // Teste 3: Comparação visual de imagens (URLs de teste)
        console.log('\n🖼️ TESTE 3: Comparação Visual');
        try {
            const img1 = "https://via.placeholder.com/300x300/FF0000/FFFFFF?text=TestA";
            const img2 = "https://via.placeholder.com/300x300/FF0000/FFFFFF?text=TestA"; // Mesma imagem
            
            const comparacao = await compararImagensPorHash(img1, img2);
            console.log(`   📸 Hash 1: ${comparacao.hash1.substring(0, 16)}...`);
            console.log(`   📸 Hash 2: ${comparacao.hash2.substring(0, 16)}...`);
            console.log(`   📏 Distância: ${comparacao.distancia}`);
            console.log(`   🎯 Similaridade: ${comparacao.similaridade}%`);
            console.log(`   ✅ Similar: ${comparacao.similar ? 'Sim' : 'Não'}`);
        } catch (err) {
            console.log(`   ⚠️ Erro na comparação visual: ${err.message}`);
        }

        // Teste 4: Busca no Mercado Livre (simulação)
        console.log('\n🛒 TESTE 4: Busca no Mercado Livre');
        try {
            const produtoTeste = {
                nome: "Smartphone Samsung Galaxy",
                nomeTraduzido: "Smartphone Samsung Galaxy",
                imagemURL: "https://via.placeholder.com/300x300/0000FF/FFFFFF?text=Samsung"
            };

            const resultado = await buscarMelhorProdutoML(produtoTeste);
            
            if (resultado) {
                console.log(`   ✅ Produto encontrado: ${resultado.nome}`);
                console.log(`   💰 Preço: R$ ${resultado.preco}`);
                console.log(`   📊 Similaridade visual: ${resultado.similaridade}%`);
            } else {
                console.log(`   ⚠️ Nenhum produto compatível encontrado`);
            }
        } catch (err) {
            console.log(`   ⚠️ Erro na busca ML: ${err.message}`);
        }

        console.log('\n🎉 TESTES CONCLUÍDOS!');
        console.log('\n📋 MELHORIAS IMPLEMENTADAS:');
        console.log('   ✅ Comparação visual com imghash + axios');
        console.log('   ✅ Termos de busca limpos e otimizados');
        console.log('   ✅ Busca ML com cheerio (mais rápida)');
        console.log('   ✅ Sistema de compatibilidade inteligente');
        console.log('   ✅ Integração com sistema de tradução');

    } catch (error) {
        console.error('❌ Erro nos testes:', error.message);
    }
}

// Executar testes
testarMelhorias();
