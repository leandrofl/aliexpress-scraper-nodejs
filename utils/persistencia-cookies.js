/**
 * 🧠 Melhoria 5: Gerenciador de persistência de cookies
 * Evita CAPTCHAs mantendo sessões de navegação consistentes
 */

import fs from 'fs';
import path from 'path';

// Configurações de persistência
const COOKIE_CONFIG = {
  userDataDir: './user_data',
  maxAgeHours: 24,
  cleanupIntervalHours: 6
};

/**
 * Configura persistência de cookies no browser
 */
export function configurarPersistenciaCookies(browserConfig) {
  try {
    // Criar diretório de dados do usuário se não existir
    if (!fs.existsSync(COOKIE_CONFIG.userDataDir)) {
      fs.mkdirSync(COOKIE_CONFIG.userDataDir, { recursive: true });
      console.log('📁 Diretório de dados do usuário criado');
    }

    // Limpar dados antigos
    limparDadosAntigos();

    // Adicionar userDataDir às configurações do browser
    const configComCookies = {
      ...browserConfig,
      userDataDir: COOKIE_CONFIG.userDataDir,
      // Manter algumas configurações específicas
      args: [
        ...(browserConfig.args || []),
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };

    console.log('🍪 Persistência de cookies configurada');
    return configComCookies;

  } catch (error) {
    console.error('❌ Erro ao configurar persistência:', error.message);
    return browserConfig; // Retorna config original em caso de erro
  }
}

/**
 * Limpa dados antigos do diretório de usuário
 */
function limparDadosAntigos() {
  try {
    if (!fs.existsSync(COOKIE_CONFIG.userDataDir)) {
      return;
    }

    const agora = Date.now();
    const limiteTempo = COOKIE_CONFIG.maxAgeHours * 60 * 60 * 1000;

    // Verificar idade do diretório
    const stats = fs.statSync(COOKIE_CONFIG.userDataDir);
    const idadeDiretorio = agora - stats.mtime.getTime();

    if (idadeDiretorio > limiteTempo) {
      console.log('🧹 Limpando dados de usuário antigos...');
      
      // Remover arquivos específicos que podem causar problemas
      const arquivosParaLimpar = [
        'Default/Web Data',
        'Default/Web Data-journal',
        'Default/Session Storage',
        'Default/Local Storage',
        'Default/IndexedDB'
      ];

      for (const arquivo of arquivosParaLimpar) {
        const caminhoCompleto = path.join(COOKIE_CONFIG.userDataDir, arquivo);
        if (fs.existsSync(caminhoCompleto)) {
          try {
            if (fs.statSync(caminhoCompleto).isDirectory()) {
              fs.rmSync(caminhoCompleto, { recursive: true, force: true });
            } else {
              fs.unlinkSync(caminhoCompleto);
            }
          } catch (removeError) {
            // Ignora erros de remoção (arquivo pode estar em uso)
          }
        }
      }

      console.log('✅ Limpeza seletiva de dados concluída');
    }

  } catch (error) {
    console.warn('⚠️ Erro na limpeza de dados antigos:', error.message);
  }
}

/**
 * Configura limpeza automática periódica
 */
export function iniciarLimpezaAutomaticaCookies() {
  // Limpar imediatamente
  limparDadosAntigos();
  
  // Configurar limpeza periódica
  setInterval(() => {
    limparDadosAntigos();
  }, COOKIE_CONFIG.cleanupIntervalHours * 60 * 60 * 1000);

  console.log(`🔄 Limpeza automática configurada (a cada ${COOKIE_CONFIG.cleanupIntervalHours}h)`);
}

/**
 * Salva cookies importantes de uma página
 */
export async function salvarCookiesImportantes(page, dominio) {
  try {
    const cookies = await page.cookies();
    const cookiesImportantes = cookies.filter(cookie => 
      !cookie.name.startsWith('_') && // Pular cookies de tracking
      cookie.value.length < 500 && // Pular cookies muito grandes
      !cookie.name.includes('csrf') // Pular tokens CSRF
    );

    if (cookiesImportantes.length > 0) {
      const arquivoCookies = path.join(COOKIE_CONFIG.userDataDir, `cookies_${dominio}.json`);
      fs.writeFileSync(arquivoCookies, JSON.stringify(cookiesImportantes, null, 2));
      console.log(`🍪 ${cookiesImportantes.length} cookies salvos para ${dominio}`);
    }

  } catch (error) {
    console.warn('⚠️ Erro ao salvar cookies:', error.message);
  }
}

/**
 * Carrega cookies salvos para uma página
 */
export async function carregarCookiesSalvos(page, dominio) {
  try {
    const arquivoCookies = path.join(COOKIE_CONFIG.userDataDir, `cookies_${dominio}.json`);
    
    if (fs.existsSync(arquivoCookies)) {
      const cookies = JSON.parse(fs.readFileSync(arquivoCookies, 'utf8'));
      await page.setCookie(...cookies);
      console.log(`🍪 ${cookies.length} cookies carregados para ${dominio}`);
    }

  } catch (error) {
    console.warn('⚠️ Erro ao carregar cookies:', error.message);
  }
}
