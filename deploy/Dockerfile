FROM python:3.12-slim@sha256:4840d514c583a4d3d8cad3940e68dee6f0f6f3635c12fcd0a3d74c21a5b93a54
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 LIKHA_ENV=production
WORKDIR /app
COPY requirements/production.txt requirements/production.txt
RUN pip install --no-cache-dir --require-hashes -r requirements/production.txt && useradd --create-home --uid 10001 likha
COPY backend backend
COPY tools/build_hosted.py tools/build_hosted.py
COPY *.html *.css *.js favicon.ico ./
COPY assets assets
COPY images images
COPY craftlab craftlab
COPY festival_lab festival_lab
RUN python tools/build_hosted.py && mkdir -p /data /app/staticfiles && cp -a backend/public/. /app/staticfiles/ && chown -R likha:likha /data /app/staticfiles
ENV PYTHONPATH=/app/backend
USER likha
EXPOSE 8000
CMD ["python", "-m", "waitress", "--listen=0.0.0.0:8000", "--threads=4", "--channel-timeout=30", "--max-request-body-size=6291456", "--max-request-header-size=32768", "config.wsgi:application"]
