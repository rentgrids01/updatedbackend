// Test file to check if Chat model loads properly
require('dotenv').config();
const mongoose = require('mongoose');

console.log('MongoDB URI:', process.env.MONGO_URI ? 'Found' : 'Not found');

// Connect to MongoDB first
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('Connected to MongoDB');
    
    // Now try to load the Chat model
    const Chat = require('./src/models/Chat');
    
    console.log('Chat model:', Chat);
    console.log('Chat.find function:', typeof Chat.find);
    console.log('Chat.findOne function:', typeof Chat.findOne);

    if (typeof Chat.find === 'function') {
        console.log('✅ Chat model is working correctly');
    } else {
        console.log('❌ Chat model is NOT working');
        console.log('Chat object:', Object.keys(Chat));
    }
    
    process.exit(0);
})
.catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
});
