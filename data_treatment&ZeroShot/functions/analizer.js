import fs from 'fs'
import Papa from 'papaparse'

//ANALIZA O RESULTADO E GERA OS F1 e outras metricas

export function analyzeResults(inputFile, modelName, name) {
    const csvData = fs.readFileSync(inputFile, 'utf8')
    const { data } = Papa.parse(csvData, { header: true })

    const validRows = data.filter(
        r => r.is_valid && typeof r[modelName] === 'string'
    )

    const total = validRows.length

    // Matriz de confusão
    let TP = 0, TN = 0, FP = 0, FN = 0

    validRows.forEach(row => {
        const expected = row.is_valid.trim().toLowerCase()   // "sim" | "não"
        const predicted = row[modelName].trim().toLowerCase() // "sim" | "não"

        if (expected === "sim" && predicted === "sim") TP++
        else if (expected === "não" && predicted === "não") TN++
        else if (expected === "não" && predicted === "sim") FP++
        else if (expected === "sim" && predicted === "não") FN++
    })

    // Métricas
    const accuracy = (TP + TN) / total
    const precision = TP / (TP + FP || 1)
    const recall = TP / (TP + FN || 1)
    const f1 = (2 * precision * recall) / ((precision + recall) || 1)

    // Formatadores
    const pct = n => (n * 100).toFixed(2) + "%"
    const num = n => n.toString().padStart(4, " ")

    const report = `
📊 RELATÓRIO DE DESEMPENHO — ${modelName}
────────────────────────────────────────────
Total analisado: ${total}

🔢 MATRIZ DE CONFUSÃO
--------------------------------------------
                Predito SIM | Predito NÃO
Real SIM    →     ${num(TP)}       |     ${num(FN)}
Real NÃO    →     ${num(FP)}       |     ${num(TN)}

📌 MÉTRICAS
--------------------------------------------
Accuracy :  ${pct(accuracy)}
Precision:  ${pct(precision)}
Recall   :  ${pct(recall)}
F1-Score :  ${pct(f1)}

📌 VALORES ABSOLUTOS
--------------------------------------------
TP (acertou válidos)        : ${TP}
TN (acertou inválidos)      : ${TN}
FP (falso positivo)         : ${FP}
FN (falso negativo)         : ${FN}
────────────────────────────────────────────
`

    console.log(report)

    const outFile = `./reports/report_${name}.txt`
    fs.writeFileSync(outFile, report, 'utf8')
    console.log(`📁 Relatório salvo em ${outFile}`)
}
