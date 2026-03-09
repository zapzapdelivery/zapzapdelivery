'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Search, ChevronDown } from 'lucide-react';
import { CategoryPills } from '../Marketplace/CategoryPills';

export function MarketplaceHeader({ onOpenLocationModal }: { onOpenLocationModal: () => void }) {
  const [location, setLocation] = React.useState('SELECIONE A LOCALIZAÇÃO');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = React.useState(searchParams.get('q') || '');

  React.useEffect(() => {
    // Load location from localStorage
    const uf = localStorage.getItem('user_uf');
    const city = localStorage.getItem('user_city');
    if (uf && city) {
      setLocation(`${city} - ${uf}`.toUpperCase());
    }
  }, []);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    // Use replace to update URL without adding to history stack, keeping user on same page context
    // This allows the page component to read the 'q' param and filter results
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <header className="w-full bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50 py-3">
        <div className="w-full max-w-[1280px] mx-auto px-4 flex flex-col gap-4">
          
          {/* Top Row: Logo Centered */}
          <div className="flex justify-center w-full">
            <Link href="/" className="flex items-center gap-1 sm:gap-2 text-gray-800 font-bold text-xl no-underline hover:text-green-600 transition-colors">
              <span className="text-black tracking-tight font-extrabold text-2xl">ZAPZAP<span className="text-green-500">DELIVERY</span></span>
            </Link>
          </div>

          {/* Bottom Row: Location, Search, CTA */}
          <div className="flex items-center justify-between w-full">
            
            {/* Left: Location */}
            <div 
              className="flex items-center gap-0.5 cursor-pointer hover:bg-gray-50 p-1 -ml-1 rounded-lg transition-colors group active:bg-gray-100"
              onClick={onOpenLocationModal}
            >
              <MapPin size={16} className="text-green-500 fill-current shrink-0" />
              <span className="text-[10px] sm:text-sm font-bold text-green-500 max-w-[100px] sm:max-w-xs truncate leading-tight tracking-wide">{location}</span>
              <ChevronDown size={14} className="text-green-500 shrink-0" />
            </div>

            {/* Center: Search Input */}
            <div className="flex justify-center flex-1 mx-2 sm:mx-4 relative">
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all placeholder-gray-500"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Right: CTA */}
            <div>
              <Link
                href="/novoestabelecimento"
                className="bg-green-500 text-white px-4 py-2 rounded-full font-bold text-xs sm:text-sm hover:bg-green-600 transition-colors shadow-sm whitespace-nowrap"
              >
                CADASTRE-SE
              </Link>
            </div>

          </div>
        </div>
      </header>
      <Suspense fallback={<div className="h-12 bg-gray-50 border-b border-gray-100" />}>
        <CategoryPills />
      </Suspense>
    </>
  );
}
