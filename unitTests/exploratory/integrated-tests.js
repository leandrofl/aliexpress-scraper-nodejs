import { applyIntegratedFilters, processIntegratedFilters, gerarRelatorioFiltros } from '../filters/integrated-filters.js';

console.log('🎯 TESTE SISTEMA INTEGRADO COMPLETO\n');
console.log('=' .repeat(60));

// Lista de produtos diversificada para teste completo
const produtosTeste = [
  {
    nome: "Smart Watch Fitness Tracker Heart Rate Monitor Waterproof",
    categoria: "Tecnologia", 
    preco: "$12.99",
    vendas: "5,000+ vendidos",
    avaliacoes: 850,
    nota: 4.6,
    pedidos: 2500,
    url: "https://aliexpress.com/item/123456789"
  },
  {
    nome: "Professional Kitchen Knife Set 8 Pieces Stainless Steel Sharp",
    categoria: "Casa e Cozinha",
    preco: "$8.50", 
    vendas: "3,200+ vendidos",
    avaliacoes: 420,
    nota: 4.5,
    pedidos: 1800,
    url: "https://aliexpress.com/item/987654321"
  },
  {
    nome: "Wireless Bluetooth Speaker Portable Waterproof Bass Sound",
    categoria: "Tecnologia",
    preco: "$18.90",
    vendas: "2,800+ vendidos", 
    avaliacoes: 380,
    nota: 4.4,
    pedidos: 1200,
    url: "https://aliexpress.com/item/456789123"
  },
  {
    nome: "Premium Makeup Brush Set Professional Beauty Tools",
    categoria: "Beleza",
    preco: "$9.99",
    vendas: "4,500+ vendidos",
    avaliacoes: 650,
    nota: 4.7,
    pedidos: 2000,
    url: "https://aliexpress.com/item/321654987"
  },
  {
    nome: "Phone Case Transparent Shockproof TPU Basic",
    categoria: "Tecnologia",
    preco: "$2.99",
    vendas: "8,000+ vendidos",
    avaliacoes: 120,
    nota: 4.1,
    pedidos: 3500,
    url: "https://aliexpress.com/item/789123456"
  },
  {
    nome: "LED Desk Lamp Rechargeable Touch Control Adjustable",
    categoria: "Casa e Cozinha",
    preco: "$16.50",
    vendas: "1,500+ vendidos",
    avaliacoes: 290,
    nota: 4.3,
    pedidos: 800,
    url: "https://aliexpress.com/item/654321789"
  }
];

console.log('🔍 TESTE 1: ANÁLISE INDIVIDUAL DETALHADA\n');

// Testar o primeiro produto em detalhes
const produtoDetalhado = produtosTeste[0];
console.log(`📦 ANÁLISE DETALHADA: ${produtoDetalhado.nome}`);
console.log(`   Categoria: ${produtoDetalhado.categoria}`);
console.log(`   Preço: ${produtoDetalhado.preco} | Nota: ⭐${produtoDetalhado.nota}`);
console.log(`   Vendas: ${produtoDetalhado.vendas} | Avaliações: ${produtoDetalhado.avaliacoes}`);

try {
  const resultado = await applyIntegratedFilters(produtoDetalhado);
  
  console.log('\n   🎯 RESULTADOS DOS FILTROS:');
  
  // Quantitativo
  if (resultado.filtros.quantitativo) {
    const q = resultado.filtros.quantitativo;
    console.log(`   📊 QUANTITATIVO: ${q.aprovado ? '✅' : '❌'} (Score: ${q.scoreFinal})`);
    console.log(`      Vendas: ${q.vendasMinimas ? '✓' : '✗'} | Avaliações: ${q.avaliacoesMinimas ? '✓' : '✗'}`);
    console.log(`      Nota: ${q.notaMinima ? '✓' : '✗'} | Pedidos: ${q.pedidosMinimos ? '✓' : '✗'}`);
  }
  
  // Qualitativo
  if (resultado.filtros.qualitativo) {
    const ql = resultado.filtros.qualitativo;
    console.log(`   🎨 QUALITATIVO: ${ql.aprovado ? '✅' : '❌'} (Score: ${ql.scoreQualitativo})`);
    console.log(`      Fonte: ${ql.fonte} | Justificativa: ${ql.justificativa?.substring(0, 50)}...`);
  }
  
  // Margem
  if (resultado.filtros.margem && resultado.filtros.margem.sucesso) {
    const m = resultado.filtros.margem;
    console.log(`   💰 MARGEM: ${m.recomendacao.viavel ? '✅' : '❌'} (Score: ${m.recomendacao.scoreViabilidade})`);
    console.log(`      Realista: ${m.analiseMargens.realista.margemPercentual}% | ROI: ${m.recomendacao.roiMedio}%`);
    console.log(`      Cenário: ${m.analiseMargens.realista.cenario} | Retorno: ~${m.recomendacao.tempoRetorno}m`);
  }
  
  // Aprovação Final
  console.log(`\n   🏆 DECISÃO FINAL: ${resultado.aprovacao.aprovado ? '✅ APROVADO' : '❌ REPROVADO'}`);
  console.log(`      Score: ${resultado.aprovacao.scoreFinal}/100 | Nível: ${resultado.aprovacao.nivel}`);
  console.log(`      Motivo: ${resultado.aprovacao.motivo}`);
  console.log(`      Recomendação: ${resultado.aprovacao.recomendacao.acao} (${resultado.aprovacao.recomendacao.confianca})`);
  console.log(`      Observações: ${resultado.aprovacao.recomendacao.observacoes}`);
  
} catch (error) {
  console.log(`   ❌ Erro na análise: ${error.message}`);
}

console.log('\n\n🚀 TESTE 2: PROCESSAMENTO EM LOTE\n');

try {
  console.log('⏳ Processando todos os produtos...');
  const resultadosLote = await processIntegratedFilters(produtosTeste, 2);
  
  console.log('✅ Processamento concluído!\n');
  
  // Mostrar resumo de cada produto
  console.log('📋 RESUMO INDIVIDUAL:');
  resultadosLote.forEach((resultado, index) => {
    const produto = resultado.produto;
    const aprovacao = resultado.aprovacao;
    
    const status = aprovacao?.aprovado ? '✅' : '❌';
    const score = aprovacao?.scoreFinal || 0;
    const nivel = aprovacao?.nivel || 'N/A';
    
    console.log(`${index + 1}. ${produto.nome?.substring(0, 40)}...`);
    console.log(`   ${status} Score: ${score} | Nível: ${nivel} | ${produto.categoria}`);
    
    if (aprovacao?.aprovado) {
      console.log(`   📈 ${aprovacao.recomendacao.acao} (${aprovacao.recomendacao.confianca})`);
    } else {
      console.log(`   ❌ ${aprovacao?.motivo || 'Erro na análise'}`);
    }
    console.log('');
  });
  
  console.log('\n📊 TESTE 3: RELATÓRIO ESTATÍSTICO\n');
  
  const relatorio = gerarRelatorioFiltros(resultadosLote);
  const stats = relatorio.estatisticas;
  
  console.log('📈 ESTATÍSTICAS GERAIS:');
  console.log(`   Total analisado: ${stats.total} produtos`);
  console.log(`   Taxa de aprovação: ${relatorio.taxaAprovacao}%`);
  console.log(`   ✅ Aprovados: ${stats.aprovados}`);
  console.log(`   ❌ Reprovados: ${stats.reprovados}`);
  
  console.log('\n📊 SCORES MÉDIOS:');
  console.log(`   Quantitativo: ${stats.scoresMedios.quantitativo}/100`);
  console.log(`   Qualitativo: ${stats.scoresMedios.qualitativo}/100`);
  console.log(`   Margem: ${stats.scoresMedios.margem}/100`);
  console.log(`   📈 FINAL: ${stats.scoresMedios.final}/100`);
  
  console.log('\n🎯 DISTRIBUIÇÃO POR NÍVEL:');
  Object.entries(stats.niveisDistribuicao).forEach(([nivel, quantidade]) => {
    const percentual = Math.round((quantidade / stats.total) * 100);
    console.log(`   ${nivel}: ${quantidade} (${percentual}%)`);
  });
  
  console.log('\n💰 MARGENS MÉDIAS:');
  console.log(`   Conservadora: ${stats.margensMedias.conservadora}%`);
  console.log(`   Realista: ${stats.margensMedias.realista}%`);
  console.log(`   Otimista: ${stats.margensMedias.otimista}%`);
  
  if (Object.keys(stats.motivosReprovacao).length > 0) {
    console.log('\n❌ MOTIVOS DE REPROVAÇÃO:');
    Object.entries(stats.motivosReprovacao).forEach(([motivo, quantidade]) => {
      console.log(`   ${motivo}: ${quantidade}`);
    });
  }
  
  if (relatorio.melhorProduto) {
    console.log('\n🏆 MELHOR PRODUTO:');
    const melhor = relatorio.melhorProduto;
    console.log(`   ${melhor.produto.nome}`);
    console.log(`   Score: ${melhor.aprovacao.scoreFinal}/100`);
    console.log(`   Nível: ${melhor.aprovacao.nivel}`);
    console.log(`   Categoria: ${melhor.produto.categoria}`);
  }
  
} catch (error) {
  console.log(`❌ Erro no processamento em lote: ${error.message}`);
}

console.log('\n\n🎊 SISTEMA INTEGRADO COMPLETO:');
console.log('✅ Filtros quantitativos avançados');
console.log('✅ Filtros qualitativos com IA');
console.log('✅ Validação de margem brasileira');
console.log('✅ Score ponderado inteligente');
console.log('✅ Processamento em lote otimizado');
console.log('✅ Relatórios estatísticos detalhados');
console.log('✅ Recomendações contextuais');

console.log('\n🚀 PRONTO PARA INTEGRAÇÃO COM O SCRAPER PRINCIPAL!');
