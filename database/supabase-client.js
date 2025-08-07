/**
 * @fileoverview Cliente Supabase para integração com banco de dados
 * @description Configuração centralizada para todas as operações de banco
 * 
 * @author Sistema de Scraping AliExpress - Database Client v1.0
 * @version 1.0.0 - Cliente Supabase integrado
 * @since 2024-01-01
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Validar variáveis obrigatórias
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) {
    throw new Error('❌ SUPABASE_URL não encontrada no arquivo .env');
}

if (!supabaseKey) {
    throw new Error('❌ SUPABASE_KEY não encontrada no arquivo .env');
}

// Criar cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    db: {
        schema: 'public'
    }
});

/**
 * Testar conexão com o Supabase
 * @returns {Promise<boolean>} True se conectado com sucesso
 */
export async function testarConexaoSupabase() {
    try {
        const { data, error } = await supabase
            .from('produtos')
            .select('id')
            .limit(1);

        if (error) {
            console.error('❌ Erro na conexão Supabase:', error.message);
            return false;
        }

        console.log('✅ Conexão com Supabase estabelecida com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao testar conexão:', error.message);
        return false;
    }
}

/**
 * Obter estatísticas básicas do banco
 * @returns {Promise<Object>} Estatísticas do banco
 */
export async function obterEstatisticasBanco() {
    try {
        const [
            { count: totalProdutos },
            { count: totalMetricas },
            { count: totalCampanhas }
        ] = await Promise.all([
            supabase.from('produtos').select('*', { count: 'exact', head: true }),
            supabase.from('metricas_scraping').select('*', { count: 'exact', head: true }),
            supabase.from('campanhas').select('*', { count: 'exact', head: true })
        ]);

        return {
            totalProdutos: totalProdutos || 0,
            totalMetricas: totalMetricas || 0,
            totalCampanhas: totalCampanhas || 0,
            ultimaVerificacao: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:', error.message);
        return {
            totalProdutos: 0,
            totalMetricas: 0,
            totalCampanhas: 0,
            erro: error.message
        };
    }
}
