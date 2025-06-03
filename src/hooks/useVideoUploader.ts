import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useVideo } from '../context/VideoContext';
import { 
    SelectedPlatform, 
    UploadSettings, 
    PlatformUploadResult 
} from '../types';
import { uploadTikTokVideo } from '../services/tiktokApiService'; 
import { uploadTwitterPost } from '../services/twitterApiService';
import { uploadYouTubeVideo } from '../services/youtubeApiService';
import { uploadFacebookVideo } from '../services/facebookApiService';

// Define the expected platform IDs
type PlatformID = 'youtube' | 'tiktok' | 'facebook' | 'twitter';

export function useVideoUploader() {
  const { videoFile } = useVideo();
  const [platformResults, setPlatformResults] = useState<Record<string, PlatformUploadResult>>({});

  const updateResult = (platformId: string, data: Partial<PlatformUploadResult>) => {
    setPlatformResults(prev => {
      const current = prev[platformId] || { status: 'pending', progress: 0 };
      const updated = { ...current, ...data };
      return { ...prev, [platformId]: updated };
    });
  };

  const updateProgress = (platformId: string, progress: number) => {
     updateResult(platformId, { progress });
  };

  const uploadSinglePlatform = useCallback(async (
    platform: SelectedPlatform,
    platformSetting: UploadSettings 
  ) => {
    if (!videoFile) {
      toast.error('No video file selected for upload.');
      return;
    }
    
    // Assert the platform ID type
    const platformId = platform.id as PlatformID; 

    if (platformResults[platformId]?.status && platformResults[platformId].status !== 'pending' && platformResults[platformId].status !== 'error') {
        console.warn(`Upload already in progress or completed for ${platformId}`);
        toast.error(`Upload already processing for ${platform.name}.`);
        return;
    }

    // --- Settings Validation ---
    let settingsValid = true;
    if (!platformSetting.title) {
        toast.error(`Title is missing for ${platform.name}.`);
        settingsValid = false;
    }
    // Specific checks for platforms that require them
    if (platformId === 'facebook' && !platformSetting.selectedPageId) {
        toast.error(`Facebook Page not selected.`);
        settingsValid = false;
    }
    if (platformId === 'youtube' && platformSetting.visibility === 'scheduled' && !platformSetting.scheduledDate) {
        toast.error(`Scheduled date missing for YouTube.`);
        settingsValid = false;
    }
    if (!settingsValid) {
       updateResult(platformId, { status: 'error', error: 'Configuration validation failed' });
       return;
    }

    const token = localStorage.getItem('accessToken');
    const sessionId = token || undefined; // convert null to undefined for correct type

    // --- Start Upload Process ---
    updateResult(platformId, { status: 'uploading', progress: 0, error: undefined }); 
    const uploadToastId = toast.loading(`Starting upload to ${platform.name}...`);

    try {
      let videoId: string | undefined;
      let videoUrl: string | undefined;

      // --- YouTube Upload (Backend) ---
      if (platformId === 'youtube') {
        console.log("Sending YouTube upload request to backend...");
        
        const result = await uploadYouTubeVideo(
          videoFile,
          {
            title: platformSetting.title,
            description: platformSetting.description,
            tags: platformSetting.tags,
            visibility: platformSetting.visibility as 'public' | 'private' | 'unlisted' | 'scheduled',
            scheduledDate: platformSetting.scheduledDate || undefined
          },
          sessionId,
          (progress: number) => updateProgress(platformId, progress)
        );
        
        if ('error' in result) {
          throw new Error(result.error);
        }
        
        videoId = result.videoId;
        videoUrl = result.videoUrl;
        console.log("Received success from backend:", result);
      
      // --- TikTok Upload (Backend) ---
      } else if (platformId === 'tiktok') {
        console.log("Initiating TikTok upload via backend service...");
        
        const result = await uploadTikTokVideo(
          videoFile,                       // 1. videoFile
          sessionId,                       // 2. pass JWT (undefined if not present)
          platformSetting.title,           // 3. title
          platformSetting.description || '', // 4. description
          (progress: number) => updateProgress(platformId, progress) // 5. progress callback with proper type
        );
        
        // Check the result from the service
        if ('error' in result) {
          console.error("TikTok upload failed:", result.error);
          throw new Error(result.error); // Throw error to be caught below
        }
        
        // Success - Note: TikTok backend doesn't give a direct videoId/URL here
        console.log("TikTok upload backend response:", result.message);
        // Set videoUrl to TikTok homepage as a placeholder if needed, or leave undefined
        // videoUrl = 'https://www.tiktok.com/'; 
        // Use the message from the backend success response
        toast.success(result.message || 'Successfully sent video to TikTok Inbox!', { id: uploadToastId });
        // Set videoId to something generic or leave undefined?
        videoId = `tiktok_inbox_${Date.now()}`; // Example placeholder

      // --- Facebook Upload (Backend) ---
      } else if (platformId === 'facebook') {
        console.log("Initiating Facebook upload via backend service...");
        
        const result = await uploadFacebookVideo(
          videoFile,
          {
            title: platformSetting.title,
            description: platformSetting.description,
            selectedPageId: platformSetting.selectedPageId || ''
          },
          sessionId,
          (progress: number) => updateProgress(platformId, progress)
        );
        
        if ('error' in result) {
          throw new Error(result.error);
        }
        
        videoId = result.videoId;
        videoUrl = result.videoUrl;
        
      // --- Twitter Upload (Backend) ---
      } else if (platformId === 'twitter') {
        const tweetText = platformSetting.title || '';
        const result = await uploadTwitterPost(
          videoFile,
          tweetText,
          sessionId,
          (progress: number) => updateProgress(platformId, progress)
        );
        
        if ('error' in result) {
          console.error('Twitter upload failed:', result.error);
          throw new Error(result.error);
        }
        
        toast.success('Successfully uploaded video to Twitter!', { id: uploadToastId });
        videoId = result.tweet?.data?.id || undefined;
        videoUrl = result.tweet?.data?.id ? `https://twitter.com/i/web/status/${result.tweet.data.id}` : undefined;
      } else {
        // Should not happen with PlatformID assertion, but good practice
        toast.error(`Platform ${platform.name} uploads not implemented yet.`, { id: uploadToastId });
        throw new Error(`Platform ${platformId} not supported yet.`);
      }

      // --- Success --- 
      updateResult(platformId, { status: 'success', videoId, videoUrl, progress: 100 });
      toast.success(`Successfully uploaded to ${platform.name}!`, { id: uploadToastId });

    } catch (error) {
      console.error(`Error uploading to ${platformId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      updateResult(platformId, { status: 'error', error: errorMessage, progress: 0 });
      // Use the existing toast logic for errors
      toast.error(`Failed to upload to ${platform.name}: ${errorMessage}`, { id: uploadToastId });
    }

  }, [videoFile, platformResults, updateResult, updateProgress]);

  const resetPlatformStatus = useCallback((platformId: string) => {
      updateResult(platformId, { 
          status: 'pending', 
          progress: 0, 
          videoId: undefined, 
          videoUrl: undefined, 
          error: undefined 
      });
  }, [updateResult]);

  return {
    uploadSinglePlatform,
    platformResults,
    resetPlatformStatus
  };
}