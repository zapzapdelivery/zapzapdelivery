
import { Establishment, Category } from '@/types/marketplace';

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Padarias' },
  { id: 'cat-2', name: 'Pizzarias' },
  { id: 'cat-3', name: 'Hamburguerias' },
  { id: 'cat-4', name: 'Japonesa' },
  { id: 'cat-5', name: 'Farmácias' },
  { id: 'cat-6', name: 'Mercados' },
];

export const MOCK_ESTABLISHMENTS: (Establishment & { address: string; isTop10: boolean; categoryId: string })[] = [
  // Top 10 Mock Data
  {
    id: '1',
    name: 'Restaurante Central',
    logoUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&auto=format&fit=crop&q=60', // Pizza
    address: 'Rua Principal, 123',
    url_cardapio: 'restaurante-central',
    isTop10: true,
    categoryId: 'cat-2',
    tipos_estabelecimento: { id: 'cat-2', name: 'Pizzarias' }
  },
  {
    id: '2',
    name: 'Pizzaria Bella',
    logoUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&auto=format&fit=crop&q=60', // Interior
    address: 'Av. Brasil, 456',
    url_cardapio: 'pizzaria-bella',
    isTop10: true,
    categoryId: 'cat-2',
    tipos_estabelecimento: { id: 'cat-2', name: 'Pizzarias' }
  },
  {
    id: '3',
    name: 'Burger House',
    logoUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60', // Burger
    address: 'Rua das Flores, 789',
    url_cardapio: 'burger-house',
    isTop10: true,
    categoryId: 'cat-3',
    tipos_estabelecimento: { id: 'cat-3', name: 'Hamburguerias' }
  },
  {
    id: '4',
    name: 'Sushi Zen',
    logoUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=60', // Sushi
    address: 'Praça da Matriz, 10',
    url_cardapio: 'sushi-zen',
    isTop10: true,
    categoryId: 'cat-4',
    tipos_estabelecimento: { id: 'cat-4', name: 'Japonesa' }
  },
  {
    id: '5',
    name: 'Padaria Pão de Mel',
    logoUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=60', // Bakery/Shelves
    address: 'Av. MT, 100',
    url_cardapio: 'padaria-pao-de-mel',
    isTop10: true,
    categoryId: 'cat-1',
    tipos_estabelecimento: { id: 'cat-1', name: 'Padarias' }
  },
  
  // Hamburguerias Mock Data
  {
    id: '6',
    name: 'Monster Burger',
    logoUrl: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=800&auto=format&fit=crop&q=60',
    address: 'Rua Oeste, 55',
    url_cardapio: 'monster-burger',
    isTop10: false,
    categoryId: 'cat-3',
    tipos_estabelecimento: { id: 'cat-3', name: 'Hamburguerias' }
  },
  {
    id: '7',
    name: 'Retrô Grill',
    logoUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=60',
    address: 'Av. Central, 900',
    url_cardapio: 'retro-grill',
    isTop10: false,
    categoryId: 'cat-3',
    tipos_estabelecimento: { id: 'cat-3', name: 'Hamburguerias' }
  },
  {
    id: '8',
    name: 'The Big Boss',
    logoUrl: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800&auto=format&fit=crop&q=60',
    address: 'Rua Sul, 22',
    url_cardapio: 'the-big-boss',
    isTop10: false,
    categoryId: 'cat-3',
    tipos_estabelecimento: { id: 'cat-3', name: 'Hamburguerias' }
  },
  {
    id: '9',
    name: 'Smash Point',
    logoUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60',
    address: 'Beco da Comida, 01',
    url_cardapio: 'smash-point',
    isTop10: false,
    categoryId: 'cat-3',
    tipos_estabelecimento: { id: 'cat-3', name: 'Hamburguerias' }
  },
  {
    id: '10',
    name: 'Craft Burgers',
    logoUrl: 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=800&auto=format&fit=crop&q=60',
    address: 'Av. Norte, 1500',
    url_cardapio: 'craft-burgers',
    isTop10: false,
    categoryId: 'cat-3',
    tipos_estabelecimento: { id: 'cat-3', name: 'Hamburguerias' }
  }
];
