import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Establishment } from '@/types/marketplace';
import { MapPin, Star } from 'lucide-react';

interface EstablishmentCardProps {
  establishment: Establishment;
}

export function EstablishmentCard({ establishment }: EstablishmentCardProps) {
  // Logic to determine the correct URL
  // If url_cardapio is a full URL (http/https), use it directly
  // Otherwise, fallback to the internal route using ID
  const isFullUrl = establishment.url_cardapio?.startsWith('http');
  
  const cardapioUrl = isFullUrl
    ? establishment.url_cardapio!
    : `/estabelecimentos/cardapio/${establishment.url_cardapio || establishment.id}`;

  const targetProps = isFullUrl ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  // Mock rating data
  const rating = (Math.random() * (5.0 - 4.0) + 4.0).toFixed(1);
  const reviewCount = Math.floor(Math.random() * (500 - 50) + 50);

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 overflow-hidden flex flex-row sm:flex-col h-auto sm:h-full group">
      {/* Image Section - Landscape Ratio */}
      <div className="relative w-28 sm:w-full h-24 sm:h-48 bg-gray-50 shrink-0 overflow-hidden">
        {establishment.logoUrl ? (
          <Image
            src={establishment.logoUrl}
            alt={establishment.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 112px, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
            <span className="text-2xl sm:text-4xl font-light mb-1 sm:mb-2">🍽️</span>
            <span className="text-xs sm:text-sm font-medium">Sem imagem</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-2 sm:p-4 flex flex-col flex-grow justify-between min-w-0">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-gray-900 mb-0.5 sm:mb-1 line-clamp-2 group-hover:text-green-600 transition-colors leading-tight min-h-[2.5rem] flex items-center" title={establishment.name}>
            {establishment.name}
          </h3>
          
          <div className="flex items-center gap-1 text-gray-500 text-[10px] sm:text-sm mb-0.5 sm:mb-2">
            <MapPin size={14} className="text-gray-400 flex-shrink-0" />
            <span className="line-clamp-1">{establishment.address || 'Vila Rica - MT'}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs sm:text-sm mb-2 sm:mb-4">
            <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
            <span className="font-bold text-gray-900">{rating}</span>
            <span className="text-gray-400">({reviewCount}+)</span>
          </div>
        </div>

        <div className="mt-2 sm:mt-auto hidden sm:block">
          <Link
            href={cardapioUrl}
            {...targetProps}
            className="block w-full bg-green-500 hover:bg-green-600 text-white text-center font-bold text-sm py-2 rounded-lg transition-colors shadow-sm active:scale-[0.98]"
          >
            Acessar Cardápio
          </Link>
        </div>
        
        {/* Mobile-only link (entire card is clickable via absolute overlay or just make the title link, but here we keep simple) 
            Actually, for mobile, usually the whole card is clickable. 
            Let's add a mobile-visible button or just let the user click. 
            The user asked for "mobile version... with all features".
            In mobile lists, buttons often clutter. Let's make a small button or just reliance on the link.
        */}
        <div className="mt-auto sm:hidden w-full flex justify-end">
           <Link
            href={cardapioUrl}
            {...targetProps}
            className="bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors shadow-sm active:scale-95 flex items-center gap-1"
          >
            Ver Cardápio
          </Link>
        </div>
      </div>
    </div>
  );
}
