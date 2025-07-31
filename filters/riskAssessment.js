/**
 * Avalia riscos associados ao produto com base em critérios heurísticos.
 * Retorna um objeto com a avaliação de risco.
 */
export function assessRisk(produto) {
  const criterios = {
    fornecedorSuspeito: avaliarFornecedor(produto.vendedor),
    freteSuspeito: avaliarFrete(produto.frete),
    pesoInvalido: avaliarPeso(produto.peso)
  };

  const risco = Object.values(criterios).some(Boolean);

  return {
    ...criterios,
    risco
  };
}

// ===== Critérios de risco individuais =====

function avaliarFornecedor(nome) {
  if (!nome || nome.toLowerCase().includes('unknown')) return true;
  return false;
}

function avaliarFrete(frete) {
  if (!frete || frete.toLowerCase().includes('não disponível')) return true;
  return false;
}

function avaliarPeso(peso) {
  if (!peso || peso.toLowerCase().includes('kg') === false) return true;
  return false;
}
