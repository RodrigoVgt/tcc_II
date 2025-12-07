const mongoose = require('../database/db');

const TokensModelSchema = new mongoose.Schema({
    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'questions',
        required: false,
    },
    token: {
        type: [Number]
    }
});

const TokensModel = mongoose.model ('tokens', TokensModelSchema);

module.exports = TokensModel;