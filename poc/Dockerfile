FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache iptables

COPY . .

WORKDIR /app/poc
RUN npm ci

ENV PORT=3000
ENV FIREWALL_DRY_RUN=1

EXPOSE 3000

CMD ["npm", "run", "start"]
