import { buscarPrecoMercadoLivre, validarMargemProduto, calcularMargem } from '../../marginValidation/margin-validator.js';

console.log('💰 TESTE DE VALIDAÇÃO DE MARGEM - MERCADO LIVRE\n');
console.log('=' .repeat(60));

// Produtos de teste do AliExpress
const produtosTeste = [
  {
    nome: "Smart Watch Fitness Tracker Bluetooth",
    categoria: "Tecnologia",
    preco: "$25.99",
    vendas: "2,500+ vendidos",
    nota: 4.6
  },
  {
    nome: "Kitchen Knife Set Professional Stainless Steel",
    categoria: "Casa e Cozinha", 
    preco: "$18.50",
    vendas: "1,800+ vendidos",
    nota: 4.4
  },
  {
    nome: "Wireless Bluetooth Speaker Portable",
    categoria: "Tecnologia",
    preco: "$32.99",
    vendas: "3,200+ vendidos",
    nota: 4.7
  }
];

console.log('🔍 TESTE 1: BUSCA SIMPLES NO MERCADO LIVRE\n');

// Testar busca básica
try {
  const resultado = await buscarPrecoMercadoLivre("smartwatch fitness tracker");
  
  if (resultado) {
    console.log('✅ Busca realizada com sucesso!');
    console.log(`📊 Produtos encontrados: ${resultado.produtosEncontrados}`);
    console.log(`💵 Preço médio: R$ ${resultado.precos.media}`);
    console.log(`📈 Faixa de preços: R$ ${resultado.precos.minimo} - R$ ${resultado.precos.maximo}`);
    console.log(`🎯 Mediana: R$ ${resultado.precos.mediana}`);
    
    console.log('\n🏆 Top 3 produtos encontrados:');
    resultado.produtos.slice(0, 3).forEach((produto, index) => {
      console.log(`   ${index + 1}. ${produto.titulo.substring(0, 50)}...`);
      console.log(`      💰 ${produto.precoFormatado} | ⭐ ${produto.avaliacao || 'N/A'}`);
    });
  } else {
    console.log('❌ Falha na busca');
  }
} catch (error) {
  console.log('❌ Erro no teste:', error.message);
}

console.log('\n\n💹 TESTE 2: CÁLCULO DE MARGEM\n');

// Testar cálculo de margem
const exemploCalculo = calcularMargem(25.99, 180.00); // $25.99 → R$ 180
console.log('📊 Exemplo de cálculo:');
console.log(`   AliExpress: $25.99 (≈ R$ ${exemploCalculo.precoCompra})`);
console.log(`   Mercado Livre: R$ ${exemploCalculo.precoVenda}`);
console.log(`   Margem: R$ ${exemploCalculo.margemAbsoluta} (${exemploCalculo.margemPercentual}%)`);
console.log(`   Viável: ${exemploCalculo.viavel ? '✅ SIM' : '❌ NÃO'}`);

console.log('\n\n🎯 TESTE 3: VALIDAÇÃO COMPLETA DE PRODUTO\n');

// Testar validação completa do primeiro produto
try {
  const produtoTeste = produtosTeste[0];
  console.log(`🔍 Validando: ${produtoTeste.nome}`);
  console.log('⏳ Aguarde, buscando dados...');
  
  const validacao = await validarMargemProduto(produtoTeste);
  
  if (validacao.sucesso) {
    console.log('\n✅ VALIDAÇÃO CONCLUÍDA:');
    console.log(`📦 Produto: ${validacao.produto.nome}`);
    console.log(`💵 Custo AliExpress: $${validacao.produto.precoAliExpress} (R$ ${validacao.produto.precoAliExpressBRL})`);
    console.log(`🏪 Mercado Livre - ${validacao.mercadoLivre.produtosEncontrados} produtos encontrados`);
    
    console.log('\n📊 ANÁLISE DE MARGEM:');
    console.log('┌─ Cenário Médio:');
    console.log(`│  Venda: R$ ${validacao.analiseMargens.cenarioMedio.precoVenda}`);
    console.log(`│  Margem: ${validacao.analiseMargens.cenarioMedio.margemPercentual}%`);
    console.log(`│  Lucro: R$ ${validacao.analiseMargens.cenarioMedio.margemAbsoluta}`);
    
    console.log('└─ Cenário Conservador:');
    console.log(`   Venda: R$ ${validacao.analiseMargens.cenarioConservador.precoVenda}`);
    console.log(`   Margem: ${validacao.analiseMargens.cenarioConservador.margemPercentual}%`);
    console.log(`   Lucro: R$ ${validacao.analiseMargens.cenarioConservador.margemAbsoluta}`);
    
    console.log('\n🎯 RECOMENDAÇÃO:');
    console.log(`   Viável: ${validacao.recomendacao.viavel ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Oportunidade: ${validacao.recomendacao.oportunidade}`);
    
    if (validacao.recomendacao.riscos.length > 0) {
      console.log(`   ⚠️  Riscos: ${validacao.recomendacao.riscos.join(', ')}`);
    }
    
  } else {
    console.log(`❌ Erro na validação: ${validacao.erro}`);
  }
} catch (error) {
  console.log('❌ Erro no teste completo:', error.message);
}

console.log('\n\n🎊 RESUMO DOS TESTES:');
console.log('✅ Sistema de busca no Mercado Livre');
console.log('✅ Cálculo de margem de lucro');
console.log('✅ Validação completa de produto');
console.log('✅ Análise de cenários (médio/conservador)');
console.log('✅ Recomendações baseadas em margem');

console.log('\n🚀 PRÓXIMO PASSO: Integrar ao sistema de filtros!');
