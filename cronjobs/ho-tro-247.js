const cron = require('node-cron');
const User = require('../models/user');
const Transaction = require('../models/transaction');

// Tự động tính toán doanh thu hàng ngày lúc 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('Bắt đầu tính toán doanh thu hàng ngày...');
  
  try {
    const users = await User.find({ subscription: { $ne: null } });
    
    for (const user of users) {
      // Tính doanh thu theo gói
      let dailyEarnings;
      switch(user.subscription) {
        case 'basic':
          dailyEarnings = 10000;
          break;
        case 'premium':
          dailyEarnings = 30000;
          break;
        case 'vip':
          dailyEarnings = 60000;
          break;
      }

      // Cập nhật số dư
      await User.findByIdAndUpdate(user._id, {
        $inc: { balance: dailyEarnings }
      });

      // Ghi nhận giao dịch
      await Transaction.create({
        user: user._id,
        amount: dailyEarnings,
        type: 'deposit',
        status: 'completed',
        description: `Doanh thu hàng ngày từ gói ${user.subscription}`,
        completedAt: new Date()
      });
    }

    console.log(`Đã cập nhật doanh thu cho ${users.length} người dùng`);
  } catch (err) {
    console.error('Lỗi khi tính toán doanh thu:', err);
  }
});

// Tự động tính hoa hồng giới thiệu hàng tuần (Chủ nhật 23:59)
cron.schedule('59 23 * * 0', async () => {
  console.log('Bắt đầu tính hoa hồng giới thiệu...');
  
  try {
    const users = await User.find({ referrals: { $exists: true, $ne: [] } });
    
    for (const user of users) {
      // Tính tổng doanh thu tuần của người được giới thiệu
      const referralEarnings = await Transaction.aggregate([
        {
          $match: {
            user: { $in: user.referrals },
            type: 'deposit',
            completedAt: {
              $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      const commission = referralEarnings[0]?.total * 0.05 || 0;
      
      if (commission > 0) {
        // Cập nhật số dư
        await User.findByIdAndUpdate(user._id, {
          $inc: { balance: commission }
        });

        // Ghi nhận giao dịch
        await Transaction.create({
          user: user._id,
          amount: commission,
          type: 'referral',
          status: 'completed',
          description: `Hoa hồng giới thiệu từ ${user.referrals.length} người dùng`,
          completedAt: new Date()
        });
      }
    }

    console.log(`Đã tính hoa hồng cho ${users.length} người giới thiệu`);
  } catch (err) {
    console.error('Lỗi khi tính hoa hồng giới thiệu:', err);
  }
});

module.exports = cron;