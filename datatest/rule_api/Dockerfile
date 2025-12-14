FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 7014

ENV PORT=7014

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7014"]
