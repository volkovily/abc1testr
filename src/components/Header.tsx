import { ArrowRight } from 'lucide-react';
import React from 'react';
import UserMenu from './UserMenu';

const Header: React.FC = () => {
  const handleLogoClick = () => {
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        {/* Logo and Title - with refresh functionality */}
        <div className="flex items-center">
          <div 
            className="mr-2 flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm cursor-pointer"
            onClick={handleLogoClick}
            title="Start Over"
          >
            <ArrowRight size={18} />
          </div>
          <h1 
            className="text-lg font-semibold text-gray-900 cursor-pointer" 
            onClick={handleLogoClick}
            title="Start Over"
          >
            Volkov Publisher
          </h1>
        </div>
        {/* User Menu */}
        <div className="flex items-center space-x-3">
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default Header;
