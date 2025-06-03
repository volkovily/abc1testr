import { useState, useCallback } from 'react';
import { SelectedPlatform, PlatformUploadResult } from '../types';
import { uploadTwitterPost } from '../services/twitterApiService';
import { createFacebookPost, uploadFacebookPhoto } from '../services/facebookApiService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface PostPayload {
  pageId?: string;
  message: string;
  imageFile?: File;
  videoFile?: File;
  published?: boolean;
  scheduledPublishTime?: number;
}

export function usePostPublisher() {
  const [results, setResults] = useState<Record<string, PlatformUploadResult>>({});

  const updateResult = (platformId: string, data: Partial<PlatformUploadResult>) => {
    setResults(prev => {
      const current = prev[platformId] || { status: 'pending', progress: 0 };
      return { ...prev, [platformId]: { ...current, ...data } };
    });
  };

  const publishSingle = useCallback(async (
    platform: SelectedPlatform,
    payload: PostPayload
  ) => {
    const platformId = platform.id;
    updateResult(platformId, { status: 'uploading', progress: 0, error: undefined });
    try {
      const token = localStorage.getItem('accessToken');
      
      if (platformId === 'facebook') {
        if (payload.imageFile) {
          const result = await uploadFacebookPhoto(
            payload.imageFile,
            {
              pageId: payload.pageId || '',
              message: payload.message,
              published: payload.published,
              scheduledPublishTime: payload.scheduledPublishTime
            },
            token || undefined
          );
          
          if ('error' in result) {
            throw new Error(result.error);
          }
          
          updateResult(platformId, { 
            status: 'success', 
            videoId: result.photoId, 
            videoUrl: result.postId ? `https://facebook.com/${result.postId}` : undefined, 
            progress: 100 
          });
        } else {
          // Use Facebook post service
          const result = await createFacebookPost(
            {
              pageId: payload.pageId || '',
              message: payload.message,
              published: payload.published,
              scheduledPublishTime: payload.scheduledPublishTime
            },
            token || undefined
          );
          
          if ('error' in result) {
            throw new Error(result.error);
          }
          
          updateResult(platformId, { 
            status: 'success', 
            videoId: result.postId, 
            videoUrl: `https://facebook.com/${result.postId}`, 
            progress: 100 
          });
        }
      } else if (platformId === 'twitter') {
        // Twitter: support text + image or video
        const file = payload.imageFile || payload.videoFile;
        const twitterRes = await uploadTwitterPost(file, payload.message, token || undefined);
        
        if ('error' in twitterRes) {
          throw new Error(twitterRes.error);
        }
        
        updateResult(platformId, { 
          status: 'success', 
          videoUrl: twitterRes.tweet?.data?.id ? `https://twitter.com/i/web/status/${twitterRes.tweet.data.id}` : undefined, 
          videoId: twitterRes.tweet?.data?.id, 
          progress: 100 
        });
      }
    } catch (e: any) {
      updateResult(platformId, { status: 'error', error: e.message });
    }
  }, []);

  return { publishSingle, results };
}
