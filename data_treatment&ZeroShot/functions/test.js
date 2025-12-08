import { runValidation } from './validate.js'

const input = 'dataset_test_mix'
const output = 'zero_shot_gemini'
const model = 'gemini'

await runValidation(input, output, model)