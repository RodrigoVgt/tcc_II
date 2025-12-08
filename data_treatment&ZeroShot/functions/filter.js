import { MongoClient } from 'mongodb'
import path from 'path'
import fs from 'fs'

// --- CONFIGURACAO ---
// Entrada: collection existente no Mongo
// Saída: collection de destino no Mongo

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.DB_NAME
const INPUT_COLLECTION = 'best_answers_raw'
const OUTPUT_COLLECTION = 'best_answers_filtered'

// Caso ainda queira permitir rodar com arquivo local
const fallbackInput = path.resolve('./best_answers.json')

const complementPatterns = [
  /@[\wÀ-ÿ]+/i,
  /como\s+disse\s+o\s+colega/i,
  /complementando/i,
  /a\s+resposta\s+do\s+/i,
  /conforme\s+o\s+colega/i,
  /o\s+amigo\s+/i,
  /a\s+dica\s+do/i,
  /citado\s+pelo/i,
  /mencionado\s+por/i,
  /obrigad[oa]\s+(aos|pelas|aos\s+colegas|a\s+todos)/i,
  /agradec[oa]\s+(a\s+todos|pelas\s+dicas|pelas\s+respostas|ao\s+grupo)/i,
  /seguindo\s+(as|os)\s+(orientações|dicas|comentários)/i,
  /basead[oa]\s+no\s+que\s+foi\s+dito/i,
  /após\s+as\s+sugestões/i,
  /com\s+ajuda\s+dos\s+colegas/i,
  /graças\s+às\s+dicas/i,
  /valeu\s+(pessoal|pelas\s+dicas|a\s+todos)/i
]

const isComplementary = txt => txt && complementPatterns.some(r => r.test(txt))

async function main() {
  const client = new MongoClient(MONGO_URI)
  await client.connect()
  const db = client.db(DB_NAME)

  const inputCol = db.collection(INPUT_COLLECTION)
  const outputCol = db.collection(OUTPUT_COLLECTION)

  let data = []
  try {
    data = await inputCol.find({}).toArray()
  } catch (e) {
    if (fs.existsSync(fallbackInput)) {
      const raw = fs.readFileSync(fallbackInput, 'utf8')
      data = JSON.parse(raw)
    } else {
      console.error('Nenhuma entrada encontrada.')
      await client.close()
      return
    }
  }

  const rows = data.map(item => {
    const question = item.question?.replace(/\s+/g, ' ').trim() || ''
    const date = item.date?.$date || ''
    const answers = item.answers || []

    const best = answers.find(a => a.best_answer)?.answer?.trim() || ''
    const best_is_complement = isComplementary(best)

    const others = answers
      .filter(a => !a.best_answer)
      .map((a, i) => ({ [`answer_${i + 1}`]: a.answer?.replace(/\s+/g, ' ').trim() || '' }))

    const combined = Object.assign({}, ...others)

    return {
      question,
      best_answer: best,
      best_is_complement,
      ...combined,
      date
    }
  })

  const separated = rows.filter(r => !r.best_is_complement)

  await outputCol.deleteMany({})
  await outputCol.insertMany(separated)

  console.log("Feito")
  await client.close()
}

main().catch(console.error)