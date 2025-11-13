import express, { Application, Request, Response } from 'express';
import { join } from 'node:path';
import favicon from 'serve-favicon';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import cors from 'cors';

import { DataClient } from './cosmos'
import { NewProductInput } from './types';

import 'dotenv/config'

const app: Application = express();

// ============================================
// MIDDLEWARE
// ============================================

// CORS - permite peticiones desde cualquier origen
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Rate limiting
const limiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api', limiter);

// Favicon
app.use(favicon(join(__dirname, 'static', 'favicon.ico')));

// Static files
app.use(express.static(join(__dirname, 'static')));

// ============================================
// INSTANCIA DE COSMOS DB CLIENT
// ============================================

const dataClient = new DataClient();

// ============================================
// FRONTEND ROUTES
// ============================================

// Sirve el frontend
app.get('/', (_: Request, res: Response) => {
  res.sendFile(join(__dirname, 'static', 'index.html'));
});

// ============================================
// REST API ENDPOINTS
// ============================================

// GET /api/products - Lista todos los productos
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    console.log('GET /api/products');
    const products = await dataClient.listAllProducts();
    res.json(products);
  } catch (error: any) {
    console.error('Error listing products:', error);
    res.status(500).json({
      error: 'Error loading products',
      message: error.message
    });
  }
});

// POST /api/products - Crea un nuevo producto
app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const productData: NewProductInput = req.body;
    console.log('POST /api/products:', productData);

    // Validación básica
    if (!productData.name || !productData.category) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Name and category are required'
      });
    }

    const newProduct = await dataClient.createProduct(productData);
    res.status(201).json(newProduct);
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({
      error: 'Error creating product',
      message: error.message
    });
  }
});

// DELETE /api/products/:id - Elimina un producto
app.delete('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { category } = req.query;

    console.log('DELETE /api/products:', { id, category });

    if (!category || typeof category !== 'string') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Category query parameter is required'
      });
    }

    await dataClient.deleteProduct(id, category);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      error: 'Error deleting product',
      message: error.message
    });
  }
});

// GET /api/products/category/:category - Busca productos por categoría
app.get('/api/products/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    console.log('GET /api/products/category:', category);

    const products = await dataClient.getProductsByCategory(category);
    res.json(products);
  } catch (error: any) {
    console.error('Error getting products by category:', error);
    res.status(500).json({
      error: 'Error loading products',
      message: error.message
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (_: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// 404 HANDLER
// ============================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// ============================================
// START SERVER
// ============================================

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Azure Cosmos DB REST API Server                         ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server running on: http://localhost:${port}
📱 Frontend:          http://localhost:${port}

📡 API Endpoints:
   GET    /api/health
   GET    /api/products
   POST   /api/products
   DELETE /api/products/:id?category=xxx
   GET    /api/products/category/:category

🔐 Authentication: Azure AD (DefaultAzureCredential)
   Make sure you ran: az login

Press Ctrl+C to stop
  `);
});
