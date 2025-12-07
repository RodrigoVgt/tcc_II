const express = require('express');
const cors = require("cors");

const app = express();

const Scrapper = require('./controllers/scrapper');
const TokenGenerator = require('./controllers/tokenGenerator')
const MilvusController = require('./controllers/milvusController')

const QuestionsModel = require('./models/questions')
const Tokens = require('./models/tokens')
const TokensNB = require('./models/tokensnb')


const PORT = process.env.PORT || 3000;

app.use(cors())
app.use(express.json());

app.get('/teste', async (req, res) => {
    try {
        const result = await Scrapper.run(355)
        return result.status(200).send(result)
    } catch (err) {
        return res.status(500).send(err)
    }
})

schedule.scheduleJob('*/2 * * * *', async () => {
    try {
        const page = await PageControll.findOne({current: true})
        const result = await Scrapper.run(page.last_page)
        await PageControll.updateOne({_id: page._id}, {$set: {last_page: result}})
        return console.log("Roudou até a página: " + result)
    } catch (err) {
        console.error(err)
        return console.log('Erro interno: ', err.message)
    }
})

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});