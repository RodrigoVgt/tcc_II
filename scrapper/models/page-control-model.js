const mongoose = require('../database/db');

const PageControlSchema = new mongoose.Schema({
  last_page:{
    type: Number,
    required: true,
  },
  current:{
    type: Boolean,
    default: false
  }
});

const PageControl = mongoose.model ('page_control', PageControlSchema);

module.exports = PageControl;