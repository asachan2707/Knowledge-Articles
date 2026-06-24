FROM node:20-alpine

WORKDIR /app

# Install deps first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy server
COPY server.js ./

# The hub articles are mounted at runtime as /hub (read-only volume).
# PORT is configurable; default 3030.
ENV PORT=3030

EXPOSE 3030

CMD ["node", "server.js"]
