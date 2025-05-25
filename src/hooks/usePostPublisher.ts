import { useState, useCallback } from 'react';
import { SelectedPlatform, PlatformUploadResult } from '../types';
import { uploadTwitterPost } from '../services/twitterApiService';

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
      let res, data;
      if (platformId === 'facebook') {
        if (payload.imageFile) {
          const form = new FormData();
          form.append('pageId', payload.pageId!);
          form.append('message', payload.message);
          if (payload.published !== undefined) form.append('published', String(payload.published));
          if (payload.scheduledPublishTime) form.append('scheduledPublishTime', String(payload.scheduledPublishTime));
          form.append('photo', payload.imageFile);
          res = await fetch(`${API_BASE_URL}/api/facebook/photo`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
        } else {
          const body: any = { pageId: payload.pageId, message: payload.message };
          if (payload.published !== undefined) body.published = payload.published;
          if (payload.scheduledPublishTime) body.scheduledPublishTime = payload.scheduledPublishTime;
          res = await fetch(`${API_BASE_URL}/api/facebook/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
          });
        }
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Publish failed');
        updateResult(platformId, { status: 'success', videoUrl: data.postId, videoId: data.photoId || data.postId, progress: 100 });
      } else if (platformId === 'twitter') {
        // Twitter: support text + image or video
        const file = payload.imageFile || payload.videoFile;
        const twitterRes = await uploadTwitterPost(file, payload.message, token || undefined);
        if ('error' in twitterRes) throw new Error(twitterRes.error);
        updateResult(platformId, { status: 'success', videoUrl: twitterRes.tweet?.data?.id ? `https://twitter.com/i/web/status/${twitterRes.tweet.data.id}` : undefined, videoId: twitterRes.tweet?.data?.id, progress: 100 });
      }
    } catch (e: any) {
      updateResult(platformId, { status: 'error', error: e.message });
    }
  }, []);

  return { publishSingle, results };
}
