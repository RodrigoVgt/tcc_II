import { MongoClient } from 'mongodb'
import { parse } from 'json2csv'
import fs from 'fs'
import path from 'path'

// --- CONFIG VIA .env ---
const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.DB_NAME

// Entrada
const BEST_COLLECTION = "best_answers_isolated"        // forum_best_isolated.csv
const WRONG_COLLECTION = "best_answers_false"          // forum_mismatched.csv

// Saída (collections novas)
const TEST_COLLECTION = "dataset_test_mix"
const VALIDATION_COLLECTION = "dataset_validation_mix"

// --- CONSTANTES ---
const AMOSTRAS_POR_ARQUIVO = 492
const METADE_AMOSTRAS = AMOSTRAS_POR_ARQUIVO / 2

// --- FUNÇÕES ---
function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5)
}

function prepararValidos(data) {
  return shuffle(
    data
      .filter(r => r.best_answer && r.question)
      .map(r => ({
        question: r.question.trim(),
        answer: r.best_answer.trim(),
        is_valid: "Sim"
      }))
  )
}

function prepararInvalidos(data) {
  return shuffle(
    data
      .filter(r => r.wrong_answer && r.question)
      .map(r => ({
        question: r.question.trim(),
        answer: r.wrong_answer.trim(),
        is_valid: "Não"
      }))
  )
}

async function main() {
  const client = new MongoClient(MONGO_URI)
  await client.connect()

  const db = client.db(DB_NAME)
  const bestCol = db.collection(BEST_COLLECTION)
  const wrongCol = db.collection(WRONG_COLLECTION)
  const testCol = db.collection(TEST_COLLECTION)
  const validationCol = db.collection(VALIDATION_COLLECTION)

  // lê do mongo
  const bestData = await bestCol.find({}).toArray()
  const wrongData = await wrongCol.find({}).toArray()

  let valid = prepararValidos(bestData)
  let invalid = prepararInvalidos(wrongData)

  if (valid.length < AMOSTRAS_POR_ARQUIVO || invalid.length < AMOSTRAS_POR_ARQUIVO) {
    console.error("❌ Quantidade insuficiente de amostras.")
    await client.close()
    return
  }

  const validTest = valid.slice(0, METADE_AMOSTRAS)
  const invalidTest = invalid.slice(0, METADE_AMOSTRAS)

  const validValidation = valid.slice(METADE_AMOSTRAS, AMOSTRAS_POR_ARQUIVO)
  const invalidValidation = invalid.slice(METADE_AMOSTRAS, AMOSTRAS_POR_ARQUIVO)

  const testCombined = shuffle([...validTest, ...invalidTest])
  const validationCombined = shuffle([...validValidation, ...invalidValidation])

  await testCol.deleteMany({})
  await validationCol.deleteMany({})

  await testCol.insertMany(testCombined)
  await validationCol.insertMany(validationCombined)

  console.log(`✅ Test Dataset salvo em: ${TEST_COLLECTION} (${testCombined.length} pares)`)  
  console.log(`✅ Validation Dataset salvo em: ${VALIDATION_COLLECTION} (${validationCombined.length} pares)`) 

  await client.close()
}

main().catch(console.error)
