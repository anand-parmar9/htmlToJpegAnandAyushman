# ---------- Base image ----------
FROM node:18-slim
# Install OS deps for Chrome + native modules
RUN apt-get update && apt-get install -y \
  wget gnupg ca-certificates python3 g++ make \
  fonts-liberation libappindicator3-1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
  libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libnspr4 libnss3 \
  libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
  libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
  libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release xdg-utils \
  && rm -rf /var/lib/apt/lists/*
# ---------- App setup -----------
WORKDIR /app
# Copy package manifests first (for better caching)
COPY package*.json ./
# Disable Puppeteer’s auto Chrome install during npm ci
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --omit=dev
# Copy app source
COPY . .
# ---------- Chrome install ----------
# Download Chrome manually inside the image
RUN npx puppeteer browsers install chrome
# ---------- Runtime ----------
EXPOSE 8080
CMD ["npm", "start"]
