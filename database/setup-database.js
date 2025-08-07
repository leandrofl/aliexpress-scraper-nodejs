/**
 * @fileoverview Script de setup inicial do banco Supabase
 * @description Testa conexão e cria estrutura inicial se necessário
 * 
 * @author Sistema de Scraping AliExpress - Database Setup v1.0
 */

import { supabase, testarConexaoSupabase, obterEstatisticasBanco } from './supabase-client.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Executar setup completo do banco de dados
 */
async function executarSetupBanco() {
    console.log('🚀 Iniciando setup do banco de dados Supabase...\n');

    try {
        // 1. Testar conexão
        console.log('1️⃣ Testando conexão com Supabase...');
        const conexaoOK = await testarConexaoSupabase();
        
        if (!conexaoOK) {
            console.log('❌ Falha na conexão. Verifique suas credenciais no .env');
            console.log('   SUPABASE_URL e SUPABASE_KEY devem estar corretas.');
            process.exit(1);
        }

        // 2. Verificar se as tabelas existem
        console.log('\n2️⃣ Verificando estrutura do banco...');
        const { data: tabelas, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .in('table_name', ['produtos', 'metricas_scraping', 'campanhas']);

        if (error) {
            console.log('⚠️ Não foi possível verificar tabelas. Elas podem não existir ainda.');
        }

        const tabelasExistentes = tabelas?.map(t => t.table_name) || [];
        console.log(`   Tabelas encontradas: ${tabelasExistentes.join(', ') || 'nenhuma'}`);

        // 3. Mostrar instruções para criar tabelas se necessário
        if (tabelasExistentes.length < 3) {
            console.log('\n📋 INSTRUÇÕES PARA CRIAR TABELAS:');
            console.log('   1. Acesse o Supabase Dashboard: https://app.supabase.com/');
            console.log('   2. Vá para seu projeto');
            console.log('   3. Clique em "SQL Editor" no menu lateral');
            console.log('   4. Cole o conteúdo do arquivo: database/schema.sql');
            console.log('   5. Execute o script clicando em "Run"');
            console.log('   6. Execute este setup novamente após criar as tabelas\n');
            
            // Mostrar localização do arquivo schema
            const schemaPath = path.resolve('./database/schema.sql');
            console.log(`📂 Arquivo SQL: ${schemaPath}`);
            
            try {
                const schemaExists = await fs.access(schemaPath);
                console.log('✅ Arquivo schema.sql encontrado e pronto para uso!');
            } catch {
                console.log('❌ Arquivo schema.sql não encontrado. Execute este script da raiz do projeto.');
            }
            
            return;
        }

        // 4. Obter estatísticas do banco
        console.log('\n3️⃣ Obtendo estatísticas do banco...');
        const stats = await obterEstatisticasBanco();
        
        console.log('📊 ESTATÍSTICAS DO BANCO:');
        console.log(`   📦 Total de produtos: ${stats.totalProdutos}`);
        console.log(`   📈 Total de métricas: ${stats.totalMetricas}`);
        console.log(`   🚀 Total de campanhas: ${stats.totalCampanhas}`);
        
        if (stats.erro) {
            console.log(`   ⚠️ Erro: ${stats.erro}`);
        }

        // 5. Testar operações básicas
        console.log('\n4️⃣ Testando operações básicas...');
        
        // Teste de inserção (produto de exemplo)
        try {
            const testeProduto = {
                product_id_aliexpress: `test_${Date.now()}`,
                nome: 'Produto de Teste',
                categoria: 'Casa e Cozinha',
                preco_aliexpress: 29.90,
                score_total: 75,
                score_categoria: 'ouro',
                status: 'testado'
            };

            const { data, error } = await supabase
                .from('produtos')
                .insert(testeProduto)
                .select()
                .single();

            if (error) {
                console.log(`   ❌ Erro no teste de inserção: ${error.message}`);
            } else {
                console.log('   ✅ Teste de inserção: OK');
                
                // Limpar produto de teste
                await supabase
                    .from('produtos')
                    .delete()
                    .eq('id', data.id);
                console.log('   🧹 Produto de teste removido');
            }
        } catch (testError) {
            console.log(`   ❌ Erro no teste: ${testError.message}`);
        }

        // 6. Resultado final
        console.log('\n🎉 SETUP CONCLUÍDO COM SUCESSO!');
        console.log('\n✅ Próximos passos:');
        console.log('   1. Seu banco está pronto para receber dados');
        console.log('   2. Execute o scraper normalmente');
        console.log('   3. Os dados serão salvos automaticamente no Supabase');
        console.log('   4. Acesse o Dashboard do Supabase para visualizar os dados');
        
        console.log('\n📊 COMO VISUALIZAR OS DADOS:');
        console.log('   • Produtos: SELECT * FROM produtos ORDER BY score_total DESC;');
        console.log('   • Métricas: SELECT * FROM metricas_scraping ORDER BY criado_em DESC;');
        console.log('   • Resumo: SELECT * FROM vw_produtos_resumo;');

    } catch (error) {
        console.error('\n❌ Erro durante o setup:', error.message);
        console.log('\n🔍 CHECKLIST DE PROBLEMAS:');
        console.log('   1. Verifique se SUPABASE_URL está correta no .env');
        console.log('   2. Verifique se SUPABASE_KEY está correta no .env');
        console.log('   3. Confirme se o projeto Supabase está ativo');
        console.log('   4. Teste a conexão diretamente no Dashboard do Supabase');
        process.exit(1);
    }
}

// Executar setup se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    executarSetupBanco();
}

export { executarSetupBanco };
