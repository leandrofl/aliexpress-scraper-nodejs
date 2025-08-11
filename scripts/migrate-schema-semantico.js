#!/usr/bin/env node

/**
 * Script para aplicar as alterações do schema semântico no banco Supabase
 * Adiciona os novos campos para análise semântica e estatísticas de preço
 */

import { supabase } from '../database/supabase-client.js';

async function verificarColunaExiste(tabela, coluna) {
    try {
        const { data, error } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', tabela)
            .eq('column_name', coluna)
            .eq('table_schema', 'public');

        if (error) {
            console.warn(`⚠️ Erro ao verificar coluna ${coluna}:`, error.message);
            return false;
        }

        return data && data.length > 0;
    } catch (error) {
        console.warn(`⚠️ Erro ao verificar coluna ${coluna}:`, error.message);
        return false;
    }
}

async function adicionarColuna(tabela, coluna, tipo, restricoes = '') {
    const existe = await verificarColunaExiste(tabela, coluna);
    
    if (existe) {
        console.log(`✅ Coluna ${coluna} já existe na tabela ${tabela}`);
        return true;
    }

    try {
        // Como não temos acesso direto ao SQL, vamos fazer um INSERT/UPDATE de teste
        // para forçar a criação da coluna se ela não existir
        console.log(`🔧 Tentando adicionar coluna ${coluna} à tabela ${tabela}...`);
        
        // Primeiro, vamos verificar se podemos acessar a tabela
        const { data: testData, error: testError } = await supabase
            .from(tabela)
            .select('id')
            .limit(1);

        if (testError) {
            console.error(`❌ Erro ao acessar tabela ${tabela}:`, testError.message);
            return false;
        }

        console.log(`⚠️ Não é possível adicionar coluna ${coluna} automaticamente via Supabase client`);
        console.log(`📝 Execute manualmente no SQL Editor do Supabase:`);
        console.log(`   ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ${coluna} ${tipo} ${restricoes};`);
        
        return false;
    } catch (error) {
        console.error(`❌ Erro ao adicionar coluna ${coluna}:`, error.message);
        return false;
    }
}

async function aplicarMigracao() {
    console.log('🗄️ MIGRAÇÃO DO SCHEMA SEMÂNTICO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const tabela = 'produtos';
    const migracoes = [
        {
            nome: 'preco_medio_ml',
            tipo: 'DECIMAL(10,2)',
            restricoes: ''
        },
        {
            nome: 'desvio_preco',
            tipo: 'DECIMAL(5,2)',
            restricoes: ''
        },
        {
            nome: 'score_semantico',
            tipo: 'INTEGER',
            restricoes: 'CHECK (score_semantico BETWEEN 0 AND 100)'
        },
        {
            nome: 'metodo_analise_titulo',
            tipo: 'VARCHAR(50)',
            restricoes: "CHECK (metodo_analise_titulo IN ('imagem', 'semantico', 'textual_fallback'))"
        },
        {
            nome: 'aprovado_fallback_texto',
            tipo: 'BOOLEAN',
            restricoes: 'DEFAULT FALSE'
        },
        {
            nome: 'comentario_semantico',
            tipo: 'TEXT',
            restricoes: ''
        }
    ];

    console.log(`\n� Verificando tabela: ${tabela}`);
    
    // Verificar se a tabela existe
    const { data: tabelaExiste, error: erroTabela } = await supabase
        .from(tabela)
        .select('id')
        .limit(1);

    if (erroTabela) {
        console.error(`❌ Erro ao acessar tabela ${tabela}:`, erroTabela.message);
        console.log('\n📋 COMANDOS SQL PARA EXECUTAR MANUALMENTE:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        migracoes.forEach(migracao => {
            console.log(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ${migracao.nome} ${migracao.tipo} ${migracao.restricoes};`);
        });
        
        console.log('\n💡 Execute estes comandos no SQL Editor do Supabase Dashboard');
        return;
    }

    console.log(`✅ Tabela ${tabela} encontrada!`);

    for (const migracao of migracoes) {
        await adicionarColuna(tabela, migracao.nome, migracao.tipo, migracao.restricoes);
    }

    // Verificar quais colunas foram criadas
    console.log('\n🔍 Verificando colunas semânticas...');
    
    for (const migracao of migracoes) {
        const existe = await verificarColunaExiste(tabela, migracao.nome);
        console.log(`   ${existe ? '✅' : '❌'} ${migracao.nome}`);
    }

    if (migracoes.some(async (m) => !(await verificarColunaExiste(tabela, m.nome)))) {
        console.log('\n📋 COMANDOS SQL PARA EXECUTAR MANUALMENTE:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        for (const migracao of migracoes) {
            const existe = await verificarColunaExiste(tabela, migracao.nome);
            if (!existe) {
                console.log(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ${migracao.nome} ${migracao.tipo} ${migracao.restricoes};`);
            }
        }
        
        console.log('\n💡 Execute estes comandos no SQL Editor do Supabase Dashboard');
        console.log('🔗 Acesse: https://supabase.com/dashboard → Seu projeto → SQL Editor');
    }

    console.log('\n🎯 VERIFICAÇÃO DE MIGRAÇÃO CONCLUÍDA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Executar migração
aplicarMigracao().catch(console.error);
