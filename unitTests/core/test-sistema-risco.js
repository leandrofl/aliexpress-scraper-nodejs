/**
 * Script de teste para o sistema de análise de risco
 * Testa todas as funcionalidades implementadas baseadas nas sugestões do ChatGPT
 */

import { calcularRiscoProduto, determinarMetodoValidacao, permiteValidacaoTextual, gerarRelatorioRisco } from '../../utils/calculadora-risco.js';

console.log('🧪 TESTANDO SISTEMA DE ANÁLISE DE RISCO\n');

// Casos de teste
const casosTeste = [
    {
        nome: 'Smartphone sem imagem comparada',
        produto: {
            nome: 'iPhone 15 Pro Max',
            categoria: 'eletrônicos',
            preco_aliexpress: 500,
            imagem_comparada: false,
            imagem_match: false,
            score_texto: 45,
            score_total: 60,
            ratio_preco: 2.5
        }
    },
    {
        nome: 'Produto de casa com fallback textual',
        produto: {
            nome: 'Panela de pressão',
            categoria: 'casa e jardim',
            preco_aliexpress: 80,
            imagem_comparada: false,
            imagem_match: false,
            score_texto: 75,
            score_total: 80,
            match_por_texto: true,
            ratio_preco: 3.0
        }
    },
    {
        nome: 'Produto com imagem OK',
        produto: {
            nome: 'Relógio inteligente',
            categoria: 'acessórios',
            preco_aliexpress: 120,
            imagem_comparada: true,
            imagem_match: true,
            score_imagem: 85,
            score_total: 90,
            ratio_preco: 2.2
        }
    },
    {
        nome: 'Produto com erro de imagem',
        produto: {
            nome: 'Fone de ouvido',
            categoria: 'eletrônicos',
            preco_aliexpress: 50,
            imagem_comparada: false,
            imagem_match: false,
            imagem_erro: 'timeout',
            score_texto: 30,
            score_total: 40,
            ratio_preco: 1.5 // Margem muito baixa
        }
    },
    {
        nome: 'Produto suspeito - margem muito alta',
        produto: {
            nome: 'Cabo USB',
            categoria: 'tecnologia',
            preco_aliexpress: 10,
            imagem_comparada: true,
            imagem_match: true,
            score_imagem: 60,
            score_total: 70,
            ratio_preco: 8.0 // Margem suspeita de 800%
        }
    }
];

casosTeste.forEach((caso, index) => {
    console.log(`\n${index + 1}. 🧪 TESTE: ${caso.nome}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Testar cálculo de risco
    const analiseRisco = calcularRiscoProduto(caso.produto);
    console.log(`📊 Risco Final: ${analiseRisco.riscoFinal}/100 (${analiseRisco.classificacaoRisco})`);
    console.log(`⚠️ Pendente Revisão: ${analiseRisco.pendenteRevisao ? 'SIM' : 'NÃO'}`);
    console.log(`📋 Detalhes: ${analiseRisco.detalhesRisco.join(', ')}`);
    
    // Testar método de validação
    const metodo = determinarMetodoValidacao(caso.produto);
    console.log(`🔍 Método Validação: ${metodo}`);
    
    // Testar permissão de validação textual
    const permiteTexto = permiteValidacaoTextual(caso.produto);
    console.log(`✅ Permite Fallback Textual: ${permiteTexto ? 'SIM' : 'NÃO'}`);
    
    // Gerar relatório completo
    const relatorio = gerarRelatorioRisco(caso.produto);
    console.log(`🎯 Recomendação: ${relatorio.recomendacao}`);
});

console.log('\n\n🏆 TESTE DE CENÁRIOS EXTREMOS\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Cenário extremo: produto perfeito
const produtoPerfeito = {
    nome: 'Produto ideal',
    categoria: 'casa',
    preco_aliexpress: 100,
    imagem_comparada: true,
    imagem_match: true,
    score_imagem: 95,
    score_texto: 90,
    score_total: 95,
    ratio_preco: 3.0
};

console.log('\n🌟 Produto PERFEITO:');
const riscoPerfeito = calcularRiscoProduto(produtoPerfeito);
console.log(`Risco: ${riscoPerfeito.riscoFinal}/100 (${riscoPerfeito.classificacaoRisco})`);

// Cenário extremo: produto péssimo
const produtoPessimo = {
    nome: 'Produto péssimo',
    categoria: 'eletrônicos',
    preco_aliexpress: 200,
    imagem_comparada: false,
    imagem_match: false,
    imagem_erro: '404',
    score_texto: 20,
    score_total: 30,
    ratio_preco: 0.8 // Margem negativa
};

console.log('\n💀 Produto PÉSSIMO:');
const riscoPessimo = calcularRiscoProduto(produtoPessimo);
console.log(`Risco: ${riscoPessimo.riscoFinal}/100 (${riscoPessimo.classificacaoRisco})`);
console.log(`Detalhes: ${riscoPessimo.detalhesRisco.join(', ')}`);

console.log('\n\n✅ TESTES CONCLUÍDOS!');
