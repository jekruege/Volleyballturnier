FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.js"]
