import { MongoClient } from 'mongodb'
import natural from 'natural'
const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.DB_NAME

const INPUT_COLLECTION = 'best_answers_filtered'
const OUTPUT_COLLECTION = 'best_answers_false'

// --- SIMILARIDADE TF-IDF COM NATURAL ---
function computeSimilarity(a, b) {
  const tfidf = new natural.TfIdf()
  tfidf.addDocument(a)
  tfidf.addDocument(b)

  let score = 0
  tfidf.tfidfs(a, (i, measure) => {
    if (i === 1) score = measure
  })

  return score
}

function generateMismatchedWithSimilarity(valid, limit = 492) {
  const mismatched = []
  const size = Math.min(valid.length, limit)

  for (let i = 0; i < size; i++) {
    const row = valid[i]
    const correct = row.best_answer
    const question = row.question

    const candidates = valid.filter(v => v.best_answer && v.best_answer !== correct)

    let bestCandidate = null
    let bestScore = -1

    for (const cand of candidates) {
      const score = computeSimilarity(correct, cand.best_answer)
      if (score > bestScore) {
        bestScore = score
        bestCandidate = cand.best_answer
      }
    }

    if (!bestCandidate) {
      const fallback = candidates[Math.floor(Math.random() * candidates.length)]
      bestCandidate = fallback?.best_answer || ''
    }

    mismatched.push({
      question,
      wrong_answer: bestCandidate,
      original_best_answer: correct
    })
  }

  return mismatched
}

async function main() {
  const client = new MongoClient(MONGO_URI)
  await client.connect()

  const db = client.db(DB_NAME)
  const inputCol = db.collection(INPUT_COLLECTION)
  const outputCol = db.collection(OUTPUT_COLLECTION)

  const data = await inputCol.find({}).toArray()
  const valid = data.filter(row => row.best_answer && row.question)

  const mismatched = generateMismatchedWithSimilarity(valid, 492)

  await outputCol.deleteMany({})
  await outputCol.insertMany(mismatched)

  await client.close()
}

main().catch(console.error)
