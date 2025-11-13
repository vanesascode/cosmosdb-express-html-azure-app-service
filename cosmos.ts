import { DefaultAzureCredential } from "@azure/identity";
import {
  Container,
  CosmosClient,
  Database,
  FeedResponse,
  ItemResponse,
  SqlQuerySpec,
} from "@azure/cosmos";
import { randomUUID } from "crypto";

import { Emit, Product, NewProductInput } from "./types";

export class DataClient {
  private client: CosmosClient | null = null;
  private container: Container | null = null;

  // Inicializa la conexión con Cosmos DB
  async initialize(): Promise<void> {
    if (!this.client) {
      this.client = await this.createClient();
    }
    if (!this.container) {
      this.container = await this.createContainer(this.client);
    }
  }

  // Demo inicial - muestra las capacidades básicas
  async start(emit: Emit) {
    await this.initialize();

    emit("Current Status:\tStarting demo...");

    await this.createItemVerbose(emit, this.container!);
    await this.createItemConcise(emit, this.container!);
    await this.readItem(emit, this.container!);
    await this.queryItems(emit, this.container!);

    emit("Current Status:\tDemo complete!");
  }

  // Crea el cliente de Cosmos DB
  async createClient(): Promise<CosmosClient> {
    const endpoint = process.env.CONFIGURATION__AZURECOSMOSDB__ENDPOINT;

    if (!endpoint) {
      throw new Error('Missing CONFIGURATION__AZURECOSMOSDB__ENDPOINT in .env file');
    }

    // Opción 1: Azure AD Authentication (requiere az login)
    // Tu Cosmos DB tiene deshabilitada la autenticación por key
    console.log('Using Azure AD authentication (DefaultAzureCredential)');
    const credential = new DefaultAzureCredential();
    return new CosmosClient({
      endpoint,
      aadCredentials: credential,
    });

    // Nota: Si quieres usar Key o Connection String, necesitas habilitar
    // "Local Authorization" en tu Cosmos DB desde Azure Portal
  }

  // Obtiene el contenedor de productos
  async createContainer(client: CosmosClient): Promise<Container> {
    const databaseName: string =
      process.env.CONFIGURATION__AZURECOSMOSDB__DATABASENAME ?? "cosmicworks";
    const database: Database = client.database(databaseName);

    const containerName: string =
      process.env.CONFIGURATION__AZURECOSMOSDB__CONTAINERNAME ?? "products";
    const container: Container = database.container(containerName);

    return container;
  }

  // OPERACIONES CRUD REALES

  // Lista todos los productos
  async listAllProducts(): Promise<Product[]> {
    await this.initialize();

    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM products p ORDER BY p._ts DESC",
    };

    const response: FeedResponse<Product> = await this.container!.items
      .query<Product>(querySpec)
      .fetchAll();

    return response.resources;
  }

  // Crea un nuevo producto desde el formulario
  async createProduct(input: NewProductInput): Promise<Product> {
    await this.initialize();

    const newProduct: Product = {
      id: randomUUID(),
      category: input.category,
      name: input.name,
      quantity: input.quantity,
      price: input.price,
      clearance: input.clearance,
    };

    const response: ItemResponse<Product> = await this.container!.items.create<Product>(
      newProduct
    );

    console.log(`Created product: ${newProduct.name} (RU charge: ${response.requestCharge})`);

    return response.resource!;
  }

  // Elimina un producto por ID
  async deleteProduct(id: string, category: string): Promise<void> {
    await this.initialize();

    const response = await this.container!.item(id, category).delete();
    console.log(`Deleted product: ${id} (RU charge: ${response.requestCharge})`);
  }

  // Actualiza un producto existente
  async updateProduct(product: Product): Promise<Product> {
    await this.initialize();

    const response: ItemResponse<Product> = await this.container!.items.upsert<Product>(
      product
    );

    console.log(`Updated product: ${product.name} (RU charge: ${response.requestCharge})`);

    return response.resource!;
  }

  // Busca productos por categoría
  async getProductsByCategory(category: string): Promise<Product[]> {
    await this.initialize();

    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM products p WHERE p.category = @category ORDER BY p._ts DESC",
      parameters: [
        {
          name: "@category",
          value: category,
        },
      ],
    };

    const response: FeedResponse<Product> = await this.container!.items
      .query<Product>(querySpec)
      .fetchAll();

    return response.resources;
  }

  // MÉTODOS ORIGINALES DE DEMO

  async createItemVerbose(emit: Emit, container: Container) {
    var item: Product = {
      id: "aaaaaaaa-0000-1111-2222-bbbbbbbbbbbb",
      category: "gear-surf-surfboards",
      name: "Yamba Surfboard",
      quantity: 12,
      price: 850.0,
      clearance: false,
    };

    var response: ItemResponse<Product> = await container.items.upsert<Product>(
      item
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      emit(`Upserted item:\t${JSON.stringify(response.resource)}`);
    }
    emit(`Status code:\t${response.statusCode}`);
    emit(`Request charge:\t${response.requestCharge}`);
  }

  async createItemConcise(emit: Emit, container: Container) {
    var item: Product = {
      id: "bbbbbbbb-1111-2222-3333-cccccccccccc",
      category: "gear-surf-surfboards",
      name: "Kiama Classic Surfboard",
      quantity: 25,
      price: 790.0,
      clearance: true,
    };

    var { resource } = await container.items.upsert<Product>(item);
    emit(`Upserted item:\t${JSON.stringify(resource)}`);
  }

  async readItem(emit: Emit, container: Container) {
    var id = "aaaaaaaa-0000-1111-2222-bbbbbbbbbbbb";
    var partitionKey = "gear-surf-surfboards";

    var response: ItemResponse<Product> = await container
      .item(id, partitionKey)
      .read<Product>();
    var read_item: Product = response.resource!;

    emit(`Read item id:\t${read_item?.id}`);
    emit(`Read item:\t${JSON.stringify(read_item)}`);
    emit(`Status code:\t${response.statusCode}`);
    emit(`Request charge:\t${response.requestCharge}`);
  }

  async queryItems(emit: Emit, container: Container) {
    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM products p WHERE p.category = @category",
      parameters: [
        {
          name: "@category",
          value: "gear-surf-surfboards",
        },
      ],
    };

    var response: FeedResponse<Product> = await container.items
      .query<Product>(querySpec)
      .fetchAll();
    for (var item of response.resources) {
      emit(`Found item:\t${item.name}\t${item.id}`);
    }
    emit(`Request charge:\t${response.requestCharge}`);
  }
}
