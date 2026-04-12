FROM node:20-alpine
WORKDIR /app
COPY services/appointment-service/package*.json ./
RUN npm install
COPY services/appointment-service/. .
COPY shared /shared
EXPOSE 3003
CMD ["node", "src/index.js"]
