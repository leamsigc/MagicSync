FROM python:3.12-slim

# Uncomment the scrapegraph extra to build the image with ScrapeGraphAI inside.
ARG WITH_SCRAPEGRAPH=false

WORKDIR /srv/python-tools
COPY requirements.txt requirements-scrapegraph.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
  && if [ "$WITH_SCRAPEGRAPH" = "true" ]; then pip install --no-cache-dir -r requirements-scrapegraph.txt; fi

COPY app ./app

ENV PYTHONUNBUFFERED=1
EXPOSE 8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
