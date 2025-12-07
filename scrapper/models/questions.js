const mongoose = require('../database/db');

const QuestionsModelSchema = new mongoose.Schema({
  type:{
    type: String,
    required: true,
  },
  title:{
    type: String,
    required: true,
  },
  question:{
    type: String,
  },
  answers: {
    type: Array,
    default: []
  },
  date: {
    type: Date,
    default: new Date()
  },
  user_name: {
    type: String,
    default: "Anonymous"
  },
  best_answer: {
    type: Boolean,
    default: false
  },
  closed: {
    type: Boolean,
    default: false
  },
  has_image: {
    type: Boolean,
    default: false
  },
  page: {
    type: Number
  },
  tokenized: {
    type: Boolean,
    default: false
  }
});

const QuestionsModel = mongoose.model ('questions', QuestionsModelSchema);

module.exports = QuestionsModel;