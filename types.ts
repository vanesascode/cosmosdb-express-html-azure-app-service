import { ItemDefinition } from '@azure/cosmos';

export type Emit = (message: string) => void;

export interface Product extends ItemDefinition {
    category: string;
    name: string;
    quantity: number;
    price: number;
    clearance: boolean;
}

// Tipo para crear un nuevo producto desde el formulario
export interface NewProductInput {
    name: string;
    category: string;
    quantity: number;
    price: number;
    clearance: boolean;
}