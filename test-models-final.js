require('dotenv').config();
const mongoose = require('mongoose');

async function testModels() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Import models after connection
    const Chat = require('./src/models/Chat');
    const Message = require('./src/models/Message');

    console.log('Chat model:', Chat.modelName);
    console.log('Chat find function:', typeof Chat.find);
    console.log('Chat findOne function:', typeof Chat.findOne);
    
    console.log('Message model:', Message.modelName);
    console.log('Message find function:', typeof Message.find);
    
    if (typeof Chat.find === 'function' && typeof Message.find === 'function') {
      console.log('🎉 ALL MODELS WORKING CORRECTLY!');
    } else {
      console.log('❌ Models not working properly');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testModels();
