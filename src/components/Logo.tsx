import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = 'w-8 h-8', 
  size,
  alt = '3awdli logo' 
}) => {
  return (
    <img
      src="/assets/logo.png"
      alt={alt}
      className={`object-contain ${className}`}
      style={size ? { width: size, height: size } : undefined}
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
};

