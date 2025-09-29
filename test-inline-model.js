require('dotenv').config();
const mongoose = require('mongoose');

async function testInlineModel() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create model inline
    const testSchema = new mongoose.Schema({
      name: String,
      date: { type: Date, default: Date.now }
    });
    
    const TestModel = mongoose.model('TestChat', testSchema);
    
    console.log('TestModel:', TestModel.modelName);
    console.log('TestModel find:', typeof TestModel.find);
    console.log('TestModel findOne:', typeof TestModel.findOne);
    
    if (typeof TestModel.find === 'function') {
      console.log('🎉 Inline model works!');
      
      // Now test if we can use it
      const result = await TestModel.find({});
      console.log('Query result:', result.length, 'documents');
      console.log('✅ Model is fully functional!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testInlineModel();
