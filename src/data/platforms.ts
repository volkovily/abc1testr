import { Platform } from '../types';

const platforms: Platform[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    iconName: 'Youtube',
    maxSizeMB: 256 * 1024,
    requiresAuth: true
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    iconName: 'TikTok',
    maxSizeMB: 512,
    requiresAuth: true
  },
  {
    id: 'facebook',
    name: 'Facebook',
    iconName: 'Facebook',
    maxSizeMB: 10 * 1024,
    requiresAuth: true
  },
  {
    id: 'twitter',
    name: 'Twitter',
    iconName: 'Twitter',
    maxSizeMB: 512,
    requiresAuth: true
  },
];

export default platforms;