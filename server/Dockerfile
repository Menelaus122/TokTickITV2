# TokTickIT backend — development image (Node + Express + TypeScript + Prisma)
FROM node:22-alpine

WORKDIR /app

# Install dependencies first so this layer is cached across source edits.
COPY package*.json ./
RUN npm install

# Copy the rest of the source and generate the Prisma client.
# The Category model arrives in Issue 3; until then the schema has no models
# and `prisma generate` is a no-op, so we keep the build green either way.
COPY . .
RUN npx prisma generate || echo "No Prisma models yet (added in Issue 3) — skipping client generation"

EXPOSE 3000

# tsx watch gives hot reload; source is bind-mounted in docker-compose.yml.
CMD ["npm", "run", "dev"]
