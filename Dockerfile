FROM python:3.10

WORKDIR /app

# 必要なファイルをコピー
COPY web_chat.py ./
COPY chroma_db ./chroma_db
COPY requirements.txt ./

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

EXPOSE 8501

CMD ["streamlit", "run", "web_chat.py", "--server.port=8501", "--server.address=0.0.0.0"]
