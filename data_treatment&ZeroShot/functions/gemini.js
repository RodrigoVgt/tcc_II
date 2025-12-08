const Gemini = () => {}

import Prompts from './prompts.js'
import { GoogleGenerativeAI  } from "@google/generative-ai"
import dotenv from "dotenv"
dotenv.config({ path: "../.env" })

//VALIDA COM O GEMINI

const GEMINI_API_KEY = process.env.GEMINI_API_KEY 
const GEMINI_MODEL = 'gemini-2.5-flash-lite'

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

if (!GEMINI_API_KEY) {
  console.error('❌ GOOGLE_API_KEY não definido no ambiente!')
  process.exit(1)
}

Gemini.validateWithGemini = async function(question, answer) {
    try {
        const content = `${Prompts.getGeminiPrompt()}\n\nPergunta:\n${question}\n\nResposta:\n${answer}`

        const result = await model.generateContent(content)
        if(!result || !result.response) return { value: 'Indefinido', processed: false  }
        const text = result?.response?.text()?.trim() || ''

        if (/^sim\b/i.test(text)) return { value: 'Sim', processed: true  }
        if (/^não\b/i.test(text) || /^nao\b/i.test(text)) return { value: 'Não', processed: true  }

        return { value: 'Indefinido', processed: true  }
    } catch (error) {
        console.error('Erro ao consultar Gemini:', error.message)
        return { value: 'Erro', processed: false }
    }
}

export default Gemini