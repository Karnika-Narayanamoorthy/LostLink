require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Make first user admin OR create one if none exists
  let admin = await User.findOne({ email: 'admin@kpriet.ac.in' });
  if (admin) {
    admin.role = 'admin';
    await admin.save();
    console.log('Existing user promoted to admin:', admin.email);
  } else {
    admin = await User.create({
      name: 'LostLink Admin',
      email: 'admin@kpriet.ac.in',
      password: 'admin1234',
      role: 'admin',
      section: 'Admin'
    });
    console.log('Admin created:', admin.email, '/ password: admin1234');
  }
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
