const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const shopeeProductSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: Number,
  discount: Number,
  rating: Number,
  sold: Number,
  shopId: String,
  shopName: String,
  category: String,
  location: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  historicalData: [{
    date: Date,
    price: Number,
    sold: Number,
    rating: Number
  }]
});

shopeeProductSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ShopeeProduct', shopeeProductSchema);