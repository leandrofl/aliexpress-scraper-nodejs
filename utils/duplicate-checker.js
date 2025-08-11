/**
 * @fileoverview Sistema de validação contra duplicidade de produtos
 * @description Evita processar o mesmo produto mais de uma vez usando hash único
 *
 * Deduplicação baseada em arquivo JSON agora salva em database/produtos-processados.json
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DUPLICATES_DB_PATH = path.join(process.cwd(), 'database', 'produtos-processados.json');

export function gerarHashProduto(produto) {
  try {
    const baseData = {
      product_id: produto.product_id || produto.id,
      categoria: produto.categoria || 'unknown',
      preco: Math.round((produto.preco || 0) * 100),
      nome: (produto.nome || '').toLowerCase().substring(0, 50)
    };
    const dataString = JSON.stringify(baseData);
    return crypto.createHash('md5').update(dataString).digest('hex');
  } catch (error) {
    console.error('Erro ao gerar hash do produto:', error.message);
    return crypto.createHash('md5').update(produto.product_id || Math.random().toString()).digest('hex');
  }
}

async function carregarBancoDuplicados() {
  try {
    const dataDir = path.dirname(DUPLICATES_DB_PATH);
    await fs.mkdir(dataDir, { recursive: true });
    const data = await fs.readFile(DUPLICATES_DB_PATH, 'utf-8');
    const banco = JSON.parse(data);
    if (!banco.produtos || !banco.stats) throw new Error('Estrutura inválida do banco');
    return banco;
  } catch (_e) {
    return {
      produtos: {},
      stats: {
        totalProcessados: 0,
        ultimaLimpeza: new Date().toISOString(),
        versao: '1.0.0'
      }
    };
  }
}

async function salvarBancoDuplicados(banco) {
  try {
    banco.stats.ultimaAtualizacao = new Date().toISOString();
    await fs.writeFile(DUPLICATES_DB_PATH, JSON.stringify(banco, null, 2));
  } catch (error) {
    console.error('Erro ao salvar banco de duplicados:', error.message);
  }
}

export async function verificarDuplicidade(produto) {
  try {
    const hash = gerarHashProduto(produto);
    const banco = await carregarBancoDuplicados();
    const jaProcessado = banco.produtos[hash];
    if (jaProcessado) {
      return {
        isDuplicado: true,
        hash,
        primeiroProcessamento: jaProcessado.timestamp,
        categoria: jaProcessado.categoria,
        diasApos: Math.floor((Date.now() - new Date(jaProcessado.timestamp)) / (1000 * 60 * 60 * 24)),
        motivo: 'Produto já processado anteriormente'
      };
    }
    return { isDuplicado: false, hash, novo: true };
  } catch (error) {
    console.error('Erro ao verificar duplicidade:', error.message);
    return { isDuplicado: false, erro: error.message, hash: gerarHashProduto(produto) };
  }
}

export async function marcarComoProcessado(produto, metadados = {}) {
  try {
    const hash = gerarHashProduto(produto);
    const banco = await carregarBancoDuplicados();
    banco.produtos[hash] = {
      product_id: produto.product_id,
      nome: produto.nome?.substring(0, 100),
      categoria: produto.categoria,
      preco: produto.preco,
      timestamp: new Date().toISOString(),
      aprovadoFinal: produto.aprovadoFinal || false,
      scoreTotal: produto.scoreTotal?.total || 0,
      ...metadados
    };
    banco.stats.totalProcessados++;
    await salvarBancoDuplicados(banco);
    return true;
  } catch (error) {
    console.error('Erro ao marcar produto como processado:', error.message);
    return false;
  }
}

export async function filtrarDuplicados(produtos) {
  const resultado = {
    produtosUnicos: [],
    duplicados: [],
    stats: { totalInput: produtos.length, novos: 0, duplicados: 0, errors: 0 }
  };
  for (const produto of produtos) {
    try {
      const verificacao = await verificarDuplicidade(produto);
      if (verificacao.isDuplicado) {
        resultado.duplicados.push({ produto, verificacao });
        resultado.stats.duplicados++;
      } else {
        resultado.produtosUnicos.push(produto);
        resultado.stats.novos++;
      }
    } catch (error) {
      console.error(`Erro ao verificar produto ${produto.product_id}:`, error.message);
      resultado.stats.errors++;
      resultado.produtosUnicos.push(produto);
    }
  }
  return resultado;
}

export async function limparProdutosAntigos(diasParaLimpar = 30) {
  try {
    const banco = await carregarBancoDuplicados();
    const agora = Date.now();
    const limiteTempo = diasParaLimpar * 24 * 60 * 60 * 1000;
    let removidos = 0;
    const produtosLimpos = {};
    for (const [hash, produto] of Object.entries(banco.produtos)) {
      const idade = agora - new Date(produto.timestamp).getTime();
      if (idade <= limiteTempo) produtosLimpos[hash] = produto; else removidos++;
    }
    banco.produtos = produtosLimpos;
    banco.stats.ultimaLimpeza = new Date().toISOString();
    banco.stats.totalProcessados = Object.keys(produtosLimpos).length;
    await salvarBancoDuplicados(banco);
    return { removidos, mantidos: Object.keys(produtosLimpos).length, diasLimite: diasParaLimpar };
  } catch (error) {
    console.error('Erro ao limpar produtos antigos:', error.message);
    return { erro: error.message };
  }
}

export async function obterEstatisticasDuplicados() {
  try {
    const banco = await carregarBancoDuplicados();
    const produtos = Object.values(banco.produtos);
    const stats = {
      totalProdutos: produtos.length,
      produtosPorCategoria: {},
      produtosAprovados: 0,
      scoresMedio: 0,
      distribucaoIdade: { ultimas24h: 0, ultimaSemana: 0, ultimoMes: 0, maisAntigos: 0 }
    };
    const agora = Date.now();
    let somaScores = 0;
    produtos.forEach(produto => {
      const cat = produto.categoria || 'unknown';
      stats.produtosPorCategoria[cat] = (stats.produtosPorCategoria[cat] || 0) + 1;
      if (produto.aprovadoFinal) stats.produtosAprovados++;
      somaScores += produto.scoreTotal || 0;
      const idade = agora - new Date(produto.timestamp).getTime();
      const dias = idade / (1000 * 60 * 60 * 24);
      if (dias <= 1) stats.distribucaoIdade.ultimas24h++;
      else if (dias <= 7) stats.distribucaoIdade.ultimaSemana++;
      else if (dias <= 30) stats.distribucaoIdade.ultimoMes++;
      else stats.distribucaoIdade.maisAntigos++;
    });
    stats.scoresMedio = produtos.length > 0 ? Math.round(somaScores / produtos.length) : 0;
    stats.taxaAprovacao = produtos.length > 0 ? Math.round((stats.produtosAprovados / produtos.length) * 100) : 0;
    return { ...stats, bancoInfo: banco.stats };
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error.message);
    return { erro: error.message };
  }
}
