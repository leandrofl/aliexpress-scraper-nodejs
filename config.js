import dotenv from 'dotenv';
dotenv.config();

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Configurações principais
export const CATEGORIES = (process.env.CATEGORIES || 'Casa & Cozinha,Tecnologia,Beleza,Lifestyle,Pets').split(',');
export const MIN_SALES = parseInt(process.env.MIN_SALES || '500');
export const MIN_REVIEWS = parseInt(process.env.MIN_REVIEWS || '50');
export const MIN_RATING = parseFloat(process.env.MIN_RATING || '4.5');
export const MIN_ORDERS = parseInt(process.env.MIN_ORDERS || '100');
export const MAX_SHIPPING_COST = parseFloat(process.env.MAX_SHIPPING_COST || '15.0');
export const MIN_PROFIT_MARGIN = parseFloat(process.env.MIN_PROFIT_MARGIN || '0.30');
export const DEFAULT_ZIPCODE = process.env.DEFAULT_ZIPCODE || '01001-000';
export const MAX_PRODUCTS_RAW = parseInt(process.env.MAX_PRODUCTS_RAW || '80');
export const TARGET_PRODUCTS_FINAL = parseInt(process.env.TARGET_PRODUCTS_FINAL || '20');
export const MAX_PAGES_PER_CATEGORY = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '5');
export const ENABLE_SCREENSHOTS = ['true', '1', 'yes'].includes((process.env.ENABLE_SCREENSHOTS || 'false').toLowerCase());

export const CHROME_USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR;
export const CHROME_PROFILE = process.env.CHROME_PROFILE;
export const DIRETORIO_DEBUG = process.env.DIRETORIO_DEBUG || 'scraper/debug_files';
export const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
