FROM python:3.11-slim

WORKDIR /app

# 시스템 타임존/로케일 관련 패키지는 생략하고, 런타임 최소화
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 7014

ENV PORT=7014

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7014"]
