const QuestionsModel = require('../models/questions')
const puppeteer = require('puppeteer')

const Scrapper = () => {}

Scrapper.run = async function (pageNumber) {
    const browser = await puppeteer.launch({args: ['--no-sandbox'], headless: false});
    try {
        let created = 0
        let error = 0
        let pageError = 0
        const questionObj = []
        const page = await browser.newPage();

        for(let i = 0; i < 5; i++){
            if(i + parseInt(pageNumber) > 4255) return
            try {
                const searchPage = `https://oficinabrasil.com.br/forum?page=${i + parseInt(pageNumber)}`//&menu=closed
                page.goto(searchPage, { waitUntil: 'load' })

                await page.waitForNavigation({ waitUntil: 'networkidle0' })

                const currentQuestions = await page.$x('/html/body/div[3]/div/div[2]/div[2]/div[2]/div/div[2]/div/div')

                for(const iterator of currentQuestions){
                    try{
                        const type = await this.getType(iterator)
                        const title = await this.getTitle(iterator)
                        const date = await this.getDate(iterator)
                        const user_name = await this.getUserName(iterator)
                        const has_image = await this.getHasImage(iterator)
                        const internalData = await this.getInternalData(iterator, page, browser)
                        const answers = internalData.answers
                        const best_answer = internalData.best_answer
                        const closed = internalData.closed
                        const question = internalData.question
                        const pgNumber = (i + parseInt(pageNumber))
                        if(!question || !type || !title) {
                            error++
                            continue
                        }
        
                        questionObj.push({
                            type, title, question, answers, date, user_name, best_answer, closed, has_image, pgNumber
                        })
                    } catch(e) {
                        console.log(e)
                        error++
                        continue
                    }
                }
            } catch (e) {
                pageError++
                console.log(e)
                continue
            }
        }

        for(const question of questionObj){
            const result = await this.new(question)
            if(result) created++ 
            else error++
        }

        console.log("criados: " + created, "Erros: " + error, "Erro de página: " + pageError)
        await browser.close()
        return (parseInt(pageNumber) + 5)
    } catch (e) {
        await browser.close()
        return null
    }
}

Scrapper.getType = async function(page){
    try {
        const superiorText = await page.$eval('div div div.relative.bottom-8.-mb-8.flex.justify-end', element => element.innerText)
        return superiorText ? superiorText.trim().toLowerCase() : null
    } catch (e) {
        console.log(e)
        return null
    }
}

Scrapper.getTitle = async function(page){
    try {
        const text = await page.$eval('div div a div.px-5 h1', element => element.innerText)
        return text ? text.trim().toLowerCase() : null
    } catch (e) {
        console.log(e)
        return null
    }
}

Scrapper.getQuestion = async function(page){
    try {
        const xpath = await page.$x('/html/body/div[3]/div/div[2]/div[2]/div[2]/div/div[2]/div[1]/div/div')
        let text = await xpath[0].$eval('div:nth-child(3) h2', elements => elements.innerText)
        return text && text.length > 0 ? text.trim().toLowerCase() : null
    } catch (e) {
        return null
    }
}

Scrapper.getInternalData = async function(page, fullPage, browser){
    try {
        // Métodos para trazer para abrir em uma nova página
        const redirect = await page.$('div div a')
        await fullPage.keyboard.down('Control')
        await redirect.click()
        await fullPage.keyboard.up('Control')

        await new Promise(r => setTimeout(r, 1000))

        const pages = await browser.pages()
        const newPage = pages[pages.length - 1]
        await newPage.bringToFront()

        const answers = await this.getAnswers(newPage)
        const closed = await this.getClosed(newPage)
        const question = await this. getQuestion(newPage)
        let best_answer = false

        answers.forEach((answer) => {
            if (answer.best_answer) best_answer = true
        })

        await newPage.close()
        await fullPage.bringToFront()

        return {
            answers,
            best_answer,
            closed,
            question
        }
    } catch (e) {
        console.log(e)
        return []
    }
}

Scrapper.getDate = async function(page){
    try {
        const date = await page.$eval('div div div.flex.justify-between.px-8', element => element.innerText)
        return date ? stringToDate(date) : null
    } catch (e) {
        console.log(e)
        return new Date()
    }
}

Scrapper.getUserName = async function(page){
    try {
        const name = await page.$eval('div div a div.flex.items-center.gap-3 h2', element => element.innerText)
        return name ? name.trim().toLowerCase() : null
    } catch (e) {
        console.log(e)
        return "Sem user"
    }
}

Scrapper.getAnswers = async function(page){
    try {
        const answerList = await page.$x('/html/body/div[3]/div/div[2]/div[2]/div[2]/div/div[2]/div[contains(@class, "peer")]')
        const data = []
        let userData = {}
        if(!answerList || answerList.length < 1) return data

        for (const iterator of answerList) {
            let best_answer = false
            best_answer = await iterator.evaluate((element) => {
                const imgs = Array.from(element.querySelectorAll('img')); 
                return imgs.some(img => img.src.endsWith('/forum/ganhar.svg')); 
            });

            try{
                if(best_answer){
                    const answerXPath = await iterator.$('div div div:nth-child(2) div')
                    const user = await answerXPath.$eval('div.flex.items-center.gap-5 div.font-semibold', element => element.innerText)
                    const answer = await answerXPath.$eval('div.flex.items-center.gap-5 + div', element => element.innerText)
                    const date = await answerXPath.$eval('div:nth-child(4)', element => element.innerText)
                    userData = {
                        user, date: stringToDate(date), best_answer: true, answer
                    }
                    
                } else {
                    const answerXPath = await iterator.$('div div div')
                    const user = await answerXPath.$eval('div.flex.items-center.gap-5 div.font-semibold', element => element.innerText)
                    const answer = await answerXPath.$eval('div.flex.items-center.gap-5 + div', element => element.innerText)
                    const date = await answerXPath.$eval('div:nth-child(4)', element => element.innerText)
                    userData = {
                        user, date: stringToDate(date), best_answer: false, answer
                    }
                }
            } catch (e) {
                continue
            }

            data.push(userData)
        }

        return data
    } catch (e) {  
        return []
    }
}

Scrapper.getClosed = async function(page){
    try {
        const text = await page.$eval('div.text-center.text-xl.text-white.font-semibold ', element => element.innerText)
        if(text === 'Este tópico foi Encerrado por um Administrador') return true
        return false
    } catch (e) {
        return false
    }
}

Scrapper.getHasImage = async function(page){
    try {
        const hasChildren = await page.$eval('div div a div:nth-child(4)', el => el.children.length > 0);
        return hasChildren
    } catch (e) {
        return false
    }
}

Scrapper.new = async function (question) {
    try {
        const currentData = await QuestionsModel.create({
            type: question.type,
            title: question.title,
            question: question.question,
            answers: question.answers,
            date: question.date,
            user_name: question.user_name,
            best_answer: question.best_answer,
            closed: question.closed,
            has_image: question.has_image,
            page: question.pgNumber
        })
        return currentData
    } catch (e) {
        return e.message
    }
}

function stringToDate(dateStr) {
    const parts = dateStr.split(" ");
    
    const months = {
        "janeiro": 0,
        "fevereiro": 1,
        "março": 2,
        "abril": 3,
        "maio": 4,
        "junho": 5,
        "julho": 6,
        "agosto": 7,
        "setembro": 8,
        "outubro": 9,
        "novembro": 10,
        "dezembro": 11
    };
    
    const day = parseInt(parts[0], 10)
    const month = months[parts[2].toLowerCase()]
    const year = parseInt(parts[4], 10).toString().slice(0, 4)

    return new Date(year, month, day)
}

module.exports = Scrapper