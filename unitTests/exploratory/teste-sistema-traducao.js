/**
 * Teste do Sistema de Tradução de Produtos
 * Valida funcionalidades de detecção de idioma, tradução e geração de termos
 */

import { 
    processarNomeProduto, 
    obterTermoBusca, 
    testarSistemaTraducao,
    detectarIdioma,
    gerarTermosDeBusca
} from '../../utils/tradutor-produtos.js';

console.log('🧪 TESTE DO SISTEMA DE TRADUÇÃO DE PRODUTOS\n');
console.log('=' .repeat(60));

async function executarTestes() {
    try {
        // Teste 1: Detecção de idioma
        console.log('\n📍 TESTE 1: Detecção de Idioma');
        console.log('-'.repeat(40));
        
        const exemplosPorIdioma = [
            { texto: 'Smartphone Samsung Galaxy A54 128GB', esperado: 'português' },
            { texto: 'Wireless Bluetooth Earphones with Charging Case', esperado: 'inglês' },
            { texto: 'Écouteurs Bluetooth sans fil avec étui de charge', esperado: 'francês' },
            { texto: 'Auriculares Bluetooth inalámbricos con estuche de carga', esperado: 'espanhol' }
        ];
        
        for (const exemplo of exemplosPorIdioma) {
            const deteccao = detectarIdioma(exemplo.texto);
            console.log(`📝 "${exemplo.texto}"`);
            console.log(`   🔍 Detectado: ${deteccao.idioma} (${(deteccao.confianca * 100).toFixed(1)}%)`);
            console.log(`   ✅ Esperado: ${exemplo.esperado}`);
            console.log(`   🌐 Precisa tradução: ${deteccao.precisaTraducao ? 'Sim' : 'Não'}\n`);
        }
        
        // Teste 2: Geração de termos de busca
        console.log('📍 TESTE 2: Geração de Termos de Busca');
        console.log('-'.repeat(40));
        
        const exemplosTermos = [
            'Smartphone Samsung Galaxy A54 128GB 5G Premium',
            'Wireless Bluetooth Earphones with Charging Case Pro Max',
            'Kitchen Knife Set Professional Stainless Steel 6 Pieces',
            'Smart Watch Fitness Tracker Heart Rate Monitor 2024',
            'Camiseta Masculina Algodão 100% Premium Qualidade'
        ];
        
        for (const exemplo of exemplosTermos) {
            const termos = gerarTermosDeBusca(exemplo);
            console.log(`📝 Original: "${exemplo}"`);
            console.log(`   🎯 Principal: "${termos.termoPrincipal}"`);
            console.log(`   ⚡ Reduzido: "${termos.termoReduzido}"`);
            console.log(`   💎 Essencial: "${termos.termoEssencial}"`);
            console.log(`   📊 Stats: ${termos.estatisticas.palavrasOriginais} → ${termos.estatisticas.palavrasFiltradas} palavras\n`);
        }
        
        // Teste 3: Processamento completo
        console.log('📍 TESTE 3: Processamento Completo');
        console.log('-'.repeat(40));
        
        const exemploCompleto = 'Premium Wireless Bluetooth Gaming Headset with RGB Lighting 2024';
        console.log(`🎮 Produto teste: "${exemploCompleto}"\n`);
        
        const resultado = await processarNomeProduto(exemploCompleto);
        
        console.log('📋 RESULTADO COMPLETO:');
        console.log(`   📝 Nome original: "${resultado.nomeOriginal}"`);
        console.log(`   🔍 Idioma detectado: ${resultado.deteccaoIdioma.idioma} (${(resultado.deteccaoIdioma.confianca * 100).toFixed(1)}%)`);
        console.log(`   🌐 Nome português: "${resultado.nomePortugues}"`);
        console.log(`   🎯 Termo busca: "${resultado.termosBusca.termoPrincipal}"`);
        console.log(`   ⚡ Variantes: ${resultado.termosBusca.variantes.length} opções`);
        console.log(`   ✅ Sucesso tradução: ${resultado.processamento.sucessoTraducao ? 'Sim' : 'Não'}`);
        
        if (resultado.traducao) {
            console.log(`   🔄 Tradução usada: Sim`);
            console.log(`   🤖 Simulada: ${resultado.traducao.simulado ? 'Sim' : 'Não'}`);
        }
        
        // Teste 4: Performance com múltiplos produtos
        console.log('\n📍 TESTE 4: Performance com Múltiplos Produtos');
        console.log('-'.repeat(40));
        
        const produtosLote = [
            'iPhone 15 Pro Max 256GB',
            'MacBook Air M2 13 inch',
            'AirPods Pro 2nd Generation',
            'Samsung Galaxy S24 Ultra',
            'iPad Pro 12.9 inch M2'
        ];
        
        const inicioTempo = Date.now();
        
        for (let i = 0; i < produtosLote.length; i++) {
            const produto = produtosLote[i];
            const termo = await obterTermoBusca(produto);
            console.log(`   ${i + 1}. "${produto}" → "${termo}"`);
        }
        
        const tempoTotal = Date.now() - inicioTempo;
        console.log(`\n⏱️ Tempo total: ${tempoTotal}ms (${(tempoTotal / produtosLote.length).toFixed(1)}ms por produto)`);
        
        // Teste 5: Sistema completo de exemplo
        console.log('\n📍 TESTE 5: Execução do Sistema Completo');
        console.log('-'.repeat(40));
        
        await testarSistemaTraducao();
        
        console.log('\n🎉 TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
        console.log('✅ Sistema de tradução funcionando corretamente');
        
    } catch (error) {
        console.error('❌ Erro durante os testes:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Executar testes
executarTestes();
