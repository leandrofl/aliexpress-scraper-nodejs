/**
 * @fileoverview Comparação de imagens usando pHash (Perceptual Hash)
 * @description Sistema para comparar visualmente produtos do AliExpress com Mercado Livre
 * usando análise de similaridade de imagens por hash perceptual
 * 
 * @author Sistema de Scraping AliExpress - Comparador Visual
 * @version 2.0.0 - Versão otimizada e simplificada
 * @since 2024-01-01
 */

import imghash from 'imghash';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

const TEMP_DIR = './temp_img';
fs.mkdirSync(TEMP_DIR, { recursive: true });

export async function compararImagensPorHash(url1, url2) {
  const caminho1 = await baixarImagem(url1, 'img1');
  const caminho2 = await baixarImagem(url2, 'img2');

  // Gera pHash em hex (bits=16) – assinatura compatível com versões atuais do imghash
  const hash1 = await imghash.hash(caminho1, 16);
  const hash2 = await imghash.hash(caminho2, 16);

  // Calcula distância de Hamming em nível de bits entre as strings hex
  const distancia = hammingDistanceHex(hash1, hash2);
  const totalBits = Math.min(hash1.length, hash2.length) * 4; // 4 bits por dígito hex
  const similaridade = totalBits > 0 ? Math.round((1 - distancia / totalBits) * 100) : 0;
  return { hash1, hash2, distancia, similaridade, similar: similaridade >= 80 };
}

async function baixarImagem(url, nome) {
  const headersBase = buildImageRequestHeaders(url);
  const tryOnce = async (tryUrl, extraHeaders = {}) => {
    return axios.get(tryUrl, {
      responseType: 'arraybuffer',
      headers: { ...headersBase, ...extraHeaders },
      timeout: 15000,
      // Keep default validateStatus; we'll catch non-2xx as errors
    });
  };

  let response;
  let lastErr;
  // Até 3 tentativas: 1) headers base; 2) reforça referer se 403/404; 3) reforça Accept/UA novamente
  for (let i = 0; i < 3; i++) {
    try {
      if (i === 0) {
        response = await tryOnce(url);
      } else if (i === 1) {
        response = await tryOnce(url, buildStrongerHeaders(url));
      } else {
        response = await tryOnce(url, buildStrongerHeaders(url));
      }
      break;
    } catch (err) {
      lastErr = err;
      // Em alguns casos, um pequeno backoff ajuda
      await delay(200 * (i + 1));
    }
  }
  if (!response) throw lastErr || new Error('Falha ao baixar imagem');

  // Escolhe a extensão correta baseada no path ou content-type
  let ext = path.extname(new URL(url).pathname).toLowerCase();
  if (!ext || ext.length > 5) {
    const ct = (response.headers['content-type'] || '').toLowerCase();
    if (ct.includes('image/jpeg') || ct.includes('image/jpg')) ext = '.jpg';
    else if (ct.includes('image/png')) ext = '.png';
    else if (ct.includes('image/webp')) ext = '.webp';
    else if (ct.includes('image/bmp')) ext = '.bmp';
    else ext = '.img';
  }
  const caminho = path.join(TEMP_DIR, `${nome}${ext}`);
  fs.writeFileSync(caminho, response.data);
  return caminho;
}

function buildImageRequestHeaders(rawUrl) {
  const u = new URL(rawUrl);
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  const headers = {
    'User-Agent': ua,
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
  };
  // Define Referer quando necessário
  if (u.hostname.includes('mlstatic.com') || u.hostname.includes('mercadolivre.com')) {
    headers['Referer'] = 'https://www.mercadolivre.com.br/';
  } else if (u.hostname.includes('alicdn.com') || u.hostname.includes('aliexpress')) {
    headers['Referer'] = 'https://www.aliexpress.com/';
  }
  return headers;
}

function buildStrongerHeaders(rawUrl) {
  // Reforça algumas chaves que CDNs usam para bloquear hotlinking
  const base = buildImageRequestHeaders(rawUrl);
  return {
    ...base,
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1',
    'Sec-Ch-Ua': '"Chromium";v="125", "Not.A/Brand";v="24", "Google Chrome";v="125"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
  };
}

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

// Calcula a distância de Hamming entre dois hashes hexadecimais
function hammingDistanceHex(hexA, hexB) {
  if (!hexA || !hexB) return Number.MAX_SAFE_INTEGER;
  const n = Math.min(hexA.length, hexB.length);
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const va = parseInt(hexA[i], 16) || 0;
    const vb = parseInt(hexB[i], 16) || 0;
    const x = va ^ vb; // XOR entre nibbles
    dist += BIT_COUNT[x];
  }
  // Se tamanhos diferirem, conta bits restantes do maior
  const rest = hexA.length > n ? hexA.slice(n) : hexB.length > n ? hexB.slice(n) : '';
  for (let i = 0; i < rest.length; i++) {
    const v = parseInt(rest[i], 16) || 0;
    dist += BIT_COUNT[v];
  }
  return dist;
}

// Tabela de bits setados para nibbles (0..15)
const BIT_COUNT = [
  0, 1, 1, 2,
  1, 2, 2, 3,
  1, 2, 2, 3,
  2, 3, 3, 4
];
