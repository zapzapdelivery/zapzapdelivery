'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { marketplaceService } from '@/services/marketplaceService';
import { Category } from '@/types/marketplace';

export function CategoryPills() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const selectedCategory = searchParams.get('category');

  useEffect(() => {
    async function loadCategories() {
      const data = await marketplaceService.getCategories();
      setCategories(data);
    }
    loadCategories();
  }, []);

  const handleCategoryClick = (categoryName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1');
    if (selectedCategory === categoryName) {
      params.delete('category'); // Toggle off
    } else {
      params.set('category', categoryName);
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="w-full bg-white border-b border-gray-100 py-3 sticky top-16 z-40 shadow-sm overflow-x-auto no-scrollbar">
      <div className="container mx-auto px-4 flex items-center justify-start md:justify-center gap-3 min-w-max">
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('category');
            router.push(`/?${params.toString()}`);
          }}
          className={`px-6 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
            !selectedCategory
              ? 'bg-green-500 text-white shadow-md transform scale-105'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Os Tops 10
        </button>
        
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.name)}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
              selectedCategory === cat.name
                ? 'bg-green-500 text-white shadow-md transform scale-105'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
