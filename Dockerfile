FROM python:3.10

WORKDIR /app

# 必要なファイルをコピー
COPY api_server.py ./
COPY chroma_db ./chroma_db
COPY requirements.txt ./

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

EXPOSE 8001

CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8001"]
