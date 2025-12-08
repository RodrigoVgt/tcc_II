ARQUIVOS DE TESTE TCC II

necessário rodar 
```
npm intall

```

ordem de execução:
(todos os passos a seguir assumem que o banco já vai estar conectado e configurado)
Considerando que já tenha os arquivos com as melhores respostas em um banco de dados Mongo

1 - Rodar filter.js, para fazer a filtragem e deixar somente as best_answer sem dependencia
2 - Rodar create_false. Com isso, se tem a base de falsas e verdadeiras
3 - Rodar mix. Isso é feito para gerar uma base mix de teste e uma base mix de validação. Pode ser feita quantes vezes for necessário
4 - Rodar test. Nessa etapa, é necessário informar o modelo que está sendo testado, posi vai salvar os resultados nessa determinada base
5 - rodar index pra gerar as análises de resultado