/**
 * Teste simples da API do Google Translate
 */

import dotenv from 'dotenv';

// Carregar variáveis do .env
dotenv.config();

// Forçar configuração para teste
process.env.GOOGLE_TRANSLATE_PROJECT_ID = 'friendly-block-468323-i3';

async function testeMinimo() {
    try {
        console.log('🧪 Teste mínimo do Google Translate');
        
        // Testar diferentes formas de importação
        console.log('📦 Testando importações...');
        
        const module1 = await import('@google-cloud/translate');
        console.log('🔍 Module completo:', Object.keys(module1));
        
        const { Translate } = module1;
        console.log('📋 Translate:', typeof Translate);
        
        const { v2 } = module1;
        console.log('📋 v2:', typeof v2);
        
        if (v2 && v2.Translate) {
            console.log('📋 v2.Translate:', typeof v2.Translate);
            
            // Testar com v2
            const config = {
                projectId: process.env.GOOGLE_TRANSLATE_PROJECT_ID,
                key: process.env.GOOGLE_TRANSLATE_API_KEY
            };
            
            console.log('⚙️ Tentando criar instância v2...');
            const translateInstance = new v2.Translate(config);
            console.log('✅ Instância v2 criada');
            
            // Testar tradução simples
            console.log('🌐 Testando tradução...');
            const [translation] = await translateInstance.translate('Hello world', 'pt');
            console.log('✅ Tradução:', translation);
        }
        
    } catch (error) {
        console.log('❌ Erro:', error.message);
        console.log('📋 Stack:', error.stack);
    }
}

testeMinimo();
