import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
import GPT from './gpt.js'
import Gemini from './gemini.js'

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.DB_NAME

export async function validateAnswer(question, answer, model = 'gpt') {
  switch (model) {
    case 'gpt':
      return await GPT.validateWithGpt(question, answer)
    case 'assistant':
      return await GPT.validateWithAssistant(question, answer)
    case 'gemini':
      return await Gemini.validateWithGemini(question, answer)
  }
}

export async function runValidation(inputCollection, outputCollection, modelName) {
  const client = new MongoClient(MONGO_URI)
  await client.connect()
  const db = client.db(DB_NAME)

  const inputCol = db.collection(inputCollection)
  const outputCol = db.collection(outputCollection)

  const data = await inputCol.find({}).toArray()
  let processedCount = 0
  const maxRequests = 5000

  for (const row of data) {
    const { question, answer } = row
    const alreadyProcessed = row.processed === true
    if (alreadyProcessed) continue

    if (processedCount >= maxRequests) break

    const response = await validateAnswer(question, answer, modelName)
    row[modelName] = response.value
    row.processed = response.processed

    if (modelName === 'gemini')
      await new Promise(r => setTimeout(r, 5000))

    processedCount++

    if (processedCount % 20 === 0) {
      await outputCol.deleteMany({})
      await outputCol.insertMany(data)
    }
  }

  await outputCol.deleteMany({})
  await outputCol.insertMany(data)

  await client.close()
}