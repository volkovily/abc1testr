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

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    // --- Authentication Checks ---
    if (platformId === 'youtube') {
      try {
        console.log("Checking YouTube auth status before upload...");
        const token = localStorage.getItem('accessToken');
        const backendStatusResponse = await fetch(`${API_BASE_URL}/api/youtube/status`, {
          headers: { 'Authorization': `Bearer ${token}` } // include JWT
        });
        if (!backendStatusResponse.ok) {
            const errorText = await backendStatusResponse.text();
            throw new Error(`Backend status check failed: ${backendStatusResponse.status} ${errorText}`);
        }
        const statusData = await backendStatusResponse.json();
        if (!statusData.isAuthenticated) {
             updateResult(platformId, { status: 'error', error: 'Backend reports YouTube not authenticated' });
             toast.error(`Please connect your ${platform.name} account first (via backend).`);
             return;
        }
      } catch(e) {
          console.error(`Error checking auth for ${platformId}`, e);
          updateResult(platformId, { status: 'error', error: `Auth check failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
          return;
      }
    } 
    // No frontend check needed for TikTok - backend handles it.

    // --- Start Upload Process ---
    updateResult(platformId, { status: 'uploading', progress: 0, error: undefined }); 
    const uploadToastId = toast.loading(`Starting upload to ${platform.name}...`);

    try {
      let videoId: string | undefined;
      let videoUrl: string | undefined;

      // --- YouTube Upload (Backend) ---
      if (platformId === 'youtube') {
          const formData = new FormData();
          formData.append('videoFile', videoFile); 
          formData.append('title', platformSetting.title);
          if (platformSetting.description) {
              formData.append('description', platformSetting.description);
          }
          if (platformSetting.tags && platformSetting.tags.length > 0) {
              formData.append('tags', platformSetting.tags.join(',')); 
          }
          formData.append('visibility', platformSetting.visibility);
          if (platformSetting.visibility === 'scheduled' && platformSetting.scheduledDate) {
              formData.append('scheduledDate', platformSetting.scheduledDate.toISOString());
          }

          console.log("Sending YouTube upload request to backend...");
          const token = localStorage.getItem('accessToken');
          const response = await fetch(`${API_BASE_URL}/api/youtube/upload`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }, // include JWT
              body: formData,
          });
          const responseData = await response.json();
          if (!response.ok) {
              throw new Error(responseData.error || `Backend upload failed with status: ${response.status}`);
          }
          videoId = responseData.videoId;
          videoUrl = responseData.videoUrl;
          console.log("Received success from backend:", responseData);
      
      // --- TikTok Upload (Backend) ---
      } else if (platformId === 'tiktok') {
          console.log("Initiating TikTok upload via backend service...");
          
          const token = localStorage.getItem('accessToken');
          const sessionId = token ?? undefined; // convert null to undefined for correct type
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
          // Upload via our backend
          const pageId = platformSetting.selectedPageId;
          if (!pageId) throw new Error('Facebook Page ID is required');
          // Build form data
          const fbForm = new FormData();
          fbForm.append('videoFile', videoFile);
          fbForm.append('title', platformSetting.title);
          if (platformSetting.description) fbForm.append('description', platformSetting.description);
          fbForm.append('selectedPageId', pageId);
          // Send to backend
          const token = localStorage.getItem('accessToken');
          const fbRes = await fetch(`${API_BASE_URL}/api/facebook/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fbForm
          });
          const fbData = await fbRes.json();
          if (!fbRes.ok) throw new Error(fbData.error || `Facebook upload failed: ${fbRes.status}`);
          videoId = fbData.videoId;
          videoUrl = fbData.videoUrl;
      // --- Twitter Upload (Backend) ---
      } else if (platformId === 'twitter') {
          const token = localStorage.getItem('accessToken') || '';
          const tweetText = platformSetting.title || '';
          const result = await uploadTwitterPost(
            videoFile,
            tweetText,
            token,
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