# Azure Cosmos DB Product Manager - REST API

Aplicación fullstack con **Express REST API** + **Frontend HTML/JS** para gestionar productos en Azure Cosmos DB for NoSQL.

---

## 📑 Índice

- [🏗️ Arquitectura](#️-arquitectura)
- [📁 Estructura del Proyecto](#-estructura-del-proyecto)
- [🆕 Configurar Instancia Nueva de Cosmos DB](#-configurar-instancia-nueva-de-cosmos-db-para-desarrollo)
  - [Opción A: Crear Cosmos DB desde Cero](#opción-a-crear-cosmos-db-desde-cero)
  - [Opción B: Usar Cosmos DB Existente](#opción-b-usar-cosmos-db-existente)
- [🔐 Configurar Autenticación](#-configurar-autenticación)
  - [Opción 1: RBAC con Managed Identity (Recomendado)](#opción-1-rbac-con-managed-identity-recomendado-para-producción)
  - [Opción 2: Connection String (Solo Desarrollo)](#opción-2-connection-string-solo-desarrollo-local)
- [🚀 Desarrollo Local](#-desarrollo-local)
  - [Instalación](#instalación)
  - [Configuración](#configuración)
  - [Ejecutar la Aplicación](#ejecutar-la-aplicación)
- [📡 API REST Endpoints](#-api-rest-endpoints)
- [🏗️ Build para Producción](#️-build-para-producción)
- [📦 Dependencias Principales](#-dependencias-principales)
- [🚢 Deploy a Producción - System-Assigned Managed Identity](#-deploy-a-producción-azure-app-service)
  - [Paso 1: Configurar Variables](#paso-1-configurar-variables-de-entorno)
  - [Paso 2: Crear App Service](#paso-2-crear-app-service-y-plan)
  - [Paso 3: Configurar Managed Identity](#paso-3-configurar-managed-identity-y-permisos)
  - [Paso 4: Variables de Entorno](#paso-4-configurar-variables-de-entorno-de-la-app)
  - [Paso 5: Startup Command](#paso-5-configurar-startup-command)
  - [Paso 6: Compilar y Desplegar](#paso-6-compilar-y-desplegar-el-código)
  - [Paso 7: Verificar](#paso-7-verificar-el-despliegue)
  - [Script Completo](#script-completo-de-deployment)
- [🚢 Deploy a Producción - User-Assigned Managed Identity](#-deploy-a-producción-user-assigned-managed-identity)
- [🔧 Troubleshooting y Peculiaridades](#-troubleshooting-y-peculiaridades-del-deployment)
  - [Problemas Comunes](#️-problemas-comunes-y-soluciones)
  - [Peculiaridades de TypeScript](#-peculiaridades-de-proyectos-typescript-en-azure-app-service)
  - [Checklist Pre-Deployment](#-checklist-de-pre-deployment)
  - [Comandos de Diagnóstico](#-comandos-útiles-de-diagnóstico)
- [🧪 Testing](#-testing)
- [📚 Recursos](#-recursos)
- [📝 Notas](#-notas)

---

## 🏗️ Arquitectura

```
┌─────────────────┐         HTTP REST           ┌──────────────────┐
│                 │    ◄─────────────────────►  │                  │
│  Frontend       │    GET/POST/DELETE          │  Express API     │
│  (HTML/JS)      │    /api/products            │  (TypeScript)    │
│                 │                             │                  │
└─────────────────┘                             └────────┬─────────┘
                                                         │
                                                         │ Azure SDK
                                                         ▼
                                                ┌──────────────────┐
                                                │                  │
                                                │  Azure Cosmos DB │
                                                │  (NoSQL)         │
                                                │                  │
                                                └──────────────────┘
```

---

## 📁 Estructura del Proyecto

```
src/ts/
├── app.ts              # Express REST API server
├── cosmos.ts           # Azure Cosmos DB client (CRUD operations)
├── types.ts            # TypeScript interfaces
├── package.json        # Dependencias
├── tsconfig.json       # Configuración TypeScript
├── .env                # Variables de entorno (NO commitear)
├── static/             # Frontend
│   ├── index.html      # UI principal
│   ├── api.js          # Cliente REST API (fetch)
│   └── favicon.ico
└── README.md           # Este archivo
```

---

## 🆕 Configurar Instancia Nueva de Cosmos DB (Para desarrollo)

### Opción A: Crear Cosmos DB desde Cero

Si no tienes una base de datos Cosmos DB, créala:

```bash
# 1. Login a Azure
az login

RG_NAME="mi-grupo"
LOCATION="spaincentral"
COSMOSDB_ACCOUNT_NAME="mi-cuenta-cosmosdb-produccion"
DB_NAME="cosmicworks"
CONTAINER_NAME="products"

$RG_NAME = "mi-grupo"
$LOCATION = "spaincentral"
$COSMOSDB_ACCOUNT_NAME = "mi-cuenta-cosmosdb-produccion"
$DB_NAME = "cosmicworks"
$CONTAINER_NAME = "products"

# 2. Crear grupo de recursos (si no existe)
az group create --name $RG_NAME --location $LOCATION

# 3. Crear cuenta de Cosmos DB
az cosmosdb create \
  --name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --locations regionName=$LOCATION \
  --default-consistency-level Session

# 4. Crear base de datos
az cosmosdb sql database create \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --name $DB_NAME

# 5. Crear contenedor con partition key
az cosmosdb sql container create \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --database-name $DB_NAME \
  --name $CONTAINER_NAME \
  --partition-key-path "/category" \
  --throughput 400
```

### Opción B: Usar Cosmos DB Existente

Si ya tienes Cosmos DB, solo verifica que existe la base de datos y contenedor:

```bash
# Listar bases de datos
az cosmosdb sql database list \
  --account-name $COSMOSDB_ACCOUNT_NAME
  --resource-group $RG_NAME

# Listar contenedores
az cosmosdb sql container list \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --database-name $DB_NAME
```

---

### 🔐 Asignar Permisos RBAC (IMPORTANTE)

Para que tu usuario pueda acceder a Cosmos DB con Azure AD, necesitas asignarle el rol:

```bash
# 1. Obtener tu Object ID (Identificador de Objeto), el cual es único en el directorio de Microsoft Entra ID (el Tenant). Entra ID es la única fuente de verdad para esa identidad.
MY_USER_ID=$(az ad signed-in-user show --query id -o tsv)

$MY_USER_ID = (az ad signed-in-user show --query id --output tsv)


# 3. Asignar rol "Cosmos DB Built-in Data Contributor".
# Si el scope fuera más granular, por ejemplo, si solo quisieras dar acceso a una base de datos específica, la sintaxis sería más larga (ej: --scope "/dbs/cosmicworks").
az cosmosdb sql role assignment create \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --role-definition-name "Cosmos DB Built-in Data Contributor" \
  --principal-id $MY_USER_ID \
  --scope "/"

az cosmosdb sql role assignment create `
  --account-name $COSMOSDB_ACCOUNT_NAME `
  --resource-group $RG_NAME `
  --role-definition-name "Cosmos DB Built-in Data Contributor" `
  --principal-id $MY_USER_ID `
  --scope "/"


# Comprueba que tenga el rol:
az cosmosdb sql role assignment list \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --output table

# También puedes ir a los logs de la cosmosdb account en el portal para comprobarlo
```

El código que estamos usando es el mismo que se usaría con una Managed Identity. La diferencia es que, en este momento, estás usando tu `Identidad de Desarrollador` en lugar de la Identidad del Servicio para pasar la prueba.

**Alternativa desde Azure Portal:**

1. Ve a Azure Portal → Tu Cosmos DB
2. Click en **"Access Control (IAM)"** en el menú izquierdo
3. Click **"+ Add"** → **"Add role assignment"**
4. Selecciona **"Cosmos DB Built-in Data Contributor"**
5. En "Members", selecciona tu usuario
6. Click **"Review + assign"**

⏰ **Nota:** Los permisos pueden tardar 1-2 minutos en propagarse.

---

## 🚀 Cómo Ejecutar la Aplicación

### Prerrequisitos

1. **Node.js 18+** instalado
2. **Azure CLI** instalado y autenticado:
   ```bash
   az login
   ```
3. **Cuenta de Azure Cosmos DB** creada (ver sección anterior)
4. **Permisos RBAC** asignados (ver sección anterior)
5. **Variables de entorno** configuradas (ver abajo)

---

### Paso 1: Configurar Variables de Entorno

Crea un archivo `.env` en `src/ts/` con el siguiente contenido:

```bash
# Endpoint de tu Cosmos DB (obligatorio)
CONFIGURATION__AZURECOSMOSDB__ENDPOINT="https://TU-CUENTA.documents.azure.com:443/"

# Nombre de la base de datos (opcional, default: cosmicworks)
CONFIGURATION__AZURECOSMOSDB__DATABASENAME="cosmicworks"

# Nombre del contenedor (opcional, default: products)
CONFIGURATION__AZURECOSMOSDB__CONTAINERNAME="products"

# Puerto del servidor (opcional, default: 3000)
PORT=3000
```

**Para obtener el endpoint:**

- Azure Portal → Tu Cosmos DB → Settings → Keys → URI

O con Azure CLI:

```bash
az cosmosdb show --name $COSMOSDB_ACCOUNT_NAME --resource-group $RG_NAME --query documentEndpoint -o tsv
```

---

### Paso 2: Instalar Dependencias

```bash
cd src/ts
npm install
```

---

### Paso 3: Ejecutar el Servidor (Backend + Frontend)

```bash
npm run dev
```

Verás algo como:

```
╔═══════════════════════════════════════════════════════════╗
║  Azure Cosmos DB REST API Server                         ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server running on: http://localhost:3000
📱 Frontend:          http://localhost:3000

📡 API Endpoints:
   GET    /api/health
   GET    /api/products
   POST   /api/products
   DELETE /api/products/:id?category=xxx
   GET    /api/products/category/:category

🔐 Authentication: Azure AD (DefaultAzureCredential)
   Make sure you ran: az login

Press Ctrl+C to stop
```

---

### Paso 4: Abrir el Frontend

Abre tu navegador en:

```
http://localhost:3000
```

---

## 🎯 Características

### Backend (Express REST API)

- **GET /api/products** - Lista todos los productos
- **POST /api/products** - Crea un nuevo producto
- **DELETE /api/products/:id?category=xxx** - Elimina un producto
- **GET /api/products/category/:category** - Busca por categoría
- **GET /api/health** - Health check

### Frontend (HTML/JavaScript)

- Formulario para crear productos
- Lista de productos con tarjetas visuales
- Eliminar productos con confirmación
- Indicador de "CLEARANCE" para ofertas
- Toasts para notificaciones
- Loading spinners
- Responsive design (Bootstrap 5)

---

## 🔧 Scripts Disponibles

```bash
# Desarrollo (con hot reload)
npm run dev

# Build para producción
npm run build

# Ejecutar versión compilada
npm start
```

---

## 🔐 Autenticación

La aplicación usa **Azure AD (Azure Active Directory)** con `DefaultAzureCredential`.

**Requisitos:**

1. Debes estar autenticado con Azure CLI:

   ```bash
   az login
   ```

2. Tu usuario debe tener permisos en Cosmos DB:
   - **Cosmos DB Built-in Data Contributor** (recomendado)
   - O **Owner** del recurso

**Alternativa (no recomendada para producción):**
Si tu Cosmos DB tiene habilitada la autenticación por key, puedes usar connection string (ver `cosmos.ts`).

---

## 📡 API REST - Ejemplos con cURL

### Listar productos

```bash
curl http://localhost:3000/api/products
```

### Crear producto

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mountain Bike Pro",
    "category": "bikes-mountain",
    "quantity": 10,
    "price": 1299.99,
    "clearance": false
  }'
```

### Eliminar producto

```bash
curl -X DELETE "http://localhost:3000/api/products/abc-123?category=bikes-mountain"
```

### Health check

```bash
curl http://localhost:3000/api/health
```

---

## 🗄️ Modelo de Datos

```typescript
interface Product {
  id: string; // UUID generado automáticamente
  category: string; // Partition key
  name: string;
  quantity: number;
  price: number;
  clearance: boolean;
}
```

**Importante:** `category` es el **partition key** en Cosmos DB, por lo que es obligatorio para operaciones de lectura/eliminación.

---

## 🐛 Troubleshooting

### Error: "Invalid URL" o "ENDPOINT: undefined"

**Solución:** Verifica que el archivo `.env` existe y tiene `CONFIGURATION__AZURECOSMOSDB__ENDPOINT` configurado.

### Error: "Local Authorization is disabled"

**Causa:** Tu Cosmos DB solo acepta Azure AD authentication.

**Solución:** Ejecuta `az login` antes de arrancar la app.

### Error: "EADDRINUSE: address already in use"

**Causa:** Ya hay algo corriendo en el puerto 3000.

**Solución:**

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

O cambia el puerto en `.env`:

```bash
PORT=3001
```

### No se cargan los productos

**Verificar:**

1. El servidor está corriendo
2. La base de datos y contenedor existen
3. Tienes permisos en Cosmos DB
4. Abre la consola del navegador (F12) para ver errores

---

## 📦 Dependencias Principales

### Backend

- **express** - Framework web
- **@azure/cosmos** - SDK de Cosmos DB
- **@azure/identity** - Autenticación Azure AD
- **cors** - CORS middleware
- **dotenv** - Variables de entorno
- **typescript** - TypeScript compiler

### Frontend

- **Bootstrap 5** - UI framework
- **Bootstrap Icons** - Iconos
- **jQuery** - DOM manipulation (opcional, se puede reemplazar)

---

## 🚢 Deploy a Producción (Azure App Service)

### Resumen del Proceso

1. **Crear infraestructura** (App Service + Plan)
2. **Configurar Managed Identity** para autenticación segura
3. **Configurar variables de entorno**
4. **Compilar y empaquetar el código TypeScript**
5. **Desplegar el código**
6. **Verificar el despliegue**

---

### Paso 1: Configurar Variables de Entorno

```bash
# Configuración básica
RG_NAME="mi-grupo"
LOCATION="spaincentral"
COSMOSDB_ACCOUNT_NAME="mi-cuenta-cosmosdb-produccion"
DB_NAME="cosmicworks"
CONTAINER_NAME="products"

APP_NAME="mi-app-cosmosdb-produccion"
RUNTIME="NODE:22-lts"
COSMOS_ENDPOINT="https://${COSMOSDB_ACCOUNT_NAME}.documents.azure.com:443/"


# Configuración Powershell
$RG_NAME = "mi-grupo"
$LOCATION = "spaincentral"
$COSMOSDB_ACCOUNT_NAME = "mi-cuenta-cosmosdb-produccion"
$DB_NAME = "cosmicworks"
$CONTAINER_NAME = "products"

$APP_NAME = "mi-app-cosmosdb-produccion"
$RUNTIME = "NODE:22-lts"
$COSMOS_ENDPOINT = "https://$COSMOSDB_ACCOUNT_NAME.documents.azure.com:443/"

# Login a Azure
az login
```

---

### Paso 2: Crear App Service y Plan

```bash
# Crear grupo de recursos (si no existe)
az group create --name $RG_NAME --location $LOCATION

# Opción A: Crear Plan y App Service por separado (RECOMENDADO)
az appservice plan create \
  --name "${APP_NAME}-plan" \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --is-linux \
  --sku S1

az webapp create \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --plan "${APP_NAME}-plan" \
  --runtime $RUNTIME

# Opción B: Crear con az webapp up (más simple pero menos control)
# az webapp up \
#   --name $APP_NAME \
#   --resource-group $RG_NAME \
#   --runtime $RUNTIME \
#   --location $LOCATION
```

---

### Paso 3: Configurar Managed Identity y Permisos

```bash
# Habilitar System-Assigned Managed Identity
MI_PRINCIPAL_ID=$(az webapp identity assign \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --query principalId -o tsv)

$MI_PRINCIPAL_ID = (az webapp identity assign `
    --name $APP_NAME `
    --resource-group $RG_NAME `
    --query principalId `
    --output tsv)

echo "Managed Identity Principal ID: $MI_PRINCIPAL_ID"

# Asignar rol de Contributor en Cosmos DB
az cosmosdb sql role assignment create \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --role-definition-name "Cosmos DB Built-in Data Contributor" \
  --principal-id $MI_PRINCIPAL_ID \
  --scope "/"

az cosmosdb sql role assignment create `
  --account-name $COSMOSDB_ACCOUNT_NAME `
  --resource-group $RG_NAME `
  --role-definition-name "Cosmos DB Built-in Data Contributor" `
  --principal-id $MI_PRINCIPAL_ID `
  --scope "/"
```

---

### Paso 4: Configurar Variables de Entorno de la App

#### Opción A: Configuración Directa (Simple)

```bash
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --settings \
    CONFIGURATION__AZURECOSMOSDB__ENDPOINT="$COSMOS_ENDPOINT" \
    CONFIGURATION__AZURECOSMOSDB__DATABASENAME="$DB_NAME" \
    CONFIGURATION__AZURECOSMOSDB__CONTAINERNAME="$CONTAINER_NAME"
```

#### Opción B: Usar Azure Key Vault (Recomendado para Producción)

```bash
# 1. Crear Key Vault
az keyvault create \
  --name "kv-$APP_NAME" \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --sku standard

# 2. Guardar el endpoint en Key Vault
az keyvault secret set \
  --vault-name "kv-$APP_NAME" \
  --name "CosmosEndpoint" \
  --value $COSMOS_ENDPOINT

# 3. Dar permisos a la Managed Identity para leer secretos
az keyvault set-policy \
  --name "kv-$APP_NAME" \
  --resource-group $RG_NAME \
  --object-id $MI_PRINCIPAL_ID \
  --secret-permissions get list

# 4. Obtener URI del secreto
SECRET_URI=$(az keyvault secret show \
  --name "CosmosEndpoint" \
  --vault-name "kv-$APP_NAME" \
  --query id -o tsv)

# 5. Configurar App Settings para usar Key Vault
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --settings \
    CONFIGURATION__AZURECOSMOSDB__ENDPOINT="@Microsoft.KeyVault(SecretUri=$SECRET_URI)" \
    CONFIGURATION__AZURECOSMOSDB__DATABASENAME="$DB_NAME" \
    CONFIGURATION__AZURECOSMOSDB__CONTAINERNAME="$CONTAINER_NAME"
```

---

### Paso 5: Configurar Startup Command

**⚠️ IMPORTANTE:** Este paso es crítico para que la app funcione correctamente.

`npm install --production && npm start`: Instala solo las dependencias de producción (no devDependencies) - Esto fue importante, sustituyó a `"npm install && npm start"` porque Azure estaba ejecutando solo npm start directamente...

```bash
az webapp config set \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --startup-file "npm install --production && npm start"
```

---

### Paso 6: Compilar y Desplegar el Código

Ejecuta estos comandos **desde el directorio raíz del proyecto**:

```bash
# 1. Instalar dependencias y compilar
npm install
npm run build

# 2. Crear directorio de deployment limpio
rm -rf deploy_package
mkdir -p deploy_package

# 3. Copiar solo los archivos necesarios
cp -r dist/* deploy_package/
cp package.json deploy_package/
cp package-lock.json deploy_package/

# 4. Crear ZIP del paquete
cd deploy_package
python -c "
import zipfile
import os

with zipfile.ZipFile('../deploy.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, '.')
            zipf.write(file_path, arcname)
            print(f'Added: {arcname}')
"
cd ..

# 5. Desplegar a Azure
az webapp deploy \
  --resource-group $RG_NAME \
  --name $APP_NAME \
  --src-path deploy.zip \
  --type zip \
  --async false

# ‼️ Mientras hace el deploy es muy importante mirar los logs para ir viendo lo que va mal:
# Ver logs en tiempo real
az webapp log tail --name $APP_NAME --resource-group $RG_NAME

# Descargar logs completos
az webapp log download \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --log-file app-logs.zip

# 6. Limpiar archivos temporales
rm -rf deploy_package deploy.zip

echo "✅ Deployment completado!"
```

---

### Paso 7: Verificar el Despliegue

```bash
# Ver URL de la aplicación
WEBAPP_URL=$(az webapp show \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --query defaultHostName \
  -o tsv)

echo "🌐 Tu aplicación está disponible en:"
echo "https://$WEBAPP_URL"

# Probar endpoint de health
curl https://$WEBAPP_URL/api/health

```

---

### Script Completo de Deployment

Puedes crear un archivo `deploy-to-azure.sh` con todo el proceso:

```bash
#!/bin/bash
set -e

# Variables
RG_NAME="mi-grupo"
APP_NAME="mi-app-cosmosdb-produccion"

echo "🔨 Building project..."
npm run build

echo "📦 Creating deployment package..."
rm -rf deploy_package
mkdir -p deploy_package
cp -r dist/* deploy_package/
cp package.json deploy_package/
cp package-lock.json deploy_package/

cd deploy_package
python -c "
import zipfile, os
with zipfile.ZipFile('../deploy.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            zipf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), '.'))
"
cd ..

echo "🚀 Deploying to Azure..."
az webapp deploy \
  --resource-group $RG_NAME \
  --name $APP_NAME \
  --src-path deploy.zip \
  --type zip \
  --async false

rm -rf deploy_package deploy.zip

echo "✅ Deployment complete!"
echo "🌐 URL: https://${APP_NAME}.azurewebsites.net"
```

Hacerlo ejecutable y usarlo:

```bash
chmod +x deploy-to-azure.sh
./deploy-to-azure.sh
```

---

## 🚢 Deploy a Producción (User-Assigned Managed Identity)

**User-Assigned Managed Identity** es útil cuando quieres reutilizar la misma identidad en múltiples recursos de Azure (varios App Services, VMs, etc.).

### Diferencias con System-Assigned:

| Característica    | System-Assigned           | User-Assigned                     |
| ----------------- | ------------------------- | --------------------------------- |
| **Ciclo de vida** | Vinculado al recurso      | Independiente del recurso         |
| **Reutilizable**  | ❌ No                     | ✅ Sí (múltiples recursos)        |
| **Gestión**       | Automática                | Manual                            |
| **Uso típico**    | Un recurso, una identidad | Múltiples recursos, una identidad |

---

### Paso 1: Configurar Variables de Entorno

```bash
# Configuración básica
RG_NAME="mi-grupo"
LOCATION="spaincentral"
COSMOSDB_ACCOUNT_NAME="mi-cuenta-cosmosdb-produccion"
DB_NAME="cosmicworks"
CONTAINER_NAME="products"

APP_NAME="mi-app-cosmosdb-produccion"
RUNTIME="NODE:22-lts"
COSMOS_ENDPOINT="https://${COSMOSDB_ACCOUNT_NAME}.documents.azure.com:443/"

# User-Assigned Identity
MI_NAME="cosmosdb-identity"  # Nombre del recurso de identidad

# Login
az login
```

---

### Paso 2: Crear User-Assigned Managed Identity

**⚠️ Diferencia clave:** Primero creamos la identidad como un recurso independiente.

```bash
# Crear el recurso de User-Assigned Managed Identity
az identity create \
  --resource-group $RG_NAME \
  --name $MI_NAME \
  --location $LOCATION

# Obtener los IDs necesarios
MI_PRINCIPAL_ID=$(az identity show \
  --resource-group $RG_NAME \
  --name $MI_NAME \
  --query principalId -o tsv)

MI_RESOURCE_ID=$(az identity show \
  --resource-group $RG_NAME \
  --name $MI_NAME \
  --query id -o tsv)

echo "✅ User-Assigned Managed Identity creada:"
echo "   Principal ID: $MI_PRINCIPAL_ID"
echo "   Resource ID:  $MI_RESOURCE_ID"
```

**Explicación de los IDs:**

- **Principal ID:** Identificador en Azure Active Directory (usado para permisos RBAC)
- **Resource ID:** Identificador del recurso en Azure Resource Manager (usado para vincular a recursos)

---

### Paso 3: Asignar Permisos RBAC a la Identidad

```bash
# Asignar rol de Contributor en Cosmos DB
az cosmosdb sql role assignment create \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --role-definition-name "Cosmos DB Built-in Data Contributor" \
  --principal-id $MI_PRINCIPAL_ID \
  --scope "/"

echo "✅ Permisos RBAC asignados a la identidad"
```

---

### Paso 4: Crear App Service

```bash
# Crear Plan de App Service
az appservice plan create \
  --name "${APP_NAME}-plan" \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --is-linux \
  --sku B1

# Crear Web App
az webapp create \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --plan "${APP_NAME}-plan" \
  --runtime $RUNTIME
```

---

### Paso 5: Vincular User-Assigned Identity al App Service

**⚠️ Paso crítico:** Vinculamos la identidad al App Service.

```bash
# Asignar la User-Assigned Identity al App Service
az webapp identity assign \
  --resource-group $RG_NAME \
  --name $APP_NAME \
  --identities $MI_RESOURCE_ID

echo "✅ User-Assigned Managed Identity vinculada al App Service"
```

---

### Paso 6: Configurar Variables de Entorno

```bash
# Configurar App Settings
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --settings \
    CONFIGURATION__AZURECOSMOSDB__ENDPOINT="$COSMOS_ENDPOINT" \
    CONFIGURATION__AZURECOSMOSDB__DATABASENAME="$DB_NAME" \
    CONFIGURATION__AZURECOSMOSDB__CONTAINERNAME="$CONTAINER_NAME" \
    AZURE_CLIENT_ID="$MI_PRINCIPAL_ID"

# Nota: AZURE_CLIENT_ID es necesario cuando usas User-Assigned MI
# para que DefaultAzureCredential sepa qué identidad usar
```

**⚠️ IMPORTANTE:** Con User-Assigned MI necesitas configurar `AZURE_CLIENT_ID` para que el SDK sepa cuál identidad usar (en caso de que el recurso tenga múltiples identidades asignadas).

---

### Paso 7: Configurar Startup Command

```bash
az webapp config set \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --startup-file "npm install --production && npm start"
```

---

### Paso 8: Desplegar el Código

Usa el mismo proceso de deployment que con System-Assigned:

```bash
# Compilar y crear package
npm run build
rm -rf deploy_package && mkdir -p deploy_package
cp -r dist/* deploy_package/
cp package.json deploy_package/
cp package-lock.json deploy_package/

# Crear ZIP
cd deploy_package
python -c "
import zipfile, os
with zipfile.ZipFile('../deploy.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            zipf.write(os.path.join(root, file),
                      os.path.relpath(os.path.join(root, file), '.'))
"
cd ..

# Desplegar
az webapp deploy \
  --resource-group $RG_NAME \
  --name $APP_NAME \
  --src-path deploy.zip \
  --type zip \
  --async false

# Limpiar
rm -rf deploy_package deploy.zip
```

---

### Script Completo - User-Assigned MI

```bash
#!/bin/bash
set -e

# Variables
RG_NAME="mi-grupo"
LOCATION="spaincentral"
COSMOSDB_ACCOUNT_NAME="mi-cuenta-cosmosdb-produccion"
DB_NAME="cosmicworks"
CONTAINER_NAME="products"
APP_NAME="mi-app-cosmosdb-produccion"
RUNTIME="NODE:22-lts"
COSMOS_ENDPOINT="https://${COSMOSDB_ACCOUNT_NAME}.documents.azure.com:443/"
MI_NAME="cosmosdb-identity"

echo "1️⃣ Creando User-Assigned Managed Identity..."
az identity create --resource-group $RG_NAME --name $MI_NAME --location $LOCATION

MI_PRINCIPAL_ID=$(az identity show --resource-group $RG_NAME --name $MI_NAME --query principalId -o tsv)
MI_RESOURCE_ID=$(az identity show --resource-group $RG_NAME --name $MI_NAME --query id -o tsv)

echo "2️⃣ Asignando permisos RBAC en Cosmos DB..."
az cosmosdb sql role assignment create \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --role-definition-name "Cosmos DB Built-in Data Contributor" \
  --principal-id $MI_PRINCIPAL_ID \
  --scope "/"

echo "3️⃣ Creando App Service..."
az appservice plan create --name "${APP_NAME}-plan" --resource-group $RG_NAME --location $LOCATION --is-linux --sku B1
az webapp create --name $APP_NAME --resource-group $RG_NAME --plan "${APP_NAME}-plan" --runtime $RUNTIME

echo "4️⃣ Vinculando User-Assigned MI al App Service..."
az webapp identity assign --resource-group $RG_NAME --name $APP_NAME --identities $MI_RESOURCE_ID

echo "5️⃣ Configurando variables de entorno..."
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --settings \
    CONFIGURATION__AZURECOSMOSDB__ENDPOINT="$COSMOS_ENDPOINT" \
    CONFIGURATION__AZURECOSMOSDB__DATABASENAME="$DB_NAME" \
    CONFIGURATION__AZURECOSMOSDB__CONTAINERNAME="$CONTAINER_NAME" \
    AZURE_CLIENT_ID="$MI_PRINCIPAL_ID"

echo "6️⃣ Configurando startup command..."
az webapp config set --name $APP_NAME --resource-group $RG_NAME --startup-file "npm install --production && npm start"

echo "✅ Infraestructura lista. Ahora despliega el código con ./deploy-to-azure.sh"
echo "🌐 URL: https://${APP_NAME}.azurewebsites.net"
```

---

### Ventajas de User-Assigned MI

✅ **Reutilizable:** Puedes asignar la misma identidad a múltiples App Services, Functions, VMs, etc.
✅ **Gestión centralizada:** Permisos RBAC asignados una vez, compartidos por todos los recursos
✅ **Independiente:** La identidad no se elimina si borras el App Service
✅ **Auditoría:** Más fácil rastrear qué recursos usan qué identidad

### Cuándo usar User-Assigned en lugar de System-Assigned

- 🔹 Tienes **múltiples App Services** que necesitan acceso al mismo Cosmos DB
- 🔹 Quieres **separar el ciclo de vida** de la identidad del recurso
- 🔹 Necesitas **gestión centralizada** de permisos
- 🔹 Trabajas en **entornos enterprise** con múltiples microservicios

---

## 🧪 Testing

Puedes usar **Postman**, **Insomnia** o **curl** para probar los endpoints.

Colección de Postman de ejemplo:

```json
{
  "info": {
    "name": "Cosmos DB Products API"
  },
  "item": [
    {
      "name": "List Products",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/api/products"
      }
    },
    {
      "name": "Create Product",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/api/products",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Test Product\",\n  \"category\": \"test-category\",\n  \"quantity\": 5,\n  \"price\": 99.99,\n  \"clearance\": false\n}"
        }
      }
    }
  ]
}
```

---

## 🔧 Troubleshooting y Peculiaridades del Deployment

### ⚠️ Problemas Comunes y Soluciones

#### 1. **"Application Error" o contenedor crashea (Exit Code 1)**

**Síntoma:** La app muestra "Application Error" y los logs muestran que el contenedor termina con exit code 1.

**Causas posibles:**

- **Startup command incorrecto:** El comando de inicio no coincide con la estructura de archivos desplegados
- **Archivos faltantes:** El deployment no incluyó todos los archivos necesarios
- **Dependencias no instaladas:** `node_modules` no se instaló correctamente

**Solución:**

```bash
# Verificar que el startup command esté configurado
az webapp config show \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --query "{startupCommand: appCommandLine, runtime: linuxFxVersion}"

# Si está vacío o incorrecto, configurarlo:
az webapp config set \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --startup-file "npm install --production && npm start"
```

#### 2. **Deployment exitoso pero "0 files synced"**

**Síntoma:** El deployment reporta éxito pero dice "Total number of files to be synced = 0".

**Causa:** Cuando usas `az webapp up` o `config-zip` con archivos `tar.gz`, Azure puede fallar al extraer el contenido si:

- El directorio `dist/` está en `.gitignore` y el comando usa git internamente
- El formato del archivo comprimido no es compatible

**Solución:**

```bash
# SIEMPRE crear el ZIP con Python (compatible garantizado)
cd deploy_package
python -c "
import zipfile, os
with zipfile.ZipFile('../deploy.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            zipf.write(os.path.join(root, file),
                      os.path.relpath(os.path.join(root, file), '.'))
"
cd ..

# Usar az webapp deploy con --type zip
az webapp deploy --resource-group $RG_NAME --name $APP_NAME --src-path deploy.zip --type zip
```

#### 3. **"Cannot find module" o errores de importación**

**Síntoma:** La app crashea con errores como `Cannot find module '@azure/cosmos'` o similar.

**Causa:** El archivo `package.json` desplegado no coincide con el código, o `npm install` falló.

**Solución:**

```bash
# Verificar que package.json esté en el deployment package
# El ZIP debe contener:
# - package.json (raíz)
# - package-lock.json (raíz)
# - app.js, cosmos.js, types.js (archivos compilados en raíz)
# - static/ (directorio con archivos estáticos)

# Verificar estructura del ZIP antes de desplegar:
python -c "import zipfile; print('\n'.join(zipfile.ZipFile('deploy.zip').namelist()))"
```

#### 4. **"404 Not Found" al acceder a archivos estáticos**

**Síntoma:** La página principal carga pero no encuentra favicon, CSS o JS.

**Causa:** Rutas de archivos estáticos mal configuradas en Express.

**Solución:**

En [app.ts](app.ts), asegúrate de usar rutas absolutas con `join(__dirname, ...)`:

```typescript
// ✅ CORRECTO
app.use(favicon(join(__dirname, "static", "favicon.ico")));
app.use(express.static(join(__dirname, "static")));

// ❌ INCORRECTO
app.use(express.static("static")); // Ruta relativa - falla en producción
```

#### 5. **El sitio se queda "Starting the site..." indefinidamente**

**Síntoma:** El deployment se queda atascado en "Starting the site..." por minutos.

**Causas posibles:**

- El script `postinstall` en `package.json` intenta recompilar TypeScript pero no hay archivos `.ts`
- El startup command está mal y el contenedor no puede iniciar

**Solución:**

```bash
# 1. ELIMINAR script postinstall del package.json
# El package.json desplegado NO debe tener:
# "postinstall": "npm run build"  ❌

# 2. Verificar que solo despliegas código compilado:
# deploy_package/ debe contener:
#   ├── app.js (NO app.ts)
#   ├── cosmos.js (NO cosmos.ts)
#   ├── types.js (NO types.ts)
#   ├── static/
#   ├── package.json
#   └── package-lock.json
```

#### 6. **Errores de autenticación con Cosmos DB**

**Síntoma:** Error 401 Unauthorized o "Managed identity not found".

**Causas:**

- Managed Identity no está habilitada
- No se asignó el rol RBAC en Cosmos DB
- La configuración de variables de entorno está mal

**Solución:**

```bash
# Verificar Managed Identity
MI_PRINCIPAL_ID=$(az webapp identity show \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --query principalId -o tsv)

if [ -z "$MI_PRINCIPAL_ID" ]; then
  echo "❌ Managed Identity NO configurada"
  # Habilitar:
  az webapp identity assign --name $APP_NAME --resource-group $RG_NAME
else
  echo "✅ Managed Identity: $MI_PRINCIPAL_ID"
fi

# Verificar role assignment
az cosmosdb sql role assignment list \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  | grep $MI_PRINCIPAL_ID

# Si no aparece, asignar:
az cosmosdb sql role assignment create \
  --account-name $COSMOSDB_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --role-definition-name "Cosmos DB Built-in Data Contributor" \
  --principal-id $MI_PRINCIPAL_ID \
  --scope "/"
```

---

### 📌 Peculiaridades de Proyectos TypeScript en Azure App Service

#### 1. **Estructura de Archivos Compilados vs. Fuente**

**Problema:** Azure App Service ejecuta código JavaScript compilado, NO TypeScript directamente.

**Implicaciones:**

- **Desplegar `dist/` compilado, NO `src/`:** El ZIP debe contener archivos `.js`, no `.ts`
- **`__dirname` apunta a `dist/`:** Todas las rutas deben ser relativas a donde está el `.js` compilado
- **No incluir `devDependencies`:** TypeScript, ts-node, etc. NO son necesarios en producción

**Mejor práctica:**

```bash
# Estructura del deployment package:
deploy_package/
├── app.js              # Compilado desde app.ts
├── cosmos.js           # Compilado desde cosmos.ts
├── types.js            # Compilado desde types.ts
├── static/             # Archivos estáticos copiados
│   ├── index.html
│   ├── api.js
│   └── favicon.ico
├── package.json        # SIN postinstall, SIN devDependencies en producción
└── package-lock.json
```

#### 2. **Scripts de `package.json` para Deployment**

**package.json correcto para deployment:**

```json
{
  "main": "dist/app.js",
  "scripts": {
    "build": "npx tsc && npx copyfiles ./static/**/* ./dist/",
    "start": "node dist/app.js",
    "dev": "npx ts-node app.ts"
    // ❌ NO incluir: "postinstall": "npm run build"
  },
  "dependencies": {
    // Incluir TypeScript y copyfiles si usas postinstall
    // Pero es mejor NO usar postinstall y desplegar código ya compilado
    "@azure/cosmos": "^4",
    "@azure/identity": "^4",
    "express": "^4"
    // ... resto de runtime dependencies
  },
  "devDependencies": {
    "typescript": "^5",
    "ts-node": "^10",
    "copyfiles": "^2"
  }
}
```

**Regla de oro:**

- `npm run build` → ejecutar LOCALMENTE antes de desplegar
- `npm start` → ejecutar EN AZURE después de desplegar
- NO usar `npm run build` en producción

#### 3. **Startup Command: npm vs. node**

**Opción 1: Usando npm (RECOMENDADO)**

```bash
az webapp config set --startup-file "npm install --production && npm start"
```

**Ventajas:**

- ✅ Instala `node_modules` automáticamente
- ✅ Usa el script `start` definido en `package.json`
- ✅ Más flexible para cambios

**Opción 2: Usando node directamente**

```bash
az webapp config set --startup-file "node app.js"
```

**Desventajas:**

- ❌ Debes asegurar que `node_modules` esté en el ZIP (muy pesado)
- ❌ La ruta debe coincidir exactamente con donde está el `.js`

#### 4. **Variables de Entorno vs. Archivos `.env`**

**Importante:** Archivos `.env` NO funcionan en Azure App Service por defecto.

**Solución:** Usar App Settings en Azure:

```bash
# ✅ CORRECTO: Variables de entorno en Azure
az webapp config appsettings set \
  --settings VAR1="value1" VAR2="value2"

# ❌ INCORRECTO: Intentar usar .env desplegado
# Azure no lee archivos .env automáticamente
```

**En código, usar:**

```typescript
// Funciona tanto localmente (.env) como en Azure (App Settings)
import "dotenv/config";

const endpoint = process.env.CONFIGURATION__AZURECOSMOSDB__ENDPOINT;
```

#### 5. **Compilación de TypeScript y Source Maps**

**tsconfig.json recomendado para producción:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./",
    "sourceMap": true, // ✅ Útil para debugging
    "strict": true,
    "esModuleInterop": true
  },
  "exclude": ["node_modules", "dist"]
}
```

**Nota:** `sourceMap: true` genera archivos `.js.map` que permiten debuggear errores con líneas de código TypeScript original.

---

### 🚨 Checklist de Pre-Deployment

Antes de desplegar, verificar:

- [ ] `npm run build` compila sin errores
- [ ] `dist/` contiene archivos `.js` y `static/` copiado
- [ ] `package.json` NO tiene script `postinstall` que compile
- [ ] `app.ts` usa `join(__dirname, ...)` para rutas de archivos
- [ ] Variables de entorno configuradas en Azure App Settings
- [ ] Managed Identity habilitada y con role assignment en Cosmos DB
- [ ] Startup command configurado: `"npm install --production && npm start"`

---

### 📊 Comandos Útiles de Diagnóstico

```bash
# Ver configuración completa de la web app
az webapp config show --name $APP_NAME --resource-group $RG_NAME

# Ver variables de entorno (App Settings)
az webapp config appsettings list --name $APP_NAME --resource-group $RG_NAME

# Ver logs en tiempo real
az webapp log tail --name $APP_NAME --resource-group $RG_NAME

# Descargar todos los logs
az webapp log download --name $APP_NAME --resource-group $RG_NAME --log-file logs.zip

# Reiniciar la web app
az webapp restart --name $APP_NAME --resource-group $RG_NAME

# Ver estado del deployment
az webapp deployment list --name $APP_NAME --resource-group $RG_NAME

# SSH a la instancia (para debugging avanzado)
az webapp ssh --name $APP_NAME --resource-group $RG_NAME
```

---

## 📚 Recursos

- [Azure Cosmos DB Docs](https://learn.microsoft.com/azure/cosmos-db/)
- [Azure SDK for JavaScript](https://github.com/Azure/azure-sdk-for-js)
- [Express.js Documentation](https://expressjs.com/)
- [Fetch API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Azure App Service - Deploy Node.js](https://learn.microsoft.com/azure/app-service/quickstart-nodejs)

---

## 📝 Notas

- **Sin WebSockets:** Esta versión usa 100% HTTP REST (no Socket.io)
- **Arquitectura simple:** Backend y frontend en el mismo servidor Express
- **Producción:** Para producción real, considera separar frontend (CDN) y backend (API)
- **CORS:** Actualmente permite todos los orígenes (`*`). Restringe en producción.

---
