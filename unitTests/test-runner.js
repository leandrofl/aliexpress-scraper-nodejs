/**
 * SUÍTE PRINCIPAL DE TESTES UNITÁRIOS
 * Executa todos os testes do projeto de forma organizada
 */

// Imports corrigidos - apenas arquivos que existem
import { executarTestes as testesMargemValidacao } from './validation/margin-validator.test.js';

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
  
  // Apenas os testes que existem
  console.log('\n💰 VALIDAÇÃO DE MARGEM');
  console.log('-'.repeat(40));
  const resultMargemValidacao = testesMargemValidacao();
  resultadosGerais.suites.push({
    nome: 'Validação de Margem',
    total: resultMargemValidacao.total,
    passou: resultMargemValidacao.passou,
    falhou: resultMargemValidacao.falhou
  });
  
  console.log(`✅ Passou: ${resultMargemValidacao.passou}/${resultMargemValidacao.total}`);
  
  // Atualizar totais gerais
  resultadosGerais.total += resultMargemValidacao.total;
  resultadosGerais.passou += resultMargemValidacao.passou;
  resultadosGerais.falhou += resultMargemValidacao.falhou;
  
  // Resumo final
  console.log('\n' + '=' .repeat(60));
  console.log('📋 RESUMO FINAL DOS TESTES');
  console.log('=' .repeat(60));
  console.log(`📊 Total de testes: ${resultadosGerais.total}`);
  console.log(`✅ Passou: ${resultadosGerais.passou}`);
  console.log(`❌ Falhou: ${resultadosGerais.falhou}`);
  
  const taxaSucesso = (resultadosGerais.passou / resultadosGerais.total * 100).toFixed(1);
  console.log(`📈 Taxa de sucesso: ${taxaSucesso}%`);
  
  if (resultadosGerais.falhou === 0) {
    console.log('\n🎉 Todos os testes passaram com sucesso!');
  } else {
    console.log(`\n⚠️  ${resultadosGerais.falhou} teste(s) falharam. Revisar implementações.`);
  }
  
  return resultadosGerais;
}

/**
 * Executa testes de uma suíte específica
 */
async function executarSuiteEspecifica(nomeSuite) {
  const suites = {
    'margem': testesMargemValidacao
  };
  
  if (!suites[nomeSuite]) {
    console.error(`❌ Suíte '${nomeSuite}' não encontrada.`);
    console.log(`Suítes disponíveis: ${Object.keys(suites).join(', ')}`);
    return null;
  }
  
  console.log(`🧪 EXECUTANDO SUÍTE: ${nomeSuite.toUpperCase()}`);
  console.log('=' .repeat(50));
  
  const resultado = suites[nomeSuite]();
  
  console.log(`\n📊 RESULTADO DA SUÍTE ${nomeSuite.toUpperCase()}:`);
  console.log(`✅ Passou: ${resultado.passou}/${resultado.total}`);
  
  if (resultado.falhou > 0) {
    console.log(`❌ Falhou: ${resultado.falhou}`);
  }
  
  return resultado;
}

/**
 * Função principal - detecta argumentos da linha de comando
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Executa suíte completa se nenhum argumento
    await executarSuiteCompleta();
  } else {
    // Executa suíte específica
    const nomeSuite = args[0].toLowerCase();
    await executarSuiteEspecifica(nomeSuite);
  }
}

// Executar se chamado diretamente
if (import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(error => {
    console.error('❌ Erro na execução dos testes:', error);
    process.exit(1);
  });
}

export { executarSuiteCompleta, executarSuiteEspecifica };
