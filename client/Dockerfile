# TokTickIT frontend — development image (React + TypeScript + Vite)
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host makes the Vite dev server reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host"]
