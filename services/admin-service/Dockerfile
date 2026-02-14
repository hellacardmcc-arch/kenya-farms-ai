FROM node:20-alpine
WORKDIR /app
# docker-cli for rebuild-service from UI (requires COMPOSE_PROJECT_DIR + docker socket mount)
RUN apk add --no-cache docker-cli
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 4006
CMD ["node", "index.js"]
