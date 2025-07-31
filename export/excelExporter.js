import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import path from 'path';
import { slugify } from '../scraper/utils.js';
import { DIRETORIO_DEBUG } from '../config.js';

export async function exportToExcel(produtos, categoria) {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
  const nomeArquivo = `Mineracao_${slugify(categoria)}_${timestamp}.xlsx`;
  const caminhoCompleto = path.join(DIRETORIO_DEBUG, nomeArquivo);

  await fs.ensureDir(DIRETORIO_DEBUG);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Produtos');

  // Combinar todas as chaves únicas dos objetos
  const colunasSet = new Set();
  produtos.forEach(prod => {
    Object.keys(flattenObject(prod)).forEach(k => colunasSet.add(k));
  });

  const colunasOrdenadas = Array.from(colunasSet).sort();
  sheet.columns = colunasOrdenadas.map(key => ({
    header: key,
    key: key,
    width: Math.max(12, Math.min(50, key.length + 5))
  }));

  // Preencher linhas com objetos achatados
  produtos.forEach(prod => {
    const flat = flattenObject(prod);
    sheet.addRow(flat);
  });

  await workbook.xlsx.writeFile(caminhoCompleto);
  console.log(`📁 Excel salvo em: ${caminhoCompleto}`);
}

// Utilitário para "achatar" objetos aninhados (como {aprovadoQuant: {vendasMinimas: true}})
function flattenObject(obj, prefix = '', result = {}) {
  for (const key in obj) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flattenObject(val, newKey, result);
    } else {
      result[newKey] = val;
    }
  }
  return result;
}
