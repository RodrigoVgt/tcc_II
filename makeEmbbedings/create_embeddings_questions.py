import os
import yaml
import chromadb
from openai import OpenAI
from pymongo import MongoClient

# O arquivo de configuração deve ser preenchido para o script funcionar
CONFIG = "../config.yaml"

def load_config():
    with open(CONFIG, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

cfg = load_config()

#APIKEY deve ser gravada no ambiente. Dependendo do sistema operacional, isso pode variar
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("Defina OPENAI_API_KEY no ambiente")

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

if not MONGO_URI or not DB_NAME:
    raise ValueError("Variáveis MONGO_URI e DB_NAME devem estar no .env")

client = OpenAI(api_key=OPENAI_API_KEY)

chroma = chromadb.PersistentClient(path=cfg["paths"]["chroma_db"])
collection = chroma.get_or_create_collection(cfg["collections"]["questions"])

EMBED_MODEL = cfg["embedding"]["model"]

mongo = MongoClient(MONGO_URI)
db = mongo[DB_NAME]
validation_col = db["dataset_validation_mix"]

validation_data = list(validation_col.find({}))

print(f"Indexando {len(validation_data)} perguntas da collection dataset_validation_mix...")

# ======================
# PROCESS
# ======================
for i, row in enumerate(validation_data):
    question = str(row.get("question", ""))

    if not question.strip():
        continue

    emb = client.embeddings.create(
        model=EMBED_MODEL,
        input=question
    ).data[0].embedding

    doc_id = f"val_{i}"

    collection.add(
        ids=[doc_id],
        embeddings=[emb],
        documents=[question],
        metadatas=[{"source": "validation_mix"}]
    )

print("Concluído")