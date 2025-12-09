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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

if not OPENAI_API_KEY:
    raise ValueError("❌ Defina OPENAI_API_KEY no ambiente!")
if not GEMINI_API_KEY:
    raise ValueError("❌ Defina GEMINI_API_KEY no ambiente!")
if not MONGO_URI or not DB_NAME:
    raise ValueError("❌ Defina MONGO_URI e DB_NAME no .env!")

# ==================== MODELS & CONSTANTS ====================
openai_client = OpenAI(api_key=OPENAI_API_KEY)

EMBED_MODEL = cfg["embedding"]["model"]
GEMINI_MODEL = "gemini-2.5-flash-lite"
DELAY_SECONDS = 15
CONTEXT_RESULTS = 3

# ==================== CONNECTIONS ====================
import google.generativeai as genai
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel(GEMINI_MODEL)

mongo = MongoClient(MONGO_URI)
db = mongo[DB_NAME]
mongo_test = db["dataset_test_mix"]
mongo_results = db["manual_rag_validation_gemini"]

# Base vetorial
chroma = chromadb.PersistentClient(path=cfg["paths"]["manuals_db"])
collection = chroma.get_or_create_collection(cfg["collections"]["manuals"])

# ==================== GEMINI VALIDATION ====================
def validate_with_gemini(question, answer, contexts):
    context_text = "\n---\n".join(contexts)

    prompt = f"""
Você é um avaliador técnico automotivo.
Se utilizando do contexto abaixo, verifique se a resposta dada é válida para a pergunta.

### Contexto extraído do manual:
{context_text}

### Pergunta:
{question}

### Resposta analisada:
{answer}

### Sua tarefa:
Responda SOMENTE com:
- "Sim" → se a resposta é válida
- "Não" → se a resposta não é válida
"""

    try:
        result = gemini_model.generate_content(prompt)
        text = result.text.strip().lower()

        if text.startswith("sim"):
            return "Sim"
        if text.startswith("não") or text.startswith("nao"):
            return "Não"
        return "Indefinido"
    except Exception as e:
        print(f"⚠️ Erro ao consultar Gemini: {e}")
        return "Erro"

# ==================== MAIN PIPELINE ====================
def process_validation():
    cursor = mongo_test.find()

    print("\n=== Iniciando validação com Gemini + manuais técnicos (MongoDB) ===")

    for row in cursor:
        question = row.get("question", "")
        answer = row.get("answer", "")
        expected = row.get("is_valid", "Não")

        print(f"\n🔎 Pergunta: {question}")

        # Prevenir duplicatas
        if mongo_results.find_one({"question": question, "answer": answer}):
            print("⏭️ Já validado anteriormente.")
            continue

        # Buscar contexto na base vetorial usando embeddings OpenAI
        emb = openai_client.embeddings.create(
            model=EMBED_MODEL,
            input=question
        ).data[0].embedding

        result = collection.query(query_embeddings=[emb], n_results=CONTEXT_RESULTS)
        contexts = result.get("documents", [[]])[0]

        if not contexts:
            print("⚠️ Nenhum contexto encontrado.")
            predicted = "Indefinido"
        else:
            predicted = validate_with_gemini(question, answer, contexts)

        print(f"➡️ Esperado:  {expected}")
        print(f"➡️ Gemini:    {predicted}")

        record = {
            "question": question,
            "answer": answer,
            "is_valid_expected": expected,
            "is_valid_predicted": predicted,
            "manual_context": contexts,
            "embedding_used": "openai",
            "model_used": GEMINI_MODEL,
            "timestamp": datetime.utcnow()
        }

        mongo_results.insert_one(record)
        print("💾 Registro salvo no MongoDB.")

        print(f"⏳ Aguardando {DELAY_SECONDS}s...")
        time.sleep(DELAY_SECONDS)

    print("\n✨ Validação concluída com sucesso!")


if __name__ == "__main__":
    process_validation()