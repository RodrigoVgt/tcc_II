const Gpt = () => {}

import dotenv from "dotenv"
dotenv.config({ path: "../.env" })
import prompts from './prompts.js'
import OpenAI from "openai"


const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY 
})

//VALIDA COM O GPT

Gpt.validateWithGpt = async function(question, answer) {
  try {
    const directResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompts.getGptPrompt() },
        { role: "user", content: `Pergunta: ${question}\nResposta: ${answer}` }
      ]
    })

    return {value: directResponse.choices[0].message.content, processed: true}
  } catch (error) {
    console.error("Erro ao validar resposta:", error)
    return null
  }
}

export default Gpt
