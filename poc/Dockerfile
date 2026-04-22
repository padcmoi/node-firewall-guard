FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache iptables

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV PORT=3000
ENV FIREWALL_DRY_RUN=1

EXPOSE 3000

CMD ["node", "--import", "tsx", "./poc/src/index.ts"]
