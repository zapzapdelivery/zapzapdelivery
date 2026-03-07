'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MarketplaceHeader } from '@/components/Header/MarketplaceHeader';
import { MarketplaceFooter } from '@/components/Footer/MarketplaceFooter';
import { EstablishmentCard } from '@/components/Marketplace/EstablishmentCard';
import { marketplaceService } from '@/services/marketplaceService';
import { Establishment, Category } from '@/types/marketplace';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [categoryName, setCategoryName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Helper function to create slug (same as in CategorySection)
  const createSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const uf = localStorage.getItem('user_uf') || undefined;
        const city = localStorage.getItem('user_city') || undefined;
        
        // Fetch all categories to find the matching slug (needed for both cases)
        const categories = await marketplaceService.getCategories();

        if (id === 'ostops10' || id === 'top-10') {
          setCategoryName('Os Tops 10');
          const data = await marketplaceService.getTopTenEstablishments(uf, city);
          setEstablishments(data);
        } else {
          // Try to find by slug first
          let category = categories.find(c => createSlug(c.name) === id);
          
          // If not found by slug, try by ID (legacy support)
          if (!category) {
             category = categories.find(c => c.id === id);
          }
          
          if (category) {
            setCategoryName(category.name);
            const data = await marketplaceService.getEstablishments(category.id, uf, city);
            setEstablishments(data);
          } else {
             setCategoryName('Categoria não encontrada');
             setEstablishments([]);
          }
        }
      } catch (error) {
        console.error('Failed to load category data', error);
      } finally {
        setLoading(false);
      }
    }
    
    if (id) {
      loadData();
    }
  }, [id]);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <MarketplaceHeader />
      
      <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-gray-600 hover:text-green-600 mb-4 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Voltar para o início
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900">
            {loading ? <span className="animate-pulse bg-gray-200 h-8 w-48 block rounded"></span> : categoryName}
          </h1>
          <p className="text-gray-500 mt-1">
            {loading 
              ? <span className="animate-pulse bg-gray-200 h-4 w-32 block rounded mt-2"></span> 
              : `${establishments.length} estabelecimentos encontrados`
            }
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-80 bg-gray-100 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : (
          <>
            {establishments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {establishments.map((establishment) => (
                  <div key={establishment.id} className="w-full">
                    <EstablishmentCard establishment={establishment} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-gray-50 rounded-xl">
                <span className="text-4xl block mb-4">🏪</span>
                <h3 className="text-xl font-medium text-gray-900">Nenhum estabelecimento encontrado</h3>
                <p className="text-gray-500 mt-2">Tente buscar em outra categoria.</p>
              </div>
            )}
          </>
        )}
      </main>

      <MarketplaceFooter />
    </div>
  );
}
