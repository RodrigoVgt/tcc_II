const gptPrompt = "Você deve avaliar as respostas fornecidas para ver se são corretas para as perguntas fornecidas. Se sim responda somente com 'Sim', caso contrário responda com 'Não'."

const geminiPrompt = `
Você é um avaliador de perguntas e respostas.
Sua tarefa é determinar se a resposta apresentada é válida para a pergunta.

Responda estritamente com uma única palavra:
"Sim" — se a resposta for correta, coerente e relevante à pergunta.
"Não" — se a resposta for incorreta, irrelevante ou fora de contexto.
`


function getGptPrompt() {
    return gptPrompt
}

function getGeminiPrompt() {
    return geminiPrompt
}   

export default { getGptPrompt, getGeminiPrompt }