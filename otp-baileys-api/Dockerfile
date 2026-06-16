FROM node:20-alpine

WORKDIR /app

# Install dependencies needed for some native modules and typescript
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
