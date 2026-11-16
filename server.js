const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

const defaultData = {
  foods: [
    {
      id: 1,
      name: 'Chicken Adobo',
      category: 'Chicken',
      description: 'Slow-simmered chicken in soy sauce, vinegar, garlic, and bay leaf, served with rice.',
      price: 100,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      images: ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'],
      available: true,
      soldCount: '0 sold',
      options: ['Regular', 'Spicy'],
      reviews: []
    },
    {
      id: 2,
      name: 'Vanilla Ice Cream',
      category: 'Desserts',
      description: 'Creamy vanilla ice cream served in a cup or a sugar cone.',
      price: 30,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500',
      images: ['https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500'],
      available: true,
      soldCount: '0 sold',
      options: ['Regular Cup', 'Sugar Cone'],
      reviews: []
    },
    {
      id: 3,
      name: 'Iced Water',
      category: 'Drinks',
      description: 'Chilled filtered water served with ice.',
      price: 20,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500',
      images: ['https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500'],
      available: true,
      soldCount: '0 sold',
      options: ['Normal Cold', 'With Extra Ice'],
      reviews: []
    }
  ],
  orders: []
};

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return defaultData;
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const db = readDB();

    if (pathname === '/api/foods') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(db.foods));
      }
      if (req.method === 'POST') {
        const newFood = JSON.parse(body);
        const nextId = db.foods.length > 0 ? Math.max(...db.foods.map(f => f.id)) + 1 : 1;
        const imagesList = Array.isArray(newFood.images) && newFood.images.length > 0
          ? newFood.images
          : (newFood.imageUrl ? [newFood.imageUrl] : []);

        const created = {
          ...newFood,
          id: nextId,
          imageUrl: newFood.imageUrl || (imagesList.length > 0 ? imagesList[0] : ''),
          images: imagesList,
          available: true,
          rating: 5.0,
          soldCount: '0 sold',
          options: newFood.options || ['Regular', 'Spicy'],
          reviews: []
        };
        db.foods.unshift(created);
        writeDB(db);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(created));
      }
    }

    if (pathname.startsWith('/api/foods/')) {
      const id = parseInt(pathname.split('/')[3], 10);
      if (req.method === 'PUT') {
        const updateData = JSON.parse(body);
        db.foods = db.foods.map(f => {
          if (f.id === id) {
            const updatedImages = updateData.images || f.images || [updateData.imageUrl || f.imageUrl];
            return {
              ...f,
              ...updateData,
              imageUrl: updateData.imageUrl || (updatedImages.length > 0 ? updatedImages[0] : f.imageUrl),
              images: updatedImages
            };
          }
          return f;
        });
        writeDB(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }
      if (req.method === 'DELETE') {
        db.foods = db.foods.filter(f => f.id !== id);
        writeDB(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }
    }

    if (pathname === '/api/reviews' && req.method === 'POST') {
      const { foodId, review } = JSON.parse(body);
      db.foods = db.foods.map(item => {
        if (item.id === foodId) {
          const revs = item.reviews || [];
          const newRevs = [review, ...revs];
          const avg = Number((newRevs.reduce((sum, r) => sum + r.rating, 0) / newRevs.length).toFixed(1));
          return { ...item, rating: avg, reviews: newRevs };
        }
        return item;
      });
      writeDB(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }

    if (pathname === '/api/orders') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(db.orders));
      }
      if (req.method === 'POST') {
        const newOrder = JSON.parse(body);
        db.orders.unshift(newOrder);
        writeDB(db);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(newOrder));
      }
    }

    if (pathname.startsWith('/api/orders/')) {
      const orderId = pathname.split('/')[3];
      if (req.method === 'PATCH') {
        const patchData = JSON.parse(body);
        db.orders = db.orders.map(o => o.id === orderId ? { ...o, ...patchData } : o);
        writeDB(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`[Shared Database Server] Running on port ${PORT}`);
  console.log(`All devices will now share the exact same data!`);
  console.log(`===============================================`);
});