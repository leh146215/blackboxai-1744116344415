const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ status: 'API is working', timestamp: new Date() });
});
const cheerio = require('cheerio');
const ShopeeProduct = require('../models/shopeeProduct');
const _ = require('lodash');
const moment = require('moment');

// Scrape Shopee product data
router.get('/scrape', async (req, res) => {
  let browser;
  try {
    const { keyword, limit = 10 } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    try {
      await page.goto(`https://shopee.vn/search?keyword=${encodeURIComponent(keyword)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Check for CAPTCHA
      const isCaptcha = await page.$('div.captcha');
      if (isCaptcha) {
        throw new Error('CAPTCHA detected - cannot proceed with scraping');
      }

      // Wait for product listings to load
      await page.waitForSelector('div[data-sqe="item"]', { timeout: 15000 });

      const content = await page.content();
      const $ = cheerio.load(content);

      const products = [];
      $('div[data-sqe="item"]').slice(0, limit).each((i, el) => {
        const product = {
          productId: $(el).attr('data-sku'),
          name: $(el).find('div[data-sqe="name"]').text().trim(),
          price: parseFloat($(el).find('div[data-sqe="price"]').text().replace(/[^\d]/g, '')),
          originalPrice: parseFloat($(el).find('div[data-sqe="original-price"]').text().replace(/[^\d]/g, '')) || null,
          rating: parseFloat($(el).find('div.shopee-rating-stars__stars').attr('style')?.match(/\d+/)?.[0] || 0) / 20,
          sold: parseInt($(el).find('div[data-sqe="sold"]').text().replace(/[^\d]/g, '')) || 0,
          shopName: $(el).find('div[data-sqe="shop"]').text().trim(),
          category: keyword
        };

        if (product.productId && product.name) {
          products.push(product);
        }
      });

      // Save products to database
      const savedProducts = await Promise.all(products.map(async product => {
        const existing = await ShopeeProduct.findOne({ productId: product.productId });
        if (existing) {
          // Update historical data
          existing.historicalData.push({
            date: new Date(),
            price: product.price,
            sold: product.sold,
            rating: product.rating
          });
          return existing.save();
        } else {
          product.historicalData = [{
            date: new Date(),
            price: product.price,
            sold: product.sold,
            rating: product.rating
          }];
          return ShopeeProduct.create(product);
        }
      }));

      res.json(savedProducts);
    } catch (err) {
      console.error('Scraping error:', err);
      res.status(500).json({ error: 'Scraping failed', details: err.message });
    } finally {
      if (browser) {
        await browser.close();
      }
    }

  } catch (err) {
    console.error('Scraping error:', err);
    res.status(500).json({ error: 'Scraping failed', details: err.message });
  }
});

// Get product analysis
router.get('/analysis', async (req, res) => {
  try {
    const { category, days = 30 } = req.query;
    const dateThreshold = moment().subtract(days, 'days').toDate();

    const match = {};
    if (category) match.category = category;

    const products = await ShopeeProduct.aggregate([
      { $match: match },
      { 
        $project: {
          name: 1,
          price: 1,
          rating: 1,
          sold: 1,
          shopName: 1,
          latestData: { $arrayElemAt: ["$historicalData", -1] },
          firstData: { $arrayElemAt: ["$historicalData", 0] }
        }
      },
      {
        $addFields: {
          priceChange: { $subtract: ["$latestData.price", "$firstData.price"] },
          salesChange: { $subtract: ["$latestData.sold", "$firstData.sold"] },
          priceTrend: {
            $cond: [
              { $gt: ["$latestData.price", "$firstData.price"] },
              "increasing",
              { $cond: [
                { $lt: ["$latestData.price", "$firstData.price"] },
                "decreasing",
                "stable"
              ]}
            ]
          }
        }
      },
      { $sort: { salesChange: -1 } }
    ]);

    res.json(products);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

module.exports = router;