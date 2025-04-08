const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_4eC39HqLyjWDarjtT1zdp7dc');
const User = require('../models/user');
const Transaction = require('../models/transaction');
const router = express.Router();

// Tạo phiên thanh toán
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { plan, userId } = req.body;
    
    // Xác định giá theo gói
    let price;
    switch(plan) {
      case 'basic':
        price = 99000;
        break;
      case 'premium':
        price = 299000;
        break;
      case 'vip':
        price = 599000;
        break;
      default:
        return res.status(400).json({ message: 'Gói không hợp lệ' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'vnd',
          product_data: {
            name: `Gói ${plan}`,
          },
          unit_amount: price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/thanh-toan-thanh-cong?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/thanh-toan-that-bai`,
      metadata: { userId, plan }
    });

    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Webhook xử lý kết quả thanh toán
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Xử lý sự kiện thanh toán thành công
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Cập nhật thông tin user
    await User.findByIdAndUpdate(session.metadata.userId, {
      subscription: session.metadata.plan
    });

    // Tạo bản ghi giao dịch
    await Transaction.create({
      user: session.metadata.userId,
      amount: session.amount_total / 100,
      type: 'subscription',
      status: 'completed',
      description: `Thanh toán gói ${session.metadata.plan}`,
      reference: session.id,
      completedAt: new Date()
    });
  }

  res.json({ received: true });
});

module.exports = router;