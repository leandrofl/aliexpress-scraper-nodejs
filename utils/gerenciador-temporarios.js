/**
 * 🗂 Melhoria 3: Gerenciador de arquivos temporários e debug
 * Limpa automaticamente arquivos antigos e organiza logs
 */

import fs from 'fs';
import path from 'path';

// Configurações de limpeza
const CONFIG_LIMPEZA = {
  manterImagensPorDias: 1, // Manter imagens por 1 dia
  manterLogsPorDias: 7,    // Manter logs por 7 dias
  maxTamanhoMB: 100        // Limpar se pasta ultrapassar 100MB
};

/**
 * Limpa arquivos antigos das pastas temporárias
 */
export function limparArquivosTemporarios() {
  try {
    console.log('🗂 Iniciando limpeza de arquivos temporários...');
    
    // Limpar imagens temporárias
    limparPasta('./temp_img', CONFIG_LIMPEZA.manterImagensPorDias);
    
    // Limpar logs antigos
    limparPasta('./logs', CONFIG_LIMPEZA.manterLogsPorDias);
    
    console.log('✅ Limpeza de arquivos temporários concluída');
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  }
}

/**
 * Limpa arquivos antigos de uma pasta
 */
function limparPasta(pasta, diasParaManter) {
  if (!fs.existsSync(pasta)) {
    return;
  }

  const agora = Date.now();
  const limiteTempo = diasParaManter * 24 * 60 * 60 * 1000; // dias em ms
  let arquivosRemovidos = 0;

  const arquivos = fs.readdirSync(pasta);
  
  for (const arquivo of arquivos) {
    const caminhoCompleto = path.join(pasta, arquivo);
    const stats = fs.statSync(caminhoCompleto);
    
    if (agora - stats.mtime.getTime() > limiteTempo) {
      try {
        fs.unlinkSync(caminhoCompleto);
        arquivosRemovidos++;
      } catch (error) {
        console.warn(`⚠️ Erro ao remover ${arquivo}:`, error.message);
      }
    }
  }

  if (arquivosRemovidos > 0) {
    console.log(`🗑️ Removidos ${arquivosRemovidos} arquivos antigos de ${pasta}`);
  }
}

/**
 * Salva arquivo de debug com timestamp
 */
export function salvarArquivoDebug(tipo, nome, conteudo) {
  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const nomeArquivo = `${timestamp}_${tipo}_${nome}`;
    const caminho = path.join('./logs', nomeArquivo);
    
    // Criar pasta logs se não existir
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs', { recursive: true });
    }
    
    if (typeof conteudo === 'object') {
      fs.writeFileSync(caminho + '.json', JSON.stringify(conteudo, null, 2));
    } else {
      fs.writeFileSync(caminho + '.html', conteudo);
    }
    
    console.log(`💾 Debug salvo: ${nomeArquivo}`);
  } catch (error) {
    console.error('❌ Erro ao salvar debug:', error.message);
  }
}

/**
 * Executa limpeza automática no início do scraping
 */
export function iniciarLimpezaAutomatica() {
  // Limpar imediatamente
  limparArquivosTemporarios();
  
  // Configurar limpeza periódica (a cada 2 horas)
  setInterval(() => {
    limparArquivosTemporarios();
  }, 2 * 60 * 60 * 1000);
}
