
'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';

interface LocationModalProps {
  onLocationSelected?: (uf: string, city: string) => void;
}

const ESTADOS_BRASIL: Record<string, string> = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
  'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
  'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
  'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
  'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
  'SE': 'Sergipe', 'TO': 'Tocantins'
};

export function LocationModal({ onLocationSelected, isOpen, onClose }: LocationModalProps & { isOpen: boolean; onClose: () => void }) {
  const [locations, setLocations] = useState<Record<string, string[]>>({});
  const [selectedUF, setSelectedUF] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchLocations();
      // Load current selection if available
      const savedUF = localStorage.getItem('user_uf');
      const savedCity = localStorage.getItem('user_city');
      if (savedUF) setSelectedUF(savedUF);
      if (savedCity) setSelectedCity(savedCity);
    }
  }, [isOpen]);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/marketplace/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedUF && selectedCity) {
      localStorage.setItem('user_uf', selectedUF);
      localStorage.setItem('user_city', selectedCity);
      
      if (onLocationSelected) {
        onLocationSelected(selectedUF, selectedCity);
      }
      
      onClose();
      // Reload page to ensure filters apply globally
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <MapPin size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Onde você está?</h2>
          <p className="text-gray-500 mt-2 text-sm">Para mostrar os melhores estabelecimentos perto de você, precisamos saber sua localização.</p>
        </div>

        <div className="space-y-4">
          {/* State Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Estado</label>
            <div className="relative">
              <select
                value={selectedUF}
                onChange={(e) => {
                  setSelectedUF(e.target.value);
                  setSelectedCity('');
                }}
                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded-xl focus:outline-none focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all cursor-pointer shadow-sm"
                disabled={loading}
              >
                <option value="">Selecione o estado</option>
                {Object.keys(locations).map((uf) => (
                  <option key={uf} value={uf}>{uf} - {ESTADOS_BRASIL[uf] || uf}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          {/* City Dropdown - Hidden/Disabled until state is selected */}
          <div className={`transition-all duration-500 ease-in-out ${selectedUF ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none absolute w-full'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Cidade</label>
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded-xl focus:outline-none focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all cursor-pointer shadow-sm"
                disabled={!selectedUF}
              >
                <option value="">Selecione a cidade</option>
                {selectedUF && locations[selectedUF]?.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!selectedUF || !selectedCity}
            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all duration-300 mt-8 flex items-center justify-center gap-2 transform
              ${selectedUF && selectedCity 
                ? 'bg-green-600 hover:bg-green-700 hover:shadow-green-200 hover:-translate-y-0.5 active:scale-95' 
                : 'bg-gray-300 cursor-not-allowed opacity-70'}`}
          >
            Confirmar Localização
          </button>
        </div>
      </div>
    </div>
  );
}
