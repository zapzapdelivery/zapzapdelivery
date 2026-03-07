'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { MapPin, Search, ChevronDown } from 'lucide-react';
import { CategoryPills } from '../Marketplace/CategoryPills';

export function MarketplaceHeader({ onOpenLocationModal }: { onOpenLocationModal: () => void }) {
  const [location, setLocation] = React.useState('SELECIONE A LOCALIZAÇÃO');

  React.useEffect(() => {
    // Load location from localStorage
    const uf = localStorage.getItem('user_uf');
    const city = localStorage.getItem('user_city');
    if (uf && city) {
      setLocation(`${city} - ${uf}`.toUpperCase());
    }
  }, []);

  return (
    <>
      <header className="w-full bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50 py-3">
        <div className="container mx-auto px-4 flex flex-col gap-4">
          
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

            {/* Center: Search Icon */}
            <div className="flex justify-center flex-1 mx-2 sm:mx-4">
              <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
                <Search size={20} />
              </button>
            </div>

            {/* Right: CTA */}
            <div>
              <Link
                href="/paineladmin?mode=register"
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
