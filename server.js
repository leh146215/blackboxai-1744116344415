const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Kết nối database
mongoose.connect(process.env.DB_URI || 'mongodb://localhost:27017/kiemtienquocdan', { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(() => console.log('Đã kết nối MongoDB thành công'))
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/shopee', require('./routes/shopee'));

// Khởi động server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));

// Xử lý lỗi 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Xử lý lỗi 500
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Đã xảy ra lỗi hệ thống!');
});

module.exports = app;