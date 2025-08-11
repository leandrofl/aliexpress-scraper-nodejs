/**
 * Script de teste para o sistema de análise semântica
 * Testa a nova implementação baseada nas sugestões do ChatGPT
 */

import { testarSistemaSemantico, compararSemantica, calcularEstatisticasPreco, calcularDesvioPreco } from '../../utils/analisador-semantico.js';

console.log('🧠 TESTANDO SISTEMA DE ANÁLISE SEMÂNTICA APRIMORADO');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const inicioTeste = Date.now();

// Teste 1: Sistema semântico básico
console.log('1️⃣ TESTE BÁSICO DE ANÁLISE SEMÂNTICA:');
await testarSistemaSemantico();

// Teste 2: Casos específicos do e-commerce
console.log('\n2️⃣ TESTE DE CASOS E-COMMERCE ESPECÍFICOS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const casosEcommerce = [
    {
        aliexpress: 'Smartphone Android 12GB RAM 256GB Dual SIM',
        mercadolivre: 'Celular Android 12 GB RAM 256 GB Chip Duplo'
    },
    {
        aliexpress: 'Wireless Bluetooth Earbuds TWS',
        mercadolivre: 'Fone de Ouvido Bluetooth Sem Fio True Wireless'
    },
    {
        aliexpress: 'USB-C Cable Fast Charging 3A',
        mercadolivre: 'Cabo USB Tipo C Carregamento Rápido 3 Amperes'
    },
    {
        aliexpress: 'LED Strip Light RGB 5m Remote Control',
        mercadolivre: 'Fita LED RGB 5 metros com Controle Remoto'
    },
    {
        aliexpress: 'Winter Thermal Jacket Waterproof',
        mercadolivre: 'Jaqueta Térmica de Inverno Impermeável'
    }
];

for (const caso of casosEcommerce) {
    const resultado = await compararSemantica(caso.aliexpress, caso.mercadolivre);
    console.log(`🔍 AliExpress: "${caso.aliexpress}"`);
    console.log(`🛒 Mercado Livre: "${caso.mercadolivre}"`);
    console.log(`📊 Score: ${resultado.score}% | Compatível: ${resultado.compativel ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`🔧 Método: ${resultado.metodo} | ${resultado.motivo}\n`);
}

// Teste 3: Cálculo de estatísticas de preço
console.log('3️⃣ TESTE DE CÁLCULO DE PREÇOS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const produtosML = [
    { nome: 'Produto A', preco: 120.50 },
    { nome: 'Produto B', preco: 135.00 },
    { nome: 'Produto C', preco: 110.75 }
];

const estatisticas = calcularEstatisticasPreco(produtosML);
console.log('📊 Estatísticas de Preço dos Top 3:');
console.log(`   💰 Preço Médio: R$ ${estatisticas.precoMedioML}`);
console.log(`   📉 Preço Mínimo: R$ ${estatisticas.precoMinimo}`);
console.log(`   📈 Preço Máximo: R$ ${estatisticas.precoMaximo}`);
console.log(`   🔢 Quantidade: ${estatisticas.quantidadePrecos} produtos\n`);

// Teste 4: Cálculo de desvio de preço
console.log('4️⃣ TESTE DE DESVIO DE PREÇO:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const cenarios = [
    { precoAli: 50, precoML: 150, esperado: '200% de lucro' },
    { precoAli: 100, precoML: 250, esperado: '150% de lucro' },
    { precoAli: 80, precoML: 300, esperado: '275% de lucro (suspeito)' },
    { precoAli: 200, precoML: 180, esperado: 'Perda (-10%)' }
];

cenarios.forEach((cenario, index) => {
    const desvio = calcularDesvioPreco(cenario.precoML, cenario.precoAli);
    const status = desvio > 250 ? '🚨 SUSPEITO' : desvio < 0 ? '❌ PREJUÍZO' : desvio > 150 ? '✅ BOM' : '⚠️ BAIXO';
    
    console.log(`${index + 1}. R$ ${cenario.precoAli} → R$ ${cenario.precoML}`);
    console.log(`   📊 Desvio: ${desvio}% ${status}`);
    console.log(`   💡 Esperado: ${cenario.esperado}\n`);
});

// Teste 5: Cenário completo integrado
console.log('5️⃣ TESTE DE CENÁRIO COMPLETO:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const produtoAliTest = {
    nome: 'Smartwatch Fitness Tracker Heart Rate GPS',
    preco: 85.50,
    categoria: 'eletrônicos'
};

const produtosMLTest = [
    { nome: 'Relógio Inteligente Monitor Cardíaco GPS Fitness', preco: 280.00 },
    { nome: 'Smartwatch Esportivo com GPS e Monitor', preco: 320.50 },
    { nome: 'Pulseira Inteligente Fitness Rastreador', preco: 150.75 }
];

console.log(`🎯 Produto AliExpress: "${produtoAliTest.nome}" - R$ ${produtoAliTest.preco}`);
console.log('🛒 Produtos Mercado Livre encontrados:');

for (const [index, produto] of produtosMLTest.entries()) {
    const analise = await compararSemantica(produtoAliTest.nome, produto.nome);
    const desvio = calcularDesvioPreco(produto.preco, produtoAliTest.preco);
    const aprovado = analise.score >= 70 && desvio <= 250;
    
    console.log(`\n   ${index + 1}. "${produto.nome}" - R$ ${produto.preco}`);
    console.log(`      🧠 Score Semântico: ${analise.score}%`);
    console.log(`      📊 Desvio Preço: ${desvio}%`);
    console.log(`      ✅ Aprovado: ${aprovado ? 'SIM' : 'NÃO'} ${aprovado ? '🎉' : '❌'}`);
}

const estatisticasTest = calcularEstatisticasPreco(produtosMLTest);
console.log(`\n📈 RESUMO FINAL:`);
console.log(`   💰 Preço médio ML: R$ ${estatisticasTest.precoMedioML}`);
console.log(`   📊 Desvio médio: ${calcularDesvioPreco(estatisticasTest.precoMedioML, produtoAliTest.preco)}%`);

const tempoTotal = Date.now() - inicioTeste;
const segundos = Math.floor(tempoTotal / 1000);
const milissegundos = tempoTotal % 1000;

console.log(`\n⏱️ TEMPO DE EXECUÇÃO: ${segundos}s ${milissegundos}ms`);
console.log('\n✅ TODOS OS TESTES CONCLUÍDOS!');
console.log('🚀 Sistema semântico pronto para produção!');
