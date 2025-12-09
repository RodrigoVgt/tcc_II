import os
import time
import chromadb
from openai import OpenAI
from pymongo import MongoClient
from datetime import datetime
import hashlib
import yaml
import google.generativeai as genai

# ---------------- CONFIG ----------------
CONFIG = "../config.yaml"

def load_config():
    with open(CONFIG, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

cfg = load_config()

# ---------------- API KEYS ----------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

if not GEMINI_API_KEY:
    raise ValueError("Defina GEMINI_API_KEY no ambiente")
if not OPENAI_API_KEY:
    raise ValueError("Defina OPENAI_API_KEY no ambiente")
if not MONGO_URI or not DB_NAME:
    raise ValueError("Defina MONGO_URI e DB_NAME no .env")

# ---------------- MODELS ----------------
EMBED_MODEL = cfg["embedding"]["model"]  # OpenAI embeddings
MODEL_NAME = "gemini-2.5-flash-lite"       # Modelo avaliador
DELAY_SECONDS = 15
PROMPT_TEMPLATE = """
Você é um avaliador de perguntas e respostas automotivas.
Receba a pergunta original, sua resposta e um contexto com outras perguntas semelhantes.

Analise se a resposta da pergunta original está correta e coerente com o contexto.
Responda APENAS com uma palavra:
"Sim" — se a resposta é válida e coerente.
"Não" — se a resposta é incorreta ou não faz sentido.
"""

chroma_client = chromadb.PersistentClient(path=cfg["paths"]["chroma_db"])
chroma_collection = chroma_client.get_or_create_collection(name=cfg["collections"]["questions"])

openai_client = OpenAI(api_key=OPENAI_API_KEY)
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel(MODEL_NAME)

mongo = MongoClient(MONGO_URI)
db = mongo[DB_NAME]
mongo_validation = db["dataset_validation_mix"]
mongo_test = db["dataset_test_mix"]
mongo_results = db["gemini_questions_evaluation_results"]

def make_hash_key(question, answer):
    base = f"{question.strip()}||{answer.strip()}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def get_similar_context(question, top_k=3):
    """Busca perguntas semelhantes usando embeddings OpenAI (padronizado no pipeline)."""
    emb = openai_client.embeddings.create(
        model=EMBED_MODEL,
        input=question
    ).data[0].embedding

    results = chroma_collection.query(query_embeddings=[emb], n_results=top_k)

    context_entries = []
    ids = results.get("ids", [[]])[0]

    for doc_id in ids:
        entry = mongo_validation.find_one({"_id": doc_id})
        if entry:
            context_entries.append({
                "question": entry.get("question", ""),
                "answer": entry.get("answer", ""),
                "is_valid": entry.get("is_valid", "")
            })

    return context_entries


def ask_gemini(question, answer, context):
    context_text = "\n\n".join([
        f"Pergunta similar: {c['question']}\nResposta: {c['answer']}\nVálida: {c['is_valid']}"
        for c in context
    ])

    full_prompt = (
        f"{PROMPT_TEMPLATE}\n\n"
        f"Pergunta original:\n{question}\n"
        f"Resposta:\n{answer}\n\n"
        f"Contexto de perguntas semelhantes:\n{context_text}\n\n"
        f"Responda agora:"
    )

    try:
        response = gemini_model.generate_content(full_prompt)
        text = response.text.strip().lower()
        if text.startswith("sim"):
            return "Sim"
        if text.startswith("não") or text.startswith("nao"):
            return "Não"
        return "Indefinido"
    except Exception as e:
        print(f"⚠️ Erro ao consultar Gemini: {e}")
        return "Erro"


# ---------------- EXECUTION ----------------
def evaluate_model(limit=500):
    processed = {
        doc.get("hash_key")
        for doc in mongo_results.find({MODEL_NAME: {"$exists": True}}, {"hash_key": 1})
        if doc.get("hash_key")
    }

    cursor = mongo_test.find().limit(limit)

    for test_doc in cursor:
        question = test_doc.get("question", "")
        answer = test_doc.get("answer", "")
        expected = test_doc.get("is_valid", "Não")

        hash_key = make_hash_key(question, answer)
        if hash_key in processed:
            print(f"⏭️  Já avaliado: {question[:60]}...")
            continue

        print(f"Avaliando ({MODEL_NAME}): {question[:80]}...")
        context = get_similar_context(question)
        model_answer = ask_gemini(question, answer, context)
        match = "Correto" if model_answer == expected else "Incorreto"

        mongo_results.update_one(
            {"hash_key": hash_key},
            {
                "$set": {
                    "question": question,
                    "answer": answer,
                    "expected_is_valid": expected,
                    MODEL_NAME: model_answer,
                    f"match_{MODEL_NAME}": match,
                    "timestamp": datetime.now().isoformat(),
                }
            },
            upsert=True
        )
        
        print(f" Aguardando {DELAY_SECONDS}s...")
        time.sleep(DELAY_SECONDS)

    print("concluído")


if __name__ == "__main__":
    evaluate_model(limit=500)