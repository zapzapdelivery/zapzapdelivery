'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/marketplace';
import { Loading } from '@/components/Loading/Loading';

export function CategoriesGrid() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('tipos_estabelecimento')
          .select('id, name')
          .order('name');
        
        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white h-32 rounded-xl shadow-sm animate-pulse" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-xl shadow-sm border border-gray-100">
        <p className="text-gray-500">Nenhuma categoria encontrada.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {categories.map((cat) => (
        <Link 
          key={cat.id} 
          href={`/estabelecimentos?category=${encodeURIComponent(cat.name)}`}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center gap-3 border border-gray-100 group hover:border-green-200"
        >
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 group-hover:bg-green-100 group-hover:scale-110 transition-all duration-300">
            <ShoppingBag size={24} />
          </div>
          <span className="font-medium text-gray-700 group-hover:text-green-700 transition-colors text-center line-clamp-1">
            {cat.name}
          </span>
        </Link>
      ))}
    </div>
  );
}
