import os
import time
import chromadb
from openai import OpenAI
from pymongo import MongoClient
from datetime import datetime
import yaml

# ==================== CONFIG ====================
CONFIG = "../config.yaml"

def load_config():
    with open(CONFIG, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

cfg = load_config()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

if not OPENAI_API_KEY:
    raise ValueError("❌ Falta definir OPENAI_API_KEY")
if not MONGO_URI or not DB_NAME:
    raise ValueError("❌ Defina MONGO_URI e DB_NAME no .env")

client_openai = OpenAI(api_key=OPENAI_API_KEY)


EMBED_MODEL = cfg["embedding"]["model"] 
MODEL_LLM = "gpt-4o-mini"                 
CONTEXT_RESULTS = 3             # Trechos buscados no manual

mongo = MongoClient(MONGO_URI)
db = mongo[DB_NAME]
mongo_test = db["dataset_test_mix"]
mongo_results = db["manual_rag_validation_gpt"]

manuals_chroma = chromadb.PersistentClient(path=cfg["paths"]["manuals_db"])
manuals_collection = manuals_chroma.get_or_create_collection(cfg["collections"]["manuals"])

def validate_answer_with_model(question, answer, contexts):
    context_text = "\n---\n".join(contexts)

    prompt = f"""
Você é um avaliador técnico automotivo.
Se utilizando do contexto abaixo, verifique se a resposta dada é válida para a pergunta.

### Manual (contexto):
{context_text}

### Pergunta:
{question}

### Resposta analisada:
{answer}

### Sua tarefa:
Responda SOMENTE com:
- "Sim" → se a resposta é válida
- "Não" → se a resposta NÃO é válida
"""

    try:
        resp = client_openai.responses.create(
            model=MODEL_LLM,
            input=prompt,
            temperature=0
        )
        text = resp.output_text.strip().lower()

        if text.startswith("sim"):
            return "Sim"
        if text.startswith("não") or text.startswith("nao"):
            return "Não"
        return "Indefinido"

    except Exception as e:
        print("Erro ao validar resposta:", e)
        return "Erro"

# ==================== MAIN PIPELINE ====================
def process_test_mix():
    cursor = mongo_test.find()

    print("\n=== Iniciando validação com GPT + manuais técnicos ===")

    for row in cursor:
        question = row.get("question", "")
        answer = row.get("answer", "")
        expected = row.get("is_valid", "Não")

        if mongo_results.find_one({"question": question, "answer": answer}):
            print("Já existe no banco. Pulando.")
            continue

        emb = client_openai.embeddings.create(
            model=EMBED_MODEL,
            input=question
        ).data[0].embedding

        result = manuals_collection.query(
            query_embeddings=[emb],
            n_results=CONTEXT_RESULTS
        )

        contexts = result.get("documents", [[]])[0]

        if not contexts:
            print("Nenhum contexto encontrado nos manuais.")
            predicted = "Indefinido"
        else:
            predicted = validate_answer_with_model(question, answer, contexts)

        record = {
            "question": question,
            "answer": answer,
            "is_valid_expected": expected,
            "is_valid_predicted": predicted,
            "manual_context": contexts,
            "embedding_used": "openai",
            "model_used": MODEL_LLM,
            "timestamp": datetime.utcnow()
        }

        mongo_results.insert_one(record)
        print("Registro salvo.")

    print("\nPipeline completo!")


if __name__ == "__main__":
    process_test_mix()