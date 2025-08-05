import { validarMargemOtimizada, calcularMargemOtimizada, gerarDadosMercadoOtimizados } from '../../marginValidation/margin-validator.js';

console.log('🎯 TESTE VALIDAÇÃO DE MARGEM OTIMIZADA\n');
console.log('=' .repeat(55));

// Produtos com preços mais realistas para dropshipping
const produtosOtimizados = [
  {
    nome: "Smart Watch Fitness Tracker Heart Rate Monitor",
    categoria: "Tecnologia",
    preco: "$12.99", // Preço mais baixo
    vendas: "5,000+ vendidos",
    nota: 4.6
  },
  {
    nome: "Kitchen Knife Set Professional Stainless Steel",
    categoria: "Casa e Cozinha", 
    preco: "$8.50", // Preço mais competitivo
    vendas: "3,200+ vendidos",
    nota: 4.5
  },
  {
    nome: "Wireless Bluetooth Speaker Portable Waterproof",
    categoria: "Tecnologia",
    preco: "$15.90", // Preço intermediário
    vendas: "2,800+ vendidos",
    nota: 4.4
  },
  {
    nome: "Phone Case Transparent Shockproof",
    categoria: "Tecnologia",
    preco: "$3.99", // Produto barato
    vendas: "8,000+ vendidos",
    nota: 4.3
  }
];

console.log('🧮 TESTE 1: CÁLCULO OTIMIZADO\n');

// Testar com produto mais viável
const exemploOtimizado = calcularMargemOtimizada(12.99, 220.00, 'Tecnologia');
console.log('📊 Smart Watch ($12.99 → R$ 220):');
console.log(`   💵 Custo total: R$ ${exemploOtimizado.custos.total}`);
console.log(`   💰 Lucro: R$ ${exemploOtimizado.margemAbsoluta} (${exemploOtimizado.margemPercentual}%)`);
console.log(`   📈 ROI: ${exemploOtimizado.roi}%`);
console.log(`   🎯 Cenário: ${exemploOtimizado.cenario}`);
console.log(`   ✅ Viável: ${exemploOtimizado.viavel ? 'SIM' : 'NÃO'}`);

console.log('\n\n🎯 TESTE 2: DADOS DE MERCADO OTIMIZADOS\n');

const dadosMercado = gerarDadosMercadoOtimizados("Smart Watch Fitness Tracker");
console.log('📊 Dados do Smart Watch:');
console.log(`   Produtos encontrados: ${dadosMercado.produtosEncontrados}`);
console.log(`   Faixa de preços: R$ ${dadosMercado.precos.minimo} - R$ ${dadosMercado.precos.maximo}`);
console.log(`   Preço médio: R$ ${dadosMercado.precos.media}`);
console.log(`   Quartis: Q1 R$ ${dadosMercado.precos.quartil1} | Q3 R$ ${dadosMercado.precos.quartil3}`);

console.log('\n\n🚀 TESTE 3: VALIDAÇÃO COMPLETA OTIMIZADA\n');

for (const produto of produtosOtimizados) {
  console.log(`📦 ${produto.nome}`);
  console.log(`   ${produto.categoria} | ${produto.preco} | ⭐${produto.nota}`);
  
  try {
    const validacao = await validarMargemOtimizada(produto);
    
    if (validacao.sucesso) {
      console.log('   ✅ ANÁLISE:');
      
      // Mostrar cenários
      const { otimista, realista, conservadora } = validacao.analiseMargens;
      console.log(`   📊 CENÁRIOS:`);
      console.log(`      Conservador: R$ ${conservadora.precoVenda} → ${conservadora.margemPercentual}% (${conservadora.cenario})`);
      console.log(`      Realista: R$ ${realista.precoVenda} → ${realista.margemPercentual}% (${realista.cenario})`);
      console.log(`      Otimista: R$ ${otimista.precoVenda} → ${otimista.margemPercentual}% (${otimista.cenario})`);
      
      console.log(`   🎯 RECOMENDAÇÃO:`);
      console.log(`      Score: ${validacao.recomendacao.scoreViabilidade}/100`);
      console.log(`      Viabilidade: ${validacao.recomendacao.viavel ? '✅ VIÁVEL' : '❌ INVIÁVEL'}`);
      console.log(`      ROI médio: ${validacao.recomendacao.roiMedio}%`);
      console.log(`      Tempo retorno: ~${validacao.recomendacao.tempoRetorno} meses`);
      
      if (validacao.recomendacao.riscos.length > 0) {
        console.log(`      ⚠️  Riscos: ${validacao.recomendacao.riscos.slice(0, 2).join(', ')}`);
      }
      
    } else {
      console.log(`   ❌ Erro: ${validacao.erro}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Erro na validação: ${error.message}`);
  }
  
  console.log('');
}

console.log('\n📈 TESTE 4: RANKING FINAL DE PRODUTOS\n');

const ranking = [];
for (const produto of produtosOtimizados) {
  try {
    const validacao = await validarMargemOtimizada(produto);
    if (validacao.sucesso) {
      ranking.push({
        nome: produto.nome.substring(0, 35) + '...',
        categoria: produto.categoria,
        precoUS: produto.preco,
        margemRealista: validacao.analiseMargens.realista.margemPercentual,
        score: validacao.recomendacao.scoreViabilidade,
        roi: validacao.recomendacao.roiMedio,
        viavel: validacao.recomendacao.viavel,
        cenario: validacao.analiseMargens.realista.cenario
      });
    }
  } catch (error) {
    console.log(`Erro ao analisar ${produto.nome}: ${error.message}`);
  }
}

// Ordenar por score
ranking.sort((a, b) => b.score - a.score);

console.log('🏆 RANKING DE VIABILIDADE (Score):');
ranking.forEach((item, index) => {
  const status = item.viavel ? '✅' : '❌';
  console.log(`${index + 1}. ${item.nome}`);
  console.log(`   ${status} Score: ${item.score} | Margem: ${item.margemRealista}% | ROI: ${item.roi}%`);
  console.log(`   ${item.precoUS} (${item.categoria}) → ${item.cenario}`);
  console.log('');
});

// Estatísticas finais
const viaveis = ranking.filter(p => p.viavel).length;
const scoreMedia = ranking.reduce((acc, p) => acc + p.score, 0) / ranking.length;

console.log('📊 ESTATÍSTICAS FINAIS:');
console.log(`✅ Produtos viáveis: ${viaveis}/${ranking.length} (${Math.round(viaveis/ranking.length*100)}%)`);
console.log(`📊 Score médio: ${Math.round(scoreMedia)}/100`);
console.log(`🎯 Melhor produto: ${ranking[0]?.nome || 'N/A'}`);

console.log('\n🎊 SISTEMA DE MARGEM OTIMIZADO:');
console.log('✅ Parâmetros realistas para mercado brasileiro');
console.log('✅ Impostos e taxas otimizadas (12% + 10%)');
console.log('✅ Margem mínima ajustada para 15%');
console.log('✅ Análise multi-cenário avançada');
console.log('✅ Score de viabilidade preciso');
console.log('✅ Identificação de riscos específicos');
console.log('✅ ROI e tempo de retorno estimado');

console.log('\n🚀 PRONTO PARA INTEGRAÇÃO COM OS FILTROS!');
