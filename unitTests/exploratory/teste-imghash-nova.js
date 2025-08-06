/**
 * Teste da nova biblioteca imghash
 * Verifica se a substituição da image-hash funcionou corretamente
 */

import imghash from 'imghash';

async function testarImgHash() {
    console.log('🧪 Testando nova biblioteca imghash...');
    
    try {
        // URL de imagem de teste
        const urlTeste = 'https://via.placeholder.com/150/0000FF/808080?Text=Teste';
        
        console.log('📥 Calculando hash para:', urlTeste);
        
        // Testar hash com a nova biblioteca
        const hash = await imghash.hash(urlTeste, 8, 'hex');
        
        console.log('✅ Hash calculado:', hash);
        console.log('📏 Tamanho do hash:', hash.length, 'caracteres');
        
        // Testar novamente para verificar consistência
        const hash2 = await imghash.hash(urlTeste, 8, 'hex');
        
        console.log('✅ Hash2 calculado:', hash2);
        console.log('🔄 Hashes são iguais:', hash === hash2);
        
        console.log('🎉 Teste da biblioteca imghash CONCLUÍDO COM SUCESSO!');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        process.exit(1);
    }
}

// Executar teste
testarImgHash();
