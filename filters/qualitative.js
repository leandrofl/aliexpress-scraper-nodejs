/**
 * Aplica os filtros qualitativos ao produto.
 * Neste estágio, os critérios são placeholders e retornam `null`.
 * Futuramente será usado NLP via OpenAI.
 */
export function applyQualitativeFilter(produto) {
  const criterios = {
    resolveProblemaEscalavel: null,
    propostaUnica: null,
    fornecedorConfiavel: null
  };

  const aprovado = null; // Ainda não avaliamos qualitativamente

  return {
    ...criterios,
    aprovado
  };
}
