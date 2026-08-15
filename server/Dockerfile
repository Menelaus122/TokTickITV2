# TokTickIT backend — development image (Node + Express + TypeScript + Prisma)
FROM node:22-alpine

WORKDIR /app

# Prisma's engines need OpenSSL, which the Alpine base image does not ship.
# Without it, `prisma generate`/`migrate`/`seed` fail to load their engine.
RUN apk add --no-cache openssl

# Install dependencies first so this layer is cached across source edits.
COPY package*.json ./
RUN npm install

# Copy the rest of the source and generate the Prisma client.
COPY . .
RUN npx prisma generate

EXPOSE 3000

# tsx watch gives hot reload; source is bind-mounted in docker-compose.yml.
CMD ["npm", "run", "dev"]
