/**
 * SUÍTE PRINCIPAL DE TESTES UNITÁRIOS
 * Executa todos os testes do projeto de forma organizada
 */

import { executarTestes as testesQuantitativos } from './filters/quantitative.test.js';
import { executarTestes as testesQualitativos } from './filters/qualitative.test.js';
import { executarTestes as testesIntegrados } from './filters/integrated-filters.test.js';
import { executarTestes as testesMargemValidacao } from './validation/margin-validator.test.js';
import { executarTestes as testesConfigInteligente } from './core/config-intelligent.test.js';

/**
 * Executa toda a suíte de testes
 */
async function executarSuiteCompleta() {
  console.log('🚀 EXECUTANDO SUÍTE COMPLETA DE TESTES UNITÁRIOS');
  console.log('=' .repeat(60));
  
  const resultadosGerais = {
    total: 0,
    passou: 0,
    falhou: 0,
    suites: []
  };
  
  // 1. Testes de Filtros Quantitativos
  console.log('\n📊 1. FILTROS QUANTITATIVOS');
  console.log('-'.repeat(40));
  const resultQuantitativos = testesQuantitativos();
  resultadosGerais.suites.push({
    nome: 'Filtros Quantitativos',
    ...resultQuantitativos
  });
  
  console.log(`✅ Passou: ${resultQuantitativos.passou}/${resultQuantitativos.total}`);
  
  // 2. Testes de Filtros Qualitativos
  console.log('\n🎯 2. FILTROS QUALITATIVOS');
  console.log('-'.repeat(40));
  const resultQualitativos = testesQualitativos();
  resultadosGerais.suites.push({
    nome: 'Filtros Qualitativos',
    ...resultQualitativos
  });
  
  console.log(`✅ Passou: ${resultQualitativos.passou}/${resultQualitativos.total}`);
  
  // 3. Testes de Validação de Margem
  console.log('\n💰 3. VALIDAÇÃO DE MARGEM');
  console.log('-'.repeat(40));
  const resultMargemValidacao = testesMargemValidacao();
  resultadosGerais.suites.push({
    nome: 'Validação de Margem',
    ...resultMargemValidacao
  });
  
  console.log(`✅ Passou: ${resultMargemValidacao.passou}/${resultMargemValidacao.total}`);
  
  // 4. Testes de Filtros Integrados
  console.log('\n🔄 4. FILTROS INTEGRADOS');
  console.log('-'.repeat(40));
  const resultIntegrados = testesIntegrados();
  resultadosGerais.suites.push({
    nome: 'Filtros Integrados',
    ...resultIntegrados
  });
  
  console.log(`✅ Passou: ${resultIntegrados.passou}/${resultIntegrados.total}`);
  
  // 5. Testes de Configurações Inteligentes
  console.log('\n⚙️ 5. CONFIGURAÇÕES INTELIGENTES');
  console.log('-'.repeat(40));
  const resultConfigInteligente = testesConfigInteligente();
  resultadosGerais.suites.push({
    nome: 'Configurações Inteligentes',
    ...resultConfigInteligente
  });
  
  console.log(`✅ Passou: ${resultConfigInteligente.passou}/${resultConfigInteligente.total}`);
  
  // Calcular totais gerais
  resultadosGerais.total = resultadosGerais.suites.reduce((sum, suite) => sum + suite.total, 0);
  resultadosGerais.passou = resultadosGerais.suites.reduce((sum, suite) => sum + suite.passou, 0);
  resultadosGerais.falhou = resultadosGerais.suites.reduce((sum, suite) => sum + suite.falhou, 0);
  
  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMO FINAL DA SUÍTE DE TESTES');
  console.log('='.repeat(60));
  
  resultadosGerais.suites.forEach(suite => {
    const status = suite.falhou === 0 ? '✅' : '⚠️';
    const porcentagem = ((suite.passou / suite.total) * 100).toFixed(1);
    console.log(`${status} ${suite.nome}: ${suite.passou}/${suite.total} (${porcentagem}%)`);
  });
  
  console.log('-'.repeat(60));
  const porcentagemGeral = ((resultadosGerais.passou / resultadosGerais.total) * 100).toFixed(1);
  console.log(`🎯 TOTAL GERAL: ${resultadosGerais.passou}/${resultadosGerais.total} (${porcentagemGeral}%)`);
  
  if (resultadosGerais.falhou === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM! Sistema pronto para produção.');
  } else {
    console.log(`\n⚠️  ${resultadosGerais.falhou} teste(s) falharam. Revisar implementações.`);
  }
  
  return resultadosGerais;
}

/**
 * Executa testes de uma suíte específica
 */
async function executarSuiteEspecifica(nomesuíte) {
  const suites = {
    'quantitativo': testesQuantitativos,
    'qualitativo': testesQualitativos,
    'margem': testesMargemValidacao,
    'integrado': testesIntegrados,
    'config': testesConfigInteligente
  };
  
  const suite = suites[nomesuíte.toLowerCase()];
  if (!suite) {
    console.log(`❌ Suíte '${nomesuíte}' não encontrada.`);
    console.log(`Suítes disponíveis: ${Object.keys(suites).join(', ')}`);
    return;
  }
  
  console.log(`🧪 Executando suíte: ${nomesuíte}`);
  return suite();
}

/**
 * Gerar relatório detalhado
 */
function gerarRelatorioDetalhado(resultados) {
  const relatorio = {
    timestamp: new Date().toISOString(),
    resumo: {
      total: resultados.total,
      passou: resultados.passou,
      falhou: resultados.falhou,
      sucesso: (resultados.passou / resultados.total * 100).toFixed(1) + '%'
    },
    suites: resultados.suites.map(suite => ({
      nome: suite.nome,
      total: suite.total,
      passou: suite.passou,
      falhou: suite.falhou,
      sucesso: (suite.passou / suite.total * 100).toFixed(1) + '%',
      testesFalharam: suite.testes
        .filter(t => !t.passou)
        .map(t => ({
          nome: t.nome,
          detalhes: t.detalhes
        }))
    }))
  };
  
  return relatorio;
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const argumento = process.argv[2];
  
  if (argumento) {
    // Executar suíte específica
    await executarSuiteEspecifica(argumento);
  } else {
    // Executar suíte completa
    const resultados = await executarSuiteCompleta();
    
    // Gerar relatório se solicitado
    if (process.argv.includes('--relatorio')) {
      const relatorio = gerarRelatorioDetalhado(resultados);
      console.log('\n📄 RELATÓRIO DETALHADO:');
      console.log(JSON.stringify(relatorio, null, 2));
    }
  }
}

export { executarSuiteCompleta, executarSuiteEspecifica, gerarRelatorioDetalhado };
