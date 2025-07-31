import { scrapeAliExpressProducts } from './scraper/aliexpressScraper.js';
import { exportToExcel } from './export/excelExporter.js';
import { config } from './config.js';

console.log('🔍 Iniciando scraping do AliExpress...');

const produtos = await scrapeAliExpressProducts(config);

console.log(`✅ ${produtos.length} produtos processados. Exportando para Excel...`);

await exportToExcel(produtos, config.EXCEL_OUTPUT_DIR);

console.log('🏁 Processo finalizado com sucesso!');
