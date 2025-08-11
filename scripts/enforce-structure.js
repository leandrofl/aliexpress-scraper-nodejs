/*
  Enforce repository structure: remove stray/duplicate files per guidelines.
  - Docs (.md): keep in docs/ (root README.md allowed)
  - Tests: keep in unitTests/ (no tests/ folder, no root test files)
  - Database files: keep in database/
  - Do not keep .env.example
*/

import fs from 'fs';
import path from 'path';

const root = process.cwd();
const toDelete = [
  // Root MD duplicates
  'CHANGELOG_ML_REAL.md',
  'CONTEXTO_ATUAL.md',
  'CORREÇÃO_ABAS_E_SESSÕES.md',
  'MELHORIAS_INTERCEPTAÇÃO_API.md',
  'PROJETO_LIMPO.md',
  'README-IMPLEMENTACAO.md',
  'README-NOVO.md',
  'SISTEMA-SEMANTICO-COMPLETO.md',
  'SISTEMA_COMPARAÇÃO_INTELIGENTE.md',
  'SISTEMA_VISUAL_IMPLEMENTADO.md',
  // Root tests
  'test-fallback-traducao.js',
  'teste-melhorias-chatgpt.js',
  // Root SQL duplicates
  'schema-minimo.sql',
  'opcional-views-rls.sql',
  // Root DB markdown duplicate (empty in root)
  'SETUP-SUPABASE.md',
  // Env example
  '.env.example'
];

// Known nested legacy files to delete
const nestedToDelete = [
  path.join('marginValidation', 'mercado-livre-scraper-v2.js'),
  path.join('validation', 'duplicate-checker.js')
  , path.join('utils', 'comparador-imagens-v2.js')
  , path.join('utils', 'comparador-produtos-v2.js')
];

// Known nested legacy folders to delete (recursively)
const nestedFoldersToDelete = [
  'histMudancasCopilot',
  'validation'
];

// Legacy root files to delete
const legacyRootFiles = [
  'run-scraper.js'
];

// Paths for migration
const dataFolder = path.join(process.cwd(), 'data');
const dataFile = path.join(dataFolder, 'produtos-processados.json');
const databaseFolder = path.join(process.cwd(), 'database');
const databaseDataFile = path.join(databaseFolder, 'produtos-processados.json');

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Removed: ${path.relative(root, filePath)}`);
    }
  } catch (e) {
    console.log(`⚠️ Failed to remove ${filePath}: ${e.message}`);
  }
}

function deleteFolderIfEmpty(folderPath) {
  try {
    if (fs.existsSync(folderPath)) {
      const entries = fs.readdirSync(folderPath);
      if (entries.length === 0) {
        fs.rmdirSync(folderPath);
        console.log(`🧹 Removed empty folder: ${path.relative(root, folderPath)}`);
      }
    }
  } catch (e) {
    console.log(`⚠️ Failed to remove folder ${folderPath}: ${e.message}`);
  }
}

function deleteFolderRecursive(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) return;
    for (const entry of fs.readdirSync(folderPath)) {
      const full = path.join(folderPath, entry);
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) {
        deleteFolderRecursive(full);
      } else {
        safeUnlink(full);
      }
    }
    fs.rmdirSync(folderPath);
    console.log(`🧹 Removed folder: ${path.relative(root, folderPath)}`);
  } catch (e) {
    console.log(`⚠️ Failed to remove folder ${folderPath}: ${e.message}`);
  }
}

function main() {
  // 1) Delete known stray files in root
  toDelete.forEach(name => safeUnlink(path.join(root, name)));

  // 1b) Delete known nested legacy files
  nestedToDelete.forEach(rel => safeUnlink(path.join(root, rel)));

  // 1c) Delete known nested legacy folders
  nestedFoldersToDelete.forEach(rel => deleteFolderRecursive(path.join(root, rel)));

  // 1d) Delete legacy root files
  legacyRootFiles.forEach(name => safeUnlink(path.join(root, name)));

  // 3) Migrate data/produtos-processados.json to database/ if present
  try {
    if (fs.existsSync(dataFile)) {
      if (!fs.existsSync(databaseFolder)) fs.mkdirSync(databaseFolder, { recursive: true });
      fs.copyFileSync(dataFile, databaseDataFile);
      console.log(`📦 Migrated: ${path.relative(root, dataFile)} -> ${path.relative(root, databaseDataFile)}`);
    }
  } catch (e) {
    console.log(`⚠️ Failed to migrate data file: ${e.message}`);
  }

  // 4) Remove data/ folder if exists (now legacy)
  try {
    if (fs.existsSync(dataFolder)) {
      deleteFolderRecursive(dataFolder);
    }
  } catch (e) {
    console.log(`⚠️ Failed to remove data/: ${e.message}`);
  }

  // 2) Remove tests folder files (legacy) then folder if empty
  const testsFolder = path.join(root, 'tests');
  try {
    if (fs.existsSync(testsFolder)) {
      for (const f of fs.readdirSync(testsFolder)) {
        safeUnlink(path.join(testsFolder, f));
      }
      deleteFolderIfEmpty(testsFolder);
    }
  } catch (e) {
    console.log(`⚠️ Failed to clean tests/: ${e.message}`);
  }

  console.log('✅ Repository structure enforcement completed.');
}

main();
