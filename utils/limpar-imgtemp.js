/**
 * Script para limpar arquivos temporários da pasta imgtemp
 */

import { readdir, unlink } from 'fs';
import { promisify } from 'util';
import { join } from 'path';

const readdirAsync = promisify(readdir);
const unlinkAsync = promisify(unlink);

const TEMP_DIR = join(process.cwd(), 'scraper', 'imgtemp');

async function limparPastaImgTemp() {
    try {
        console.log('🧹 Limpando pasta imgtemp...');
        
        // Listar arquivos na pasta
        const arquivos = await readdirAsync(TEMP_DIR);
        
        if (arquivos.length === 0) {
            console.log('✅ Pasta imgtemp já está vazia');
            return;
        }
        
        console.log(`📁 Encontrados ${arquivos.length} arquivos:`);
        arquivos.forEach(arquivo => console.log(`   - ${arquivo}`));
        
        // Remover cada arquivo
        let removidos = 0;
        let erros = 0;
        
        for (const arquivo of arquivos) {
            try {
                const caminhoCompleto = join(TEMP_DIR, arquivo);
                await unlinkAsync(caminhoCompleto);
                console.log(`🗑️ Removido: ${arquivo}`);
                removidos++;
            } catch (err) {
                console.error(`❌ Erro ao remover ${arquivo}: ${err.message}`);
                erros++;
            }
        }
        
        console.log(`\n📊 RESULTADO:`);
        console.log(`   ✅ Removidos: ${removidos}`);
        console.log(`   ❌ Erros: ${erros}`);
        
        if (removidos === arquivos.length) {
            console.log('🎉 Pasta imgtemp limpa com sucesso!');
        }
        
    } catch (err) {
        console.error('❌ Erro ao limpar pasta:', err.message);
    }
}

// Executar limpeza
limparPastaImgTemp();
