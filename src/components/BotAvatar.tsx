'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface BotAvatarProps {
  botId: string;
  size?: number;
  className?: string;
}

export default function BotAvatar({ botId, size = 40, className = '' }: BotAvatarProps) {
  const [useSvg, setUseSvg] = useState(true);
  
  // Extract the bot type from the botId (e.g., "waldorf-general-assistant" -> "general-assistant")
  const botType = botId.includes('-') ? botId.split('-').slice(1).join('-') : botId;
  
  // Try to load SVG first, fall back to PNG if SVG fails to load
  const svgPath = `/bot-avatars/${botType}.svg`;
  const pngPath = `/bot-avatars/${botType}.png`;
  
  // Handle SVG loading error
  const handleSvgError = () => {
    setUseSvg(false);
  };
  
  return (
    <div 
      className={`relative rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {useSvg ? (
        <object
          data={svgPath}
          type="image/svg+xml"
          className="w-full h-full"
          onError={handleSvgError}
        >
          <img
            src={pngPath}
            alt={`${botType} avatar`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // If PNG also fails, use a default avatar
              const img = document.createElement('img');
              img.src = '/bot-avatars/general-assistant.svg';
              img.alt = 'Default avatar';
              img.className = 'w-full h-full object-cover';
              const target = e.currentTarget;
              const parent = target.parentNode;
              if (parent) {
                parent.replaceChild(img, target);
              }
            }}
          />
        </object>
      ) : (
        <img
          src={pngPath}
          alt={`${botType} avatar`}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
} 