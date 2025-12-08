import os
import re
import chromadb
from openai import OpenAI
import PyPDF2
import tiktoken
import yaml
from tqdm import tqdm

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

client = OpenAI(api_key=OPENAI_API_KEY)

chroma = chromadb.PersistentClient(path=cfg["paths"]["chroma_db"])
collection = chroma.get_or_create_collection(cfg["collections"]["manuals"])

EMBED_MODEL = cfg["embedding"]["model"]

#Os manuais devem estar na pasta ../manuals, em PDF
MANUALS_DIR = "../manuals"
CHUNK_SIZE = 500
OVERLAP = 50
tokenizer = tiktoken.get_encoding("cl100k_base")


# ======================
# HELPERS
# ======================
def pdf_to_text(filepath):
    text = ""
    with open(filepath, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            t = page.extract_text() or ""
            t = re.sub(r"\s+", " ", t)
            text += t + "\n"
    return text


def chunk_text(text):
    tokens = tokenizer.encode(text)
    chunks = []
    idx = 0

    while idx < len(tokens):
        segment = tokenizer.decode(tokens[idx:idx + CHUNK_SIZE])
        chunks.append(segment)
        idx += CHUNK_SIZE - OVERLAP

    return chunks

pdfs = [f for f in os.listdir(MANUALS_DIR) if f.lower().endswith(".pdf")]

if not pdfs:
    print("Nenhum PDF encontrado em ../manuals/")
    exit()

print(f"{len(pdfs)} PDFs encontrados para indexação.\n")

for pdf_file in pdfs:
    print(f"Extraindo texto de: {pdf_file}")

    filepath = os.path.join(MANUALS_DIR, pdf_file)
    text = pdf_to_text(filepath)

    if len(text.strip()) < 50:
        print(f"PDF parece vazio: {pdf_file} — ignorando.\n")
        continue

    chunks = chunk_text(text)
    print(f"→ {len(chunks)} chunks gerados para {pdf_file}\n")

    # ======================
    # GERA EMBEDDINGS COM PROGRESS BAR
    # ======================
    for i, chunk in enumerate(tqdm(chunks, desc=f"Indexando {pdf_file}", unit="chunk")):
        emb = client.embeddings.create(
            model=EMBED_MODEL,
            input=chunk
        ).data[0].embedding

        doc_id = f"{pdf_file}_{i}"

        collection.add(
            ids=[doc_id],
            embeddings=[emb],
            documents=[chunk],
            metadatas=[{
                "manual": pdf_file,
                "chunk": i,
                "source": "manual_pdf"
            }]
        )

    print(f"{pdf_file} concluído\n")

print("Tudo concluído")
