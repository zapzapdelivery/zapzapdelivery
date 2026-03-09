'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MarketplaceFooter } from '@/components/Footer/MarketplaceFooter';
import { TopTenSection } from '@/components/Marketplace/TopTenSection';
import { CategorySection } from '@/components/Marketplace/CategorySection';
import { PromotionalBanner } from '@/components/Marketplace/PromotionalBanner';
import { LocationModal } from '@/components/Marketplace/LocationModal';
import { marketplaceService } from '@/services/marketplaceService';
import { Category } from '@/types/marketplace';
import { MarketplaceHeader } from '@/components/Header/MarketplaceHeader';

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get('category');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await marketplaceService.getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to load categories', error);
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  // Determine what to show based on selection
  const showTopTen = !selectedCategory || selectedCategory === 'Os Tops 10';
  
  const visibleCategories = selectedCategory && selectedCategory !== 'Os Tops 10'
    ? categories.filter(c => c.name === selectedCategory)
    : categories;

  return (
    <>
      {/* Top 10 Section */}
      {showTopTen && (
        <div className="mt-4">
          <TopTenSection />
        </div>
      )}

      {/* Dynamic Category Sections */}
      {visibleCategories.map((category) => (
        <CategorySection 
          key={category.id} 
          categoryId={category.id} 
          categoryName={category.name} 
        />
      ))}

      {/* Promotional Banner */}
      <PromotionalBanner />
    </>
  );
}

export default function MarketplaceHome() {
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    // Check if location is already saved
    const savedUF = localStorage.getItem('user_uf');
    const savedCity = localStorage.getItem('user_city');

    if (!savedUF || !savedCity) {
      setIsLocationModalOpen(true);
    }
  }, []);

  return (
    <>
      <Suspense fallback={<div className="h-16 bg-white shadow-sm" />}>
        <MarketplaceHeader onOpenLocationModal={() => setIsLocationModalOpen(true)} />
      </Suspense>
      
      <LocationModal 
        isOpen={isLocationModalOpen} 
        onClose={() => setIsLocationModalOpen(false)}
        onLocationSelected={(uf, city) => {
          localStorage.setItem('user_city', city);
          localStorage.setItem('user_uf', uf);
          setIsLocationModalOpen(false);
          // Reload page to apply filter
          window.location.reload();
        }}
      />
      
      <main className="flex-grow w-full max-w-[1280px] mx-auto space-y-4 pb-16 px-4 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="py-12 text-center text-gray-500">Carregando...</div>}>
          <MarketplaceContent />
        </Suspense>
      </main>

      <MarketplaceFooter />
    </>
  );
}
