# FILE: Dockerfile
# CONTENTS: Build instructions for the Next.js frontend container.
# This file sets up the environment, installs dependencies, and starts the server.

FROM node:18-alpine

WORKDIR /app

# LOGIC: Copy dependency files first to speed up future builds via caching.
COPY package*.json ./
RUN npm install

# LOGIC: Copy the actual source code (pages, styles, etc.) into the container.
COPY . .

EXPOSE 3000

# LOGIC: Starts the Next.js development server.
CMD ["npm", "run", "dev"]