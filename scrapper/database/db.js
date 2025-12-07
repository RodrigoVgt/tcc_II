const mongoose = require('mongoose');
require ('dotenv').config()

let dbConnection = process.env.DB_CONNECTION;
mongoose.Promise = global.Promise;
mongoose.connect(dbConnection, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true , useFindAndModify: false });

mongoose.connection.on('connected', () => {
  console.log('Conectado ao DB ')
})
mongoose.connection.on('error', (error) => {
  console.error.bind(console.error, 'Connection Error:')
  mongoose.disconnect()
});

module.exports = mongoose;