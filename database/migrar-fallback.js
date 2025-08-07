/**
 * Script para aplicar as migrações do sistema de fallback textual
 * Adiciona os novos campos necessários para o sistema de verificação
 */

import { supabase } from './supabase-client.js';

async function aplicarMigracoesFallback() {
    console.log('🔄 Iniciando migração do sistema de fallback textual...\n');

    try {
        // SQL para adicionar os novos campos se não existirem
        const migracaoSQL = `
        -- Adicionar novos campos para o sistema de fallback
        DO $$ 
        BEGIN
            -- Verificar e adicionar coluna imagem_comparada
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'produtos' AND column_name = 'imagem_comparada') THEN
                ALTER TABLE produtos ADD COLUMN imagem_comparada BOOLEAN DEFAULT false;
                RAISE NOTICE 'Coluna imagem_comparada adicionada';
            ELSE
                RAISE NOTICE 'Coluna imagem_comparada já existe';
            END IF;

            -- Verificar e adicionar coluna fonte_de_verificacao
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'produtos' AND column_name = 'fonte_de_verificacao') THEN
                ALTER TABLE produtos ADD COLUMN fonte_de_verificacao VARCHAR(20) DEFAULT 'imagem';
                RAISE NOTICE 'Coluna fonte_de_verificacao adicionada';
            ELSE
                RAISE NOTICE 'Coluna fonte_de_verificacao já existe';
            END IF;

            -- Verificar e adicionar coluna risco_imagem
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'produtos' AND column_name = 'risco_imagem') THEN
                ALTER TABLE produtos ADD COLUMN risco_imagem BOOLEAN DEFAULT false;
                RAISE NOTICE 'Coluna risco_imagem adicionada';
            ELSE
                RAISE NOTICE 'Coluna risco_imagem já existe';
            END IF;

            -- Verificar e adicionar coluna compatibilidade_textual
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'produtos' AND column_name = 'compatibilidade_textual') THEN
                ALTER TABLE produtos ADD COLUMN compatibilidade_textual DECIMAL(5,2);
                RAISE NOTICE 'Coluna compatibilidade_textual adicionada';
            ELSE
                RAISE NOTICE 'Coluna compatibilidade_textual já existe';
            END IF;

            -- Verificar e adicionar coluna ratio_preco
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'produtos' AND column_name = 'ratio_preco') THEN
                ALTER TABLE produtos ADD COLUMN ratio_preco DECIMAL(8,2);
                RAISE NOTICE 'Coluna ratio_preco adicionada';
            ELSE
                RAISE NOTICE 'Coluna ratio_preco já existe';
            END IF;

        END $$;

        -- Criar view para monitoramento (se não existir)
        CREATE OR REPLACE VIEW vw_produtos_risco_imagem AS
        SELECT 
            titulo,
            margem_lucro,
            compatibilidade_textual,
            ratio_preco,
            url,
            created_at,
            fonte_de_verificacao
        FROM produtos 
        WHERE risco_imagem = true 
        ORDER BY margem_lucro DESC;

        -- Criar índices para performance
        CREATE INDEX IF NOT EXISTS idx_produtos_risco_imagem ON produtos(risco_imagem) WHERE risco_imagem = true;
        CREATE INDEX IF NOT EXISTS idx_produtos_fonte_verificacao ON produtos(fonte_de_verificacao);
        CREATE INDEX IF NOT EXISTS idx_produtos_margem_lucro ON produtos(margem_lucro DESC);
        `;

        console.log('📝 Aplicando migrações...');

        const { error } = await supabase.rpc('exec_sql', { 
            sql: migracaoSQL 
        });

        if (error) {
            // Se a função exec_sql não existir, vamos tentar aplicar as alterações uma por uma
            console.log('⚠️ Função exec_sql não disponível. Aplicando alterações individuais...');
            
            // Tentar aplicar as alterações através de múltiplas queries
            const alteracoes = [
                "ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_comparada BOOLEAN DEFAULT false",
                "ALTER TABLE produtos ADD COLUMN IF NOT EXISTS fonte_de_verificacao VARCHAR(20) DEFAULT 'imagem'",
                "ALTER TABLE produtos ADD COLUMN IF NOT EXISTS risco_imagem BOOLEAN DEFAULT false",
                "ALTER TABLE produtos ADD COLUMN IF NOT EXISTS compatibilidade_textual DECIMAL(5,2)",
                "ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ratio_preco DECIMAL(8,2)"
            ];

            for (const sql of alteracoes) {
                try {
                    const { error: alterError } = await supabase.rpc('exec_sql', { sql });
                    if (alterError) {
                        console.log(`⚠️ Erro na alteração: ${sql} - ${alterError.message}`);
                    } else {
                        console.log(`✅ Aplicado: ${sql.substring(0, 50)}...`);
                    }
                } catch (e) {
                    console.log(`⚠️ Erro: ${e.message}`);
                }
            }
        } else {
            console.log('✅ Migrações aplicadas com sucesso!');
        }

        // Verificar se as colunas foram criadas
        console.log('\n🔍 Verificando estrutura da tabela produtos...');
        
        const { data: colunas, error: errorColunas } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable, column_default')
            .eq('table_name', 'produtos')
            .eq('table_schema', 'public');

        if (errorColunas) {
            console.log('❌ Erro ao verificar colunas:', errorColunas.message);
        } else {
            console.log('\n📋 Colunas da tabela produtos:');
            colunas
                .filter(col => ['imagem_comparada', 'fonte_de_verificacao', 'risco_imagem', 'compatibilidade_textual', 'ratio_preco', 'titulo', 'margem_lucro'].includes(col.column_name))
                .forEach(col => {
                    console.log(`   • ${col.column_name} (${col.data_type}) - Default: ${col.column_default || 'NULL'}`);
                });
        }

        console.log('\n✅ Migração do sistema de fallback concluída!');
        console.log('🎯 Agora o sistema pode utilizar verificação textual como fallback.');

    } catch (error) {
        console.error('❌ Erro ao aplicar migrações:', error.message);
        process.exit(1);
    }
}

// Executar migrações
aplicarMigracoesFallback()
    .then(() => {
        console.log('\n🚀 Sistema pronto para usar o fallback textual!');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    });
