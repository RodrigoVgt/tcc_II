import os
import time
import chromadb
from openai import OpenAI
from pymongo import MongoClient
from datetime import datetime
import hashlib
import yaml

# ---------------- CONFIG ----------------
CONFIG = "../config.yaml"

def load_config():
    with open(CONFIG, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

cfg = load_config()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("Defina OPENAI_API_KEY no ambiente")

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
if not MONGO_URI or not DB_NAME:
    raise ValueError("Defina MONGO_URI e DB_NAME no .env")

MODEL_NAME = "gpt-4o-mini"
DELAY_SECONDS = 3
PROMPT_TEMPLATE = """
Você é um avaliador de perguntas e respostas automotivas.
Receba a pergunta original, sua resposta e um contexto com outras perguntas semelhantes.

Analise se a resposta da pergunta original está correta e coerente com o contexto.
Responda APENAS com uma palavra:
"Sim" — se a resposta é válida e coerente.
"Não" — se a resposta é incorreta ou não faz sentido.
"""

# ------------ ChromaDB (mesmo usado antes) ------------
chroma_client = chromadb.PersistentClient(path=cfg["paths"]["chroma_db"])
chroma_collection = chroma_client.get_or_create_collection(name=cfg["collections"]["questions"])

client = OpenAI(api_key=OPENAI_API_KEY)

# ------------ MongoDB Collections ------------
mongo = MongoClient(MONGO_URI)
db = mongo[DB_NAME]

mongo_validation = db["dataset_validation_mix"]  # validação criada anteriormente
mongo_test = db["dataset_test_mix"]              # test dataset criado anteriormente
mongo_results = db["gpt_questions_evaluation_results"]        # resultados consolidados

# ------------ Funções auxiliares ------------
def make_hash_key(question, answer):
    base = f"{question.strip()}||{answer.strip()}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def get_similar_context(question, top_k=3):
    """Busca perguntas semelhantes usando embeddings OpenAI, como no restante do pipeline."""
    EMBED_MODEL = cfg["embedding"]["model"]

    emb = client.embeddings.create(
        model=EMBED_MODEL,
        input=question
    ).data[0].embedding

    results = chroma_collection.query(
        query_embeddings=[emb],
        n_results=top_k
    )

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


def build_prompt(original_question, original_answer, context):
    context_text = "\n\n".join([
        f"Pergunta similar: {c['question']}\nResposta: {c['answer']}\nVálida: {c['is_valid']}"
        for c in context
    ])

    return (
        f"{PROMPT_TEMPLATE}\n\n"
        f"Pergunta original:\n{original_question}\n"
        f"Resposta:\n{original_answer}\n\n"
        f"Contexto de perguntas semelhantes:\n{context_text}\n\n"
        f"Responda agora:"
    )


def ask_gpt(prompt):
    try:
        response = client.responses.create(
            model=MODEL_NAME,
            input=prompt
        )
        text = response.output_text.strip()

        t = text.lower()
        if "sim" in t:
            return "Sim"
        if "não" in t or "nao" in t:
            return "Não"
        return "Indefinido"
    except Exception as e:
        print(f"Erro ao consultar GPT: {e}")
        return "Erro"


# ------------ Execução principal ------------
def evaluate_model(limit=None):
    processed = {
        doc.get("hash_key")
        for doc in mongo_results.find({MODEL_NAME: {"$exists": True}}, {"hash_key": 1})
    }

    test_cursor = mongo_test.find().limit(limit or 1000)

    for test_doc in test_cursor:
        question = test_doc.get("question", "")
        answer = test_doc.get("answer", "")
        expected = test_doc.get("is_valid", "Não")

        hash_key = make_hash_key(question, answer)
        if hash_key in processed:
            print(f"Já avaliado: {question[:60]}...")
            continue

        print(f"\nAvaliando ({MODEL_NAME}): {question[:80]}...")

        context = get_similar_context(question)
        prompt = build_prompt(question, answer, context)
        model_response = ask_gpt(prompt)

        match = "Correto" if model_response == expected else "Incorreto"

        mongo_results.update_one(
            {"hash_key": hash_key},
            {
                "$set": {
                    "question": question,
                    "answer": answer,
                    "expected_is_valid": expected,
                    MODEL_NAME: model_response,
                    f"match_{MODEL_NAME}": match,
                    "timestamp_last_update": datetime.now().isoformat(),
                }
            },
            upsert=True
        )

        print(f"   → Esperado: {expected} | Modelo: {model_response} | Resultado: {match}")
        print(f"⏳ Aguardando {DELAY_SECONDS}s...")
        time.sleep(DELAY_SECONDS)

    print("\n✅ Avaliação concluída e registrada no MongoDB!")


if __name__ == "__main__":
    evaluate_model(limit=501)