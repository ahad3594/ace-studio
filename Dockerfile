FROM node:24-trixie-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:24-trixie-slim AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-trixie-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libreoffice-writer libreoffice-calc libreoffice-impress ghostscript fonts-dejavu-core libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.lock.txt /tmp/requirements.txt
RUN python3 -m venv /opt/ace-python && /opt/ace-python/bin/pip install --no-cache-dir -r /tmp/requirements.txt
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 ACE_PYTHON=/opt/ace-python/bin/python ACE_WORKER=/app/worker/documents.py ACE_TESSDATA=/app/data/tessdata
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/worker ./worker
COPY --from=build --chown=node:node /app/data ./data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
