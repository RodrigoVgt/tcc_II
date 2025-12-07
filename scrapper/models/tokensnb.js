const mongoose = require('../database/db');

const TokensNBModelSchema = new mongoose.Schema({
    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'questions',
        required: false,
    },
    token: {
        type: [Number]
    }
});

const TokensNBModel = mongoose.model ('tokens_nb', TokensNBModelSchema);

module.exports = TokensNBModel;