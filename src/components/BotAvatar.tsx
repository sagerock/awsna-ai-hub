'use client';

import { useState } from 'react';

interface BotAvatarProps {
  botId: string;
  size?: number;
  className?: string;
}

export default function BotAvatar({ botId, size = 40, className = '' }: BotAvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  // Extract the bot type from the botId (e.g., "waldorf-general-assistant" -> "general-assistant")
  const botType = botId.includes('-') ? botId.split('-').slice(1).join('-') : botId;
  
  // Try to load SVG first, fall back to PNG, then to default
  const svgPath = `/bot-avatars/${botType}.svg`;
  const pngPath = `/bot-avatars/${botType}.png`;
  const defaultPath = `/bot-avatars/general-assistant.svg`;
  
  // Handle image loading error
  const handleImageError = () => {
    setImageError(true);
  };
  
  return (
    <div 
      className={`relative rounded-full overflow-hidden flex items-center justify-center bg-indigo-100 ${className}`}
      style={{ width: size, height: size }}
    >
      {!imageError ? (
        <img
          src={svgPath}
          alt={`${botType} avatar`}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
      ) : (
        <img
          src={defaultPath}
          alt="Default avatar"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Final fallback - just show initials
            const target = e.currentTarget;
            const parent = target.parentNode as HTMLElement;
            if (parent) {
              const initials = botType.split('-').map(word => word.charAt(0).toUpperCase()).join('').slice(0, 2);
              parent.innerHTML = `<span class="text-indigo-600 font-semibold" style="font-size: ${size * 0.4}px">${initials}</span>`;
            }
          }}
        />
      )}
    </div>
  );
} 