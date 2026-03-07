'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function PromotionalBanner() {
  const [locationName, setLocationName] = useState('Vila Rica');

  useEffect(() => {
    const city = localStorage.getItem('user_city');
    if (city) {
      setLocationName(city);
    }
  }, []);

  return (
    <section className="py-12">
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between relative overflow-hidden shadow-sm border border-green-100">
        
        {/* Text Content */}
        <div className="z-10 md:w-1/2 mb-8 md:mb-0 md:pr-8">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
            Faça seu negócio crescer com o <br/>
            <span className="text-green-500">ZAPZAPDELIVERY</span>
          </h2>
          <p className="text-gray-600 text-lg mb-8 max-w-lg leading-relaxed">
            Milhares de clientes em {locationName} estão esperando pelo seu cardápio. 
            Cadastre-se agora e comece a vender hoje mesmo!
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              href="/paineladmin?mode=register"
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-green-200 text-center"
            >
              Cadastre seu estabelecimento
            </Link>
            <Link 
              href="/parceiros"
              className="bg-white border-2 border-green-500 text-green-600 font-bold py-3.5 px-8 rounded-xl hover:bg-green-50 transition-colors text-center"
            >
              Saiba mais
            </Link>
          </div>
        </div>

        {/* Image/Illustration */}
        <div className="relative md:w-1/2 flex justify-center md:justify-end">
          <div className="relative w-72 h-72 md:w-96 md:h-96 bg-orange-300 rounded-3xl shadow-2xl transform rotate-2 flex items-center justify-center overflow-hidden border-[6px] border-white">
             <Image
               src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=800&auto=format&fit=crop&q=60" // Woman with tablet/tech
               alt="Parceiro ZapZap"
               fill
               className="object-cover"
             />
          </div>
        </div>
      </div>
    </section>
  );
}
