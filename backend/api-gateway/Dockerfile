# Stage 1: Build stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy only compiled JS and package.json
COPY --from=build /app/dist ./dist
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Expose API port
EXPOSE 4000

# Start the server
CMD ["node", "dist/server.js"]
