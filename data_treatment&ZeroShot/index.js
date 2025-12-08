import { analyzeResults } from './functions/analizer.js'

const modelName = "assistant"
const inputFile = "./files/assistant_test_validated.csv"
const name = "test Gpt"

await analyzeResults(inputFile, modelName, name)

