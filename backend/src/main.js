const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'depanneur-demo-backend' });
});

app.get('/api/dashboard/overview', (_req, res) => {
  res.json({
    products: { total: 0, active: 0, lowStock: 0, expiringSoon: 0 },
    today: { saleCount: 0, revenue: '0.00', profit: '0.00' },
    topSellers: [],
    lowStockList: [],
  });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
