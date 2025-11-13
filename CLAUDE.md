# CLAUDE.md - Proyecto TypeScript Azure Cosmos DB

## Resumen del Proyecto

Aplicación web Express TypeScript que demuestra el uso básico de **Azure Cosmos DB for NoSQL** usando el Azure SDK para Node.js. Es parte del quickstart oficial de Azure Cosmos DB.

## Arquitectura General

```
Cliente Web (Socket.io) <--> Express Server <--> Azure Cosmos DB (NoSQL)
```

La aplicación usa WebSockets (Socket.io) para comunicación en tiempo real entre el navegador y el servidor, permitiendo mostrar las operaciones de base de datos en vivo.

---

## Archivos Principales

### 1. [app.ts](app.ts) - Servidor Express

**Propósito**: Punto de entrada de la aplicación. Configura el servidor Express y maneja las conexiones WebSocket.

**Componentes clave**:

- **Express Server** (línea 12): Servidor HTTP básico
- **Socket.io Server** (línea 14-20): Configurado para WebSocket y polling con CORS habilitado
- **Rate Limiter** (línea 22-25): Limita a 100 requests por IP cada 15 minutos
- **Rutas**:
  - `GET /` (línea 27-29): Sirve [index.html](static/index.html)
  - Archivos estáticos de `/static`
- **WebSocket Events**:
  - `connection` (línea 37): Se conecta un cliente
  - `start` (línea 40-46): Inicia las operaciones de Cosmos DB y emite mensajes en tiempo real
  - `error` y `disconnect`: Manejo de errores

**Variables de entorno**:
- `PORT`: Puerto del servidor (default: 3000)

---

### 2. [cosmos.ts](cosmos.ts) - Cliente de Azure Cosmos DB

**Propósito**: Contiene toda la lógica de interacción con Azure Cosmos DB. Es el corazón de las operaciones CRUD.

#### Clase `DataClient`

**Método principal**: `start(emit: Emit)` (línea 14-30)
- Orquesta todas las operaciones de Cosmos DB en secuencia
- Usa el callback `emit` para enviar mensajes al cliente web en tiempo real

**Flujo de operaciones**:

1. **`createClient()`** (línea 32-48)
   - Crea el cliente de Cosmos DB
   - Usa `DefaultAzureCredential` para autenticación (Azure Identity)
   - Lee endpoint desde variable de entorno `CONFIGURATION__AZURECOSMOSDB__ENDPOINT`
   - **Autenticación**: AAD (Azure Active Directory) credentials

2. **`createContainer()`** (línea 50-66)
   - Obtiene referencia a la base de datos existente (default: "cosmicworks")
   - Obtiene referencia al contenedor existente (default: "products")
   - Variables de entorno:
     - `CONFIGURATION__AZURECOSMOSDB__DATABASENAME`
     - `CONFIGURATION__AZURECOSMOSDB__CONTAINERNAME`

3. **`createItemVerbose()`** (línea 68-90)
   - **Operación**: Upsert de un producto (Yamba Surfboard)
   - **ID**: `aaaaaaaa-0000-1111-2222-bbbbbbbbbbbb`
   - **Partition Key**: `gear-surf-surfboards`
   - Muestra respuesta detallada incluyendo:
     - Status code (200 = actualizado, 201 = creado)
     - Request Charge (RUs consumidas)
   - **Nota**: Usa `container.items.upsert()` que crea o reemplaza

4. **`createItemConcise()`** (línea 92-104)
   - Similar al anterior pero con sintaxis más concisa
   - Producto: Kiama Classic Surfboard
   - **ID**: `bbbbbbbb-1111-2222-3333-cccccccccccc`
   - Usa destructuring para obtener directamente el `resource`

5. **`readItem()`** (línea 106-119)
   - Lee un item específico por ID y Partition Key
   - Muestra el documento completo leído
   - Reporta status code y RU charge

6. **`queryItems()`** (línea 121-139)
   - Ejecuta una query SQL parametrizada
   - **Query**: `SELECT * FROM products p WHERE p.category = @category`
   - Usa `SqlQuerySpec` con parámetros para prevenir SQL injection
   - Itera sobre todos los resultados
   - Reporta RU charge total de la query

**Conceptos de Cosmos DB demostrados**:
- Upsert vs Create vs Read
- Partition Keys
- Request Units (RU) - medida de costo de operaciones
- Queries SQL parametrizadas
- `fetchAll()` para obtener todos los resultados

---

### 3. [types.ts](types.ts) - Definiciones de Tipos

**Tipos definidos**:

- **`Emit`** (línea 3): Tipo de función callback para enviar mensajes
  ```typescript
  type Emit = (message: string) => void
  ```

- **`Product`** (línea 5-11): Interfaz del modelo de datos
  - Extiende `ItemDefinition` de `@azure/cosmos` (proporciona `id`)
  - Campos:
    - `category: string` - Partition key
    - `name: string`
    - `quantity: number`
    - `price: number`
    - `clearance: boolean`

**Nota**: La `category` funciona como partition key en Cosmos DB para distribuir datos.

---

### 4. [package.json](package.json) - Configuración del Proyecto

**Scripts**:
- `build`: Compila TypeScript y copia archivos estáticos a `dist/`
- `start`: Ejecuta la versión compilada
- `dev`: Ejecuta directamente con ts-node (desarrollo)

**Dependencias clave**:
- `@azure/cosmos`: SDK de Cosmos DB
- `@azure/identity`: Autenticación con Azure (DefaultAzureCredential)
- `express`: Framework web
- `socket.io`: WebSockets en tiempo real
- `dotenv`: Variables de entorno
- `express-rate-limit`: Protección contra abuso

**DevDependencies**:
- `typescript`: Compilador TS
- `ts-node`: Ejecución directa de TS
- `copyfiles`: Copia archivos estáticos al build

---

### 5. [tsconfig.json](tsconfig.json) - Configuración TypeScript

**Configuración destacada**:
- Target: ES2016
- Module: CommonJS
- Strict mode activado
- Source maps habilitados (para debugging)
- Output: `dist/`
- Excluye: `socket.ts`, `node_modules`, `dist/`

---

## Frontend

### [static/index.html](static/index.html)
- Interfaz Bootstrap 5 con tema dark
- Muestra título y consola para output
- Botón "Run" para ejecutar operaciones
- Enlaces a documentación de Microsoft Learn

### [static/socket.js](static/socket.js)
- Cliente Socket.io usando jQuery
- Se conecta automáticamente al servidor
- Escucha evento `new_message` y lo muestra en la consola
- Emite evento `start` para iniciar operaciones de Cosmos DB
- Botón para ejecutar operaciones múltiples veces

---

## Flujo de Datos Completo

1. Usuario carga la página web
2. Cliente Socket.io se conecta automáticamente
3. Cliente emite evento `start`
4. Servidor recibe `start` y crea instancia de `DataClient`
5. `DataClient.start()` ejecuta operaciones:
   - Conecta con Cosmos DB usando Azure Identity
   - Obtiene referencias a database y container
   - Crea/actualiza dos productos (upsert)
   - Lee un producto específico
   - Ejecuta query para productos de una categoría
6. Cada operación emite mensajes con `emit()`
7. Servidor reenvía mensajes a todos los clientes conectados vía `io.emit('new_message')`
8. Cliente actualiza la consola HTML en tiempo real

---

## Variables de Entorno Requeridas

```bash
# Endpoint de Cosmos DB
CONFIGURATION__AZURECOSMOSDB__ENDPOINT=https://<tu-cuenta>.documents.azure.com:443/

# Opcionales (tienen defaults)
CONFIGURATION__AZURECOSMOSDB__DATABASENAME=cosmicworks
CONFIGURATION__AZURECOSMOSDB__CONTAINERNAME=products

# Puerto del servidor
PORT=3000
```

**Nota**: La autenticación usa `DefaultAzureCredential`, por lo que necesitas estar autenticado con Azure CLI o tener variables de entorno configuradas.

---

## Conceptos Clave de Azure Cosmos DB

### Partition Key
- En este ejemplo: `category`
- Distribuye datos físicamente para escalabilidad
- Debe especificarse al leer/escribir items individuales

### Request Units (RU)
- Medida de throughput en Cosmos DB
- Cada operación reporta RUs consumidas
- Se usa para facturación y performance tuning

### Upsert vs Create
- **Upsert**: Crea si no existe, actualiza si existe
- Útil para operaciones idempotentes

### Queries SQL
- Cosmos DB usa sintaxis similar a SQL
- Queries parametrizadas previenen inyección
- `fetchAll()` obtiene todos los resultados de una vez

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo (hot reload)
npm run dev

# Build producción
npm run build

# Ejecutar versión compilada
npm start
```

---

## Seguridad

1. **Rate Limiting**: Protege contra abuso (100 req/15min)
2. **CORS**: Configurado para permitir todos los orígenes (ajustar en producción)
3. **Azure Identity**: Usa DefaultAzureCredential (más seguro que connection strings)
4. **SQL Parametrizado**: Previene inyección SQL en queries

---

## Posibles Mejoras

1. Manejo de errores más robusto (try-catch)
2. Logging estructurado
3. Tests unitarios e integración
4. Validación de datos de entrada
5. Configuración de CORS más restrictiva
6. Desconexión limpia de WebSockets
7. Paginación en queries grandes
8. Retry logic para operaciones fallidas

---

## Recursos Adicionales

- [Documentación Azure Cosmos DB for NoSQL](https://learn.microsoft.com/azure/cosmos-db/nosql/)
- [Azure SDK for JavaScript/TypeScript](https://github.com/Azure/azure-sdk-for-js)
- [Socket.io Documentation](https://socket.io/)
