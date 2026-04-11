# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (Docker layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/widgethub.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 inside container
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
