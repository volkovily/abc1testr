import React from 'react';
import {
  Youtube,
  Facebook,
  Twitter,
  Music // TikTok
} from 'lucide-react';

interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

export const YoutubeIcon: React.FC<IconProps> = ({ className, size = 24, color = "#ff0000" }) => (
  <Youtube className={className} size={size} color={color} />
);

export const TikTokIcon: React.FC<IconProps> = ({ className, size = 24, color = "#6a76ac" }) => (
  <Music className={className} size={size} color={color} />
);

export const FacebookIcon: React.FC<IconProps> = ({ className, size = 24, color = "#1877f2" }) => (
  <Facebook className={className} size={size} color={color} />
);

export const TwitterIcon: React.FC<IconProps> = ({ className, size = 24, color = "#1da1f2" }) => (
  <Twitter className={className} size={size} color={color} />
);

const IconsByName: Record<string, React.FC<IconProps>> = {
  Youtube: YoutubeIcon,
  TikTok: TikTokIcon,
  Facebook: FacebookIcon,
  Twitter: TwitterIcon,
};

export default IconsByName;