FROM node:20-alpine
WORKDIR /app

COPY services/ai-symptom-service/package*.json ./
RUN npm install --omit=dev

COPY services/ai-symptom-service/ ./
EXPOSE 3007
CMD ["node", "src/index.js"]
