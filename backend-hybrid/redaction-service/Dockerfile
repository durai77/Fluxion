FROM python:3.12-alpine

RUN addgroup -S fluxion && adduser -S -G fluxion fluxion \
  && apk add --no-cache libstdc++ wget

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./

USER fluxion
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:5000/health || exit 1
CMD ["python", "app.py"]
