import { obterProdutosComRiscoImagem } from '../database/database-integration.js';

/**
 * Script para monitorar produtos com risco de imagem
 * Executa com: npm run risco ou node scripts/monitor-risco.js
 */

async function monitorarProdutosRisco(limite = 20) {
    try {
        console.log('🔍 Buscando produtos com risco de imagem...\n');
        
        const produtos = await obterProdutosComRiscoImagem(limite);
        
        if (produtos.length === 0) {
            console.log('✅ Nenhum produto com risco encontrado!');
            return;
        }
        
        console.log(`⚠️  Encontrados ${produtos.length} produtos com risco:\n`);
        
        produtos.forEach((produto, index) => {
            // Calcular margem de lucro
            const margemLucro = produto.preco_ml_medio && produto.preco_aliexpress 
                ? ((produto.preco_ml_medio - produto.preco_aliexpress) / produto.preco_aliexpress * 100).toFixed(1)
                : 'N/A';
            
            console.log(`${index + 1}. ${produto.nome}`);
            console.log(`   💰 Margem: ${margemLucro}%`);
            console.log(`   🎯 Score: ${produto.score_total}/100`);
            console.log(`   � Status: ${produto.status}`);
            console.log(`   ✅ Aprovado: ${produto.aprovado_final ? 'Sim' : 'Não'}`);
            console.log(`   � Preço AliExpress: R$ ${produto.preco_aliexpress || 'N/A'}`);
            console.log(`   � Preço ML Médio: R$ ${produto.preco_ml_medio || 'N/A'}`);
            console.log(`   � URL: ${produto.url_aliexpress}`);
            console.log(`   📅 Criado: ${new Date(produto.criado_em).toLocaleDateString('pt-BR')}`);
            console.log('   ---');
        });
        
        console.log(`\n📈 Resumo:`);
        console.log(`   Total com risco: ${produtos.length}`);
        
        // Calcular margem média
        const margensLucro = produtos
            .filter(p => p.preco_ml_medio && p.preco_aliexpress)
            .map(p => (p.preco_ml_medio - p.preco_aliexpress) / p.preco_aliexpress * 100);
        
        const margemMedia = margensLucro.length > 0 
            ? (margensLucro.reduce((acc, m) => acc + m, 0) / margensLucro.length).toFixed(1)
            : 'N/A';
        
        console.log(`   Margem média: ${margemMedia}%`);
        console.log(`   Score médio: ${(produtos.reduce((acc, p) => acc + (p.score_total || 0), 0) / produtos.length).toFixed(1)}/100`);
        
        // Produtos com alta margem e alto score
        const produtosPromissores = produtos.filter(p => {
            const margem = p.preco_ml_medio && p.preco_aliexpress 
                ? (p.preco_ml_medio - p.preco_aliexpress) / p.preco_aliexpress * 100 
                : 0;
            return margem > 50 && (p.score_total || 0) > 70;
        });
        
        if (produtosPromissores.length > 0) {
            console.log(`\n🌟 ${produtosPromissores.length} produtos promissores encontrados!`);
            console.log('   (Alta margem + Alto score - revisar manualmente)');
        }
        
    } catch (error) {
        console.error('❌ Erro ao monitorar produtos com risco:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Executar se chamado diretamente
monitorarProdutosRisco()
    .then(() => {
        console.log('\n✅ Monitoramento concluído!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });

export { monitorarProdutosRisco };
