'use client';

import React, { useEffect, useState } from 'react';
import { EstablishmentCard } from './EstablishmentCard';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { marketplaceService } from '@/services/marketplaceService';
import { Establishment } from '@/types/marketplace';

export function TopTenSection() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('sua região');
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('q')?.toLowerCase() || '';

  useEffect(() => {
    async function loadData() {
      try {
        const uf = localStorage.getItem('user_uf') || undefined;
        const city = localStorage.getItem('user_city') || undefined;
        
        if (city) {
          setLocationName(city);
        }

        const data = await marketplaceService.getTopTenEstablishments(uf, city);
        setEstablishments(data);
      } catch (error) {
        console.error('Failed to load top 10 establishments', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredEstablishments = establishments.filter(est => 
    est.name.toLowerCase().includes(searchTerm)
  );

  if (loading) {
    return (
      <section className="py-2 px-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </section>
    );
  }

  if (filteredEstablishments.length === 0) {
    return null;
  }

  return (
    <section className="py-2 px-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Os Tops 10</h2>
        <p className="text-gray-500 text-sm">Os favoritos de {locationName}</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredEstablishments.map((establishment) => (
          <div key={establishment.id} className="w-full">
            <EstablishmentCard establishment={establishment} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Link href="/categoria/ostops10" className="text-green-600 hover:text-green-700 font-bold text-sm flex items-center gap-1">
          Ver todos <ChevronRight size={16} />
        </Link>
      </div>
    </section>
  );
}
