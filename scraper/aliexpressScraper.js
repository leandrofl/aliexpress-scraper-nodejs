import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {
  scrollUntilAllProductsLoaded,
  tirarScreenshot,
  salvarHtmlPesquisa,
  salvarJsonProduto,
  delay,
  randomDelay,
  logInfo,
  logSucesso,
  logErro,
  filtrarPorMaisVendidos
} from './utils.js';

import {
  applyQuantitativeFilter
} from '../filters/quantitative.js';

import {
  applyQualitativeFilter
} from '../filters/qualitative.js';

import {
  assessRisk
} from '../filters/riskAssessment.js';

import {
  CATEGORIES,
  MAX_PRODUCTS_RAW,
  TARGET_PRODUCTS_FINAL,
  MAX_PAGES_PER_CATEGORY
} from '../config.js';

// Configurar e inicializar o browser
export async function setupBrowser() {
  // Configurar Stealth Plugin
  puppeteer.use(StealthPlugin());
  
  // 🔴 BREAKPOINT: Configuração inicial
  console.log('🐛 [DEBUG] Configurações carregadas:', {
      categories: CATEGORIES,
      headless: false, // forçado para debug
      debug: true
  });
  
  logInfo('🚀 Configurando browser com stealth...');
  
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=VizDisplayCompositor',
    '--no-first-run',
    '--disable-infobars',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-accelerated-2d-canvas',
    '--disable-web-security',
    '--disable-features=site-per-process',
    '--disable-ipc-flooding-protection',
    '--lang=pt-BR',
    '--single-process', // Reduzir processos filhos
    '--no-zygote' // Evitar processos zygote no Windows
  ];

  const browser = await puppeteer.launch({
    headless: false,
    devtools: false,
    slowMo: 150,
    args: launchArgs
  });

  logSucesso('✅ Browser iniciado com sucesso');
  return browser;
}

export async function processCategory(browser, categoria) {
  // Usar a primeira aba disponível (about:blank) em vez de criar nova
  const pages = await browser.pages();
  const page = pages[0]; // Usar a aba about:blank que já existe
  
  await page.setViewport({ width: 1920, height: 1080 });

  // Headers mais realistas
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Configurar página para ser mais stealth
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    window.chrome = {
      runtime: {},
    };

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  // Headers adicionais para parecer mais humano
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

  const produtos = [];
  let pagina = 1;

  logInfo(`🔍 Iniciando processamento da categoria: ${categoria}`);

  while (
    produtos.length < MAX_PRODUCTS_RAW &&
    pagina <= MAX_PAGES_PER_CATEGORY
  ) {
    try {
      if (pagina === 1) {
        // Primeira página: acessar via página inicial
        logInfo(`🌐 Acessando página inicial do AliExpress...`);
        await page.goto('https://pt.aliexpress.com', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        await delay(2000);

        logInfo(`🔍 Buscando por: ${categoria}`);
        const searchBox = await page.$('input[placeholder*="busca"], input[name="SearchText"], #search-words, input[type="search"]');
        if (searchBox) {
          await searchBox.click();
          await page.waitForTimeout(500);
          await searchBox.type(categoria, { delay: 100 });
          await page.keyboard.press('Enter');
          await page.waitForTimeout(3000);
          logSucesso(`✅ Busca realizada com sucesso!`);

          // Aplicar filtro de mais vendidos
          await filtrarPorMaisVendidos(page);

        } else {
          throw new Error('Caixa de busca não encontrada');
        }
      } else {
        // Páginas seguintes: tentar navegar pelos botões
        logInfo(`➡️ Navegando para página ${pagina}...`);
        const nextButton = await page.$('button[aria-label="next"], .next-btn, .comet-pagination-next, .comet-pagination-item:last-child');
        if (nextButton) {
          await nextButton.click();
          await page.waitForTimeout(3000);
        } else {
          logInfo(`⚠️ Botão de próxima página não encontrado, finalizando...`);
          break;
        }
      }

      // Aguardar produtos carregarem
      try {
        await page.waitForSelector('a.search-card-item, .item, .product, [data-pl="product-list"] a', { timeout: 30000 });
      } catch (selectorError) {
        logInfo(`⚠️ Produtos não encontrados na página ${pagina}, tentando aguardar mais...`);
        await delay(5000);
      }

      await scrollUntilAllProductsLoaded(page);
      //await tirarScreenshot(page, categoria, pagina);
      //await salvarHtmlPesquisa(page, categoria, pagina);

      const produtosPagina = await extractProductsFromPage(page, categoria, pagina, produtos);

      // Separar produtos originais e bundles como no Python
      const produtosOriginais = produtosPagina.filter(p => !p.is_bundle);
      const produtosBundle = produtosPagina.filter(p => p.is_bundle);

      logInfo(`Página ${pagina} | Total encontrados: ${produtosPagina.length} | Originais: ${produtosOriginais.length} | Bundles: ${produtosBundle.length}`);

      let numProdutosOriginaisCompletos = 0;

      for (let i = 0; i < produtosPagina.length; i++) {
        const produto = produtosPagina[i];
        
        // Pular bundles como no Python
        if (produto.is_bundle) {
          logInfo(`⚠️ Produto bundle ignorado: ${produto.href}`);
          continue;
        }

        try {
          logInfo(`🔍 Processando produto ${i + 1}/${produtosPagina.length}: ${produto.product_id}`);
          await filterAndAppendProduct(produto, produtos, categoria, pagina, browser);
          numProdutosOriginaisCompletos++;
          
          logSucesso(`🟢 Página ${pagina} | Produto processado ${i + 1}/${produtosPagina.length}: ${produto.product_id}`);
        } catch (err) {
          logErro(`🔴 Página ${pagina} | Produto não processado ${i + 1}/${produtosPagina.length}: ${produto.product_id} - ${err.message}`);
        }

        // Parar se atingir o alvo de produtos aprovados
        if (produtos.filter(p => p.aprovado).length >= TARGET_PRODUCTS_FINAL) {
          logInfo(`✅ Meta de ${TARGET_PRODUCTS_FINAL} produtos aprovados atingida!`);
          break;
        }
      }

      logInfo(`📦 Página ${pagina} finalizada. Total acumulado: ${produtos.length}`);
      pagina++;
      await randomDelay();

    } catch (err) {
      logErro(`Erro na página ${pagina} da categoria ${categoria}: ${err.message}`);
      break;
    }
  }

  // Não fechar a página pois é a aba principal
  return produtos;
}

export async function extractProductsFromPage(page, categoria, pagina, produtosExistentes = []) {
  try {
    const produtos = await page.evaluate((categoria) => {
      // Aguardar elementos aparecerem
      const selectors = [
        'a[class*="search-card-item"][href*="/item/"]',
        'a[class*="search-card-item"][href*="BundleDeals"]'
      ];

      let elementos = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        elementos = [...elementos, ...Array.from(found)];
      }

      console.log(`🔎 Total de elementos <a> encontrados no DOM: ${elementos.length}`);

      const lista = [];
      let totalOriginal = 0;
      let totalBundle = 0;

      for (const el of elementos) {
        const href = el.href || '';
        
        // Verificar se é produto original
        const matchOriginal = href.match(/\/item\/(\d+)\.html/);
        // Verificar se é bundle
        const matchBundle = href.match(/BundleDeals\d?\?productIds=([0-9:]+)/);
        
        if (!matchOriginal && !matchBundle) {
          continue;
        }

        let productId = null;
        let isBundle = false;

        if (matchOriginal) {
          productId = matchOriginal[1];
          isBundle = false;
          totalOriginal++;
        } else if (matchBundle) {
          productId = null; // Bundles não têm product_id único
          isBundle = true;
          totalBundle++;
        }

        const produto = {
          product_id: productId,
          categoria: categoria,
          aprovado: false,
          is_bundle: isBundle,
          href: href,
          // Campos adicionais do DOM para compatibilidade
          nome: el.querySelector('h1,h2,h3,.item-title,.product-title')?.innerText || '',
          preco: el.querySelector('.search-card-item-price,.price,.item-price')?.innerText || '',
          url: href,
          vendas: el.innerText.includes('vendido') ? el.innerText : ''
        };

        lista.push(produto);
      }

      console.log(`[DEBUG] Produtos extraídos do DOM nesta página: ${lista.length} (Originais: ${totalOriginal}, Bundles: ${totalBundle})`);
      return lista;
    }, categoria);

    // Filtrar duplicatas baseado no Python
    const idsExistentes = new Set(
      produtosExistentes
        .filter(p => p.product_id)
        .map(p => p.product_id)
    );
    
    const hrefsExistentes = new Set(
      produtosExistentes
        .filter(p => p.href)
        .map(p => p.href)
    );

    const produtosFiltrados = produtos.filter(produto => {
      if (produto.product_id && idsExistentes.has(produto.product_id)) {
        return false;
      }
      if (produto.href && hrefsExistentes.has(produto.href)) {
        return false;
      }
      return true;
    });

    // logSucesso(`✔️ ${produtosFiltrados.length} produtos únicos extraídos da página ${pagina}.`);
    return produtosFiltrados;

  } catch (err) {
    logErro(`Erro ao extrair produtos da página ${pagina}: ${err.message}`);
    return [];
  }
}

async function cleanupBrowser(browser) {
  try {
    // Fechar todas as páginas abertas primeiro
    const pages = await browser.pages();
    for (const page of pages) {
      try {
        await page.close();
      } catch (error) {
        // Ignora erros ao fechar páginas individuais
      }
    }
    
    // Aguardar um pouco para processos se organizarem
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fechar o browser
    await browser.close();
  } catch (error) {
    console.log('⚠️  Processo do browser finalizado externamente');
    
    // Força encerramento em último caso (Windows)
    try {
      const { spawn } = require('child_process');
      spawn('taskkill', ['/f', '/im', 'chrome.exe'], { stdio: 'ignore' });
    } catch (killError) {
      // Ignora erro se não conseguir forçar encerramento
    }
  }
}

export async function extractProductDetails(browser, produto) {
  try {
    // Usar product_id se disponível, senão extrair da URL
    let productId = produto.product_id;
    let urlProduto = produto.url || produto.href;
    
    if (!productId) {
      const productIdMatch = urlProduto.match(/\/item\/(\d+)\.html/);
      if (!productIdMatch) {
        logErro(`URL inválida para extração de product_id: ${urlProduto}`);
        return { vendedor: '', peso: '', frete: '' };
      }
      productId = productIdMatch[1];
    }
    
    // Garantir URL padrão
    if (!urlProduto.startsWith('https://pt.aliexpress.com/item/')) {
      urlProduto = `https://pt.aliexpress.com/item/${productId}.html`;
    }
    
    // logInfo(`🔍 Acessando PDP direta: ${urlProduto}`);
    
    const novaAba = await browser.newPage();
    
    let dadosAPI = null;
    
    // Interceptar resposta da API antes de navegar
    novaAba.on('response', async (response) => {
      if (response.url().includes('mtop.aliexpress.pdp.pc.query') && response.status() === 200) {
        try {
          const rawText = await response.text();
          // logInfo(`📡 Raw response recebida: ${rawText.substring(0, 100)}...`);
          
          // Múltiplas tentativas de limpeza do wrapper JSONP
          let cleanText = rawText;
          
          // Método 1: Remover wrapper mtopjsonp padrão
          cleanText = cleanText.replace(/^mtopjsonp\d*\(/, '').replace(/\)\s*$/, '');
          
          // Método 2: Se ainda tem caracteres estranhos no início, tentar encontrar o {
          const firstBrace = cleanText.indexOf('{');
          if (firstBrace > 0) {
            cleanText = cleanText.substring(firstBrace);
          }
          
          // Método 3: Se ainda tem caracteres no final, encontrar o último }
          const lastBrace = cleanText.lastIndexOf('}');
          if (lastBrace > 0 && lastBrace < cleanText.length - 1) {
            cleanText = cleanText.substring(0, lastBrace + 1);
          }
          
          // logInfo(`📡 JSON limpo: ${cleanText.substring(0, 100)}...`);
          
          const jsonData = JSON.parse(cleanText);
          dadosAPI = jsonData?.data?.result || {};
          logSucesso(`✅ API interceptada com sucesso para produto ${productId}`);
        } catch (e) {
          logErro(`Erro ao processar JSON da API: ${e.message}`);
          logErro(`Raw text: ${rawText.substring(0, 200)}...`);
        }
      }
    });
    
    // Navegar para a página do produto
    await novaAba.goto(urlProduto, { 
      waitUntil: 'domcontentloaded', 
      timeout: 40000 
    });
    
    // Aguardar um pouco para garantir que a API foi chamada
    await delay(3000);
    
    let detalhes = { vendedor: '', peso: '', frete: '', reviews: 0, rating: 0, vendas: 0 };
    
    if (dadosAPI) {
      // Parse dos dados da API seguindo a lógica do Python
      detalhes = parseProductJson(dadosAPI, productId);
    } else {
      // Fallback: tentar extrair dados do DOM
      logInfo(`⚠️ API não interceptada, tentando fallback DOM para ${productId}`);
      detalhes = await novaAba.evaluate(() => {
        const getText = (selector) => document.querySelector(selector)?.innerText || '';
        return {
          vendedor: getText('.store-info .store-name, .shop-name'),
          peso: getText('td:contains("Peso") + td'),
          frete: getText('.dynamic-shipping'),
          reviews: parseInt(getText('.reviews-num, .rating-num') || '0'),
          rating: parseFloat(getText('.rating-value, .stars-rating') || '0'),
          vendas: 0
        };
      });
    }
    
    try {
        await novaAba.close();
    } catch (closeError) {
        // Ignorar erros de fechamento da aba
    }
    return detalhes;

  } catch (err) {
    logErro(`Erro ao acessar detalhes do produto ${url}: ${err.message}`);
    return { vendedor: '', peso: '', frete: '', reviews: 0, rating: 0, vendas: 0 };
  }
}

// Função para fazer parse do JSON da API (adaptada do Python)
function parseProductJson(data, productId) {
  try {
    const detalhes = {
      vendedor: '',
      peso: '',
      frete: '',
      reviews: 0,
      rating: 0,
      vendas: 0,
      preco: 0,
      imagens: '',
      rastreamento: false,
      custoFrete: 0,
      tipoFrete: '',
      tempoEntrega: 0,
      avaliacaoVendedor: 0,
      tempoAbertura: ''
    };

    // Título
    const title = data?.GLOBAL_DATA?.globalData?.subject || '';
    
    // Preço
    const priceStr = data?.PRICE?.targetSkuPriceInfo?.salePriceString || '';
    if (priceStr) {
      const priceMatch = priceStr.match(/R\$\s*([\d,.]+)/);
      if (priceMatch) {
        detalhes.preco = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
      }
    }
    
    // Vendas
    const otherText = data?.PC_RATING?.otherText || '';
    if (otherText && otherText.includes('vendidos')) {
      const salesMatch = otherText.match(/(\d+)/);
      if (salesMatch) {
        detalhes.vendas = parseInt(salesMatch[1]);
      }
    }
    
    // Imagens
    const images = data?.HEADER_IMAGE_PC?.imagePathList || [];
    detalhes.imagens = images.join(', ');
    
    // Reviews e Rating
    const ratingInfo = data?.PC_RATING || {};
    detalhes.reviews = parseInt(ratingInfo.totalValidNum || 0);
    detalhes.rating = parseFloat(ratingInfo.rating || 0);
    
    // Informações de frete
    const logisticsList = data?.SHIPPING?.originalLayoutResultList || [];
    if (logisticsList.length > 0) {
      const logistics = logisticsList[0]?.bizData || {};
      const additionLayout = logisticsList[0]?.additionLayout || [];
      
      detalhes.custoFrete = parseFloat(logistics.displayAmount || 0);
      detalhes.tipoFrete = logistics.deliveryOptionCode || '';
      detalhes.tempoEntrega = parseFloat(logistics.guaranteedDeliveryTime || 0);
      
      // Rastreamento
      if (additionLayout.length > 0) {
        detalhes.rastreamento = additionLayout[0]?.content === 'Rastreamento Disponível';
      }
    }
    
    // Informações do vendedor
    const supplier = data?.SHOP_CARD_PC || {};
    detalhes.vendedor = supplier.storeName || '';
    detalhes.avaliacaoVendedor = supplier.sellerPositiveRate ? (parseFloat(supplier.sellerPositiveRate) / 20) : 0;
    detalhes.tempoAbertura = supplier.sellerInfo?.openTime || '';
    
    logSucesso(`✅ Parse completo do produto ${productId}`);
    return detalhes;
    
  } catch (err) {
    logErro(`Erro ao fazer parse do JSON: ${err.message}`);
    return { vendedor: '', peso: '', frete: '', reviews: 0, rating: 0, vendas: 0 };
  }
}

export async function filterAndAppendProduct(produto, lista, categoria, pagina, browser) {
  try {
    const detalhes = await extractProductDetails(browser, produto);
    const produtoCompleto = { ...produto, ...detalhes };

    const aprovadoQuant = applyQuantitativeFilter(produtoCompleto);
    const aprovadoQuali = applyQualitativeFilter(produtoCompleto);
    const risco = assessRisk(produtoCompleto);

    const aprovadoFinal = aprovadoQuant && aprovadoQuali;

    const itemFinal = {
      ...produtoCompleto,
      aprovadoQuant,
      aprovadoQuali,
      risco,
      aprovado: aprovadoFinal
    };

    lista.push(itemFinal);

    if (aprovadoFinal) {
      logSucesso(`👍 Produto aprovado: ${produto.product_id}`);
    } else {
      logInfo(`⛔ Produto reprovado: ${produto.product_id}`);
    }

    // await salvarJsonProduto(itemFinal, categoria, pagina);

  } catch (err) {
    logErro(`Erro ao avaliar produto: ${err.message}`);
  }
}
