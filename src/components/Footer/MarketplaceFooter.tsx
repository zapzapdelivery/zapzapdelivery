import React from 'react';
import Link from 'next/link';
import { Facebook, Instagram, Twitter, MapPin } from 'lucide-react';

export function MarketplaceFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
      <div className="w-full max-w-[1280px] mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 text-gray-800 font-bold text-xl no-underline hover:text-green-600 transition-colors">
              <div className="text-green-500">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 12L12 22L22 12L12 2Z" />
                </svg>
              </div>
              <span className="text-gray-900 tracking-tight font-extrabold text-xl">ZAPZAP<span className="text-green-500">DELIVERY</span></span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              A plataforma de delivery que conecta os melhores estabelecimentos de Vila Rica aos seus clientes.
            </p>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <MapPin size={16} />
              <span>Vila Rica - MT</span>
            </div>
            <div className="flex space-x-4 pt-2">
              <a href="#" className="text-gray-400 hover:text-green-500 transition-colors bg-gray-50 p-2 rounded-full">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-green-500 transition-colors bg-gray-50 p-2 rounded-full">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-green-500 transition-colors bg-gray-50 p-2 rounded-full">
                <Twitter size={20} />
              </a>
            </div>
          </div>

          {/* Explore Column */}
          <div>
            <h3 className="text-gray-900 font-bold mb-4">Explore</h3>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><Link href="/estabelecimentos" className="hover:text-green-600 transition-colors">Categorias</Link></li>
              <li><Link href="/estabelecimentos?top10=true" className="hover:text-green-600 transition-colors">Tops 10</Link></li>
              <li><Link href="/promocoes" className="hover:text-green-600 transition-colors">Promoções</Link></li>
              <li><Link href="/estabelecimentos" className="hover:text-green-600 transition-colors">Ver Todos</Link></li>
            </ul>
          </div>

          {/* For Establishments Column */}
          <div>
            <h3 className="text-gray-900 font-bold mb-4">Para Estabelecimentos</h3>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><Link href="/paineladmin?mode=register" className="hover:text-green-600 transition-colors">Cadastre seu restaurante</Link></li>
              <li><Link href="/paineladmin" className="hover:text-green-600 transition-colors">Portal do Parceiro</Link></li>
              <li><Link href="/guia-sucesso" className="hover:text-green-600 transition-colors">Guia do Sucesso</Link></li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="text-gray-900 font-bold mb-4">Suporte</h3>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><Link href="/ajuda" className="hover:text-green-600 transition-colors">Central de Ajuda</Link></li>
              <li><Link href="/termos" className="hover:text-green-600 transition-colors">Termos de Uso</Link></li>
              <li><Link href="/privacidade" className="hover:text-green-600 transition-colors">Privacidade</Link></li>
              <li><Link href="/contato" className="hover:text-green-600 transition-colors">Fale Conosco</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8 text-center">
          <p className="text-gray-400 text-xs">
            &copy; {currentYear} ZAPZAPDELIVERY. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
