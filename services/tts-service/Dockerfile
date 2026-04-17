FROM node:20-alpine
WORKDIR /app

COPY services/tts-service/package*.json ./
RUN npm install --omit=dev

COPY services/tts-service/ ./
EXPOSE 5002
CMD ["node", "src/index.js"]