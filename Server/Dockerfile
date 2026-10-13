# Server de AppMovilOfertas contenerizado.
# Base slim (glibc): node:sqlite viene compilado dentro del binario de Node,
# cero dependencias nativas que compilar.
FROM node:24-slim

WORKDIR /srv

# Dependencias primero (capa cacheable: solo se reinstala si cambia package*.json).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Código. OJO: .env y data/ van por fuera (ver docker-compose.yml).
COPY server.js ./
COPY src ./src

ENV PORTWEB=3000
EXPOSE 3000

# La BD SQLite vive aquí. SIN volumen, los datos mueren con el contenedor.
VOLUME ["/srv/data"]

CMD ["node", "server.js"]
