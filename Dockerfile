# --- ESTÁGIO 1: BUILD ---
FROM node:20-alpine AS builder

# Instala dependências nativas necessárias para compilação (se houver)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copia os arquivos de dependência e locks
COPY package*.json bun.lock* ./

# Instala todas as dependências (incluindo devDependencies necessárias para o build)
RUN npm ci --legacy-peer-deps

# Copia todo o código-fonte do projeto
COPY . .

# Argumentos de build obrigatórios para o Vite embutir no bundle client-side
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

# Compila o app (Gera a pasta .output com o servidor standalone Node.js)
RUN npm run build

# --- ESTÁGIO 2: RUNNER ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copia apenas o build final gerado pelo Nitro do estágio anterior
COPY --from=builder /app/.output ./.output

# Expõe a porta usada pelo Nitro
EXPOSE 3000

# Executa o servidor standalone Node.js gerado
CMD ["node", ".output/server/index.mjs"]
