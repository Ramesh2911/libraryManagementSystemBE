FROM node:18-slim

WORKDIR /app

# openssl CLI - Prisma engine detection needs it (bookworm = OpenSSL 3.x)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma Client (detects debian-openssl-3.0.x after openssl install)
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port and start (db push ensures schema on fresh DB)
EXPOSE 5000
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]
