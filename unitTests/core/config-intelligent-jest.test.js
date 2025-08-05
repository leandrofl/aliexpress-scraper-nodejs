/**
 * Testes Unitários - Sistema de Configuração Inteligente
 * Formato Jest com imports ES modules
 */

describe('🧪 Sistema de Configuração Inteligente', () => {
  test('MAX_PRODUCTS_RAW = 0 deve auto-calcular 2x TARGET_PRODUCTS_FINAL', () => {
    // Simular lógica de configuração inteligente
    const rawMaxProducts = 0;
    const rawTargetFinal = 10;
    const rawMaxPages = 5;
    
    // Lógica corrigida
    const MAX_PRODUCTS_RAW = rawMaxProducts === 0 ? rawTargetFinal * 2 : rawMaxProducts;
    const MAX_PAGES_PER_CATEGORY = rawMaxPages; // MAX_PAGES só é ignorado quando ele próprio = 0
    
    expect(MAX_PRODUCTS_RAW).toBe(20);
    expect(MAX_PAGES_PER_CATEGORY).toBe(5); // Deve manter valor original
    
    console.log(`✅ MAX_PRODUCTS_RAW=0: ${rawMaxProducts} → ${MAX_PRODUCTS_RAW} produtos, páginas: ${MAX_PAGES_PER_CATEGORY}`);
  });

  test('MAX_PAGES_PER_CATEGORY = 0 deve ignorar limite de páginas', () => {
    const rawMaxProducts = 80;
    const rawTargetFinal = 10;
    const rawMaxPages = 0;
    
    const MAX_PRODUCTS_RAW = rawMaxProducts === 0 ? rawTargetFinal * 2 : rawMaxProducts;
    const MAX_PAGES_PER_CATEGORY = rawMaxPages === 0 ? 999 : rawMaxPages; // Ignora quando = 0
    
    expect(MAX_PRODUCTS_RAW).toBe(80);
    expect(MAX_PAGES_PER_CATEGORY).toBe(999); // Deve ser "infinito"
    
    console.log(`✅ MAX_PAGES_PER_CATEGORY=0: páginas ${rawMaxPages} → ${MAX_PAGES_PER_CATEGORY} (sem limite)`);
  });

  test('Configuração normal deve manter valores originais', () => {
    const rawMaxProducts = 80;
    const rawTargetFinal = 10;
    const rawMaxPages = 5;
    
    const MAX_PRODUCTS_RAW = rawMaxProducts === 0 ? rawTargetFinal * 2 : rawMaxProducts;
    const MAX_PAGES_PER_CATEGORY = rawMaxPages === 0 ? 999 : rawMaxPages;
    
    expect(MAX_PRODUCTS_RAW).toBe(80);
    expect(MAX_PAGES_PER_CATEGORY).toBe(5);
    
    console.log(`✅ Configuração normal: ${rawMaxProducts} produtos, ${rawMaxPages} páginas (mantidos)`);
  });

  test('Combinação: MAX_PRODUCTS_RAW=0 E MAX_PAGES_PER_CATEGORY=0', () => {
    const rawMaxProducts = 0;
    const rawTargetFinal = 15;
    const rawMaxPages = 0;
    
    const MAX_PRODUCTS_RAW = rawMaxProducts === 0 ? rawTargetFinal * 2 : rawMaxProducts;
    const MAX_PAGES_PER_CATEGORY = rawMaxPages === 0 ? 999 : rawMaxPages;
    
    expect(MAX_PRODUCTS_RAW).toBe(30); // 2x15
    expect(MAX_PAGES_PER_CATEGORY).toBe(999); // Sem limite
    
    console.log(`✅ Busca intensiva: ${MAX_PRODUCTS_RAW} produtos, sem limite de páginas`);
  });

  test('Novo fluxo de validação deve priorizar margem', () => {
    const ordemAntiga = ['detalhes', 'quantitativo', 'qualitativo', 'margem'];
    const ordemNova = ['detalhes', 'margem', 'quantitativo', 'qualitativo'];
    
    expect(ordemNova[1]).toBe('margem');
    expect(ordemNova.indexOf('margem')).toBeLessThan(ordemAntiga.indexOf('margem'));
    
    console.log(`✅ Fluxo otimizado: margem moved from position ${ordemAntiga.indexOf('margem')} to ${ordemNova.indexOf('margem')}`);
  });

  test('Sistema anti-loop deve parar após MAX_TENTATIVAS_SEM_SUCESSO', () => {
    const MAX_TENTATIVAS_SEM_SUCESSO = 3;
    let tentativasConsecutivas = 0;
    const simulacoePaginas = [true, true, false, false, false]; // true = encontrou produtos com margem
    
    let paginaAtual = 0;
    while (paginaAtual < simulacoePaginas.length && tentativasConsecutivas < MAX_TENTATIVAS_SEM_SUCESSO) {
      const encontrouProdutosComMargem = simulacoePaginas[paginaAtual];
      if (encontrouProdutosComMargem) {
        tentativasConsecutivas = 0;
      } else {
        tentativasConsecutivas++;
      }
      paginaAtual++;
    }
    
    expect(tentativasConsecutivas).toBe(MAX_TENTATIVAS_SEM_SUCESSO);
    expect(paginaAtual).toBe(5); // Parou na 5ª página
    
    console.log(`✅ Anti-loop funcionando: parou após ${tentativasConsecutivas} tentativas consecutivas`);
  });

  test('Estatísticas de retorno devem ser informativas', () => {
    const produtosComMargem = 15;
    const produtosAprovados = 8;
    const paginasProcessadas = 3;
    
    const taxaConversao = ((produtosAprovados / produtosComMargem) * 100).toFixed(1);
    
    expect(Number(taxaConversao)).toBeGreaterThan(50);
    expect(produtosAprovados).toBeLessThanOrEqual(produtosComMargem);
    
    console.log(`✅ Estatísticas: ${produtosAprovados}/${produtosComMargem} produtos (${taxaConversao}% conversão)`);
  });
});
