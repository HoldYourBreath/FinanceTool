# --- Build the static site ---
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
RUN npm run build

# --- Serve with nginx ---
FROM nginx:alpine
# Copy build output to nginx html root
COPY --from=build /app/dist /usr/share/nginx/html

# Basic SPA nginx config (history fallback)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
