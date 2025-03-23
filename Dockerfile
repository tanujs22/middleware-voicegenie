# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies (cache this layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy app files
COPY . .

# Expose Middleware port
EXPOSE 3000

# Start the middleware server
CMD ["node", "middleware-server/index.js"]