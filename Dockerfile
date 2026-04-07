FROM node:22-bullseye-slim

WORKDIR /app

COPY package.json ./

RUN npm install --ignore-scripts --no-package-lock

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
