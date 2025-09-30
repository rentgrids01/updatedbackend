const mongoose = require('mongoose');

console.log('Creating simple schema...');

const testSchema = new mongoose.Schema({
  name: String,
  date: { type: Date, default: Date.now }
});

console.log('Schema created:', testSchema);

const TestModel = mongoose.model('Test', testSchema);

console.log('Model created:', TestModel);
console.log('Model find method:', typeof TestModel.find);

module.exports = TestModel;
