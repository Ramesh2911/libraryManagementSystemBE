FROM node:18-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port and start
EXPOSE 5000
CMD ["npm", "start"]
