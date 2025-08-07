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
import { fileURLToPath } from 'url';

const TEMP_DIR = './temp_img';
fs.mkdirSync(TEMP_DIR, { recursive: true });

export async function compararImagensPorHash(url1, url2) {
  const caminho1 = await baixarImagem(url1, 'img1');
  const caminho2 = await baixarImagem(url2, 'img2');

  const hash1 = await imghash.hash(caminho1, 16, 'hex', 'phash');
  const hash2 = await imghash.hash(caminho2, 16, 'hex', 'phash');

  const distancia = imghash.hamming(hash1, hash2);
  const similaridade = Math.round((1 - distancia / hash1.length) * 100);
  return { hash1, hash2, distancia, similaridade, similar: similaridade >= 80 };
}

async function baixarImagem(url, nome) {
  const caminho = path.join(TEMP_DIR, `${nome}.jpg`);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(caminho, response.data);
  return caminho;
}
