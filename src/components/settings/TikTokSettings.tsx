import React, { useState, useCallback, useEffect } from 'react';
import { useTikTokAuth } from '../../hooks/useTikTokAuth';
import AuthStatusDisplay from './AuthStatusDisplay';
import VideoPreview from './VideoPreview';
import PlatformUploadStatus from './PlatformUploadStatus';
import {
  SelectedPlatform, 
  PlatformUploadResult, 
  UploadSettings,
  AuthInfo, 
  TikTokUserInfo // Assuming hook provides this type or we map to it
} from '../../types'; 
import platforms from '../../data/platforms'; // Import platform data
import IconsByName from '../PlatformIcons';
import { Upload, Loader2, RotateCcw, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface TikTokSettingsProps {
  platform: SelectedPlatform;
  videoFile: File | null;
  videoPreviewUrl: string | null;
  uploadResult: PlatformUploadResult | undefined;
  uploadSinglePlatform: (platform: SelectedPlatform, settings: UploadSettings) => Promise<void>;
  resetPlatformStatus: (platformId: string) => void;
}

const TikTokSettings: React.FC<TikTokSettingsProps> = ({
  platform,
  videoFile,
  videoPreviewUrl,
  uploadResult,
  uploadSinglePlatform,
  resetPlatformStatus
}) => {
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    userInfo, // Assume hook provides data compatible with TikTokUserInfo
    error: authError,
    logout
  } = useTikTokAuth();

  const [isUploading, setIsUploading] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const TikTokIconComponent = IconsByName['tiktok'];

  // Get platform specific data (e.g., maxSizeMB)
  const platformData = platforms.find(p => p.id === platform.id);
  const maxSizeMB = platformData?.maxSizeMB; 

  // Validate size when videoFile changes
  useEffect(() => {
    if (videoFile && maxSizeMB && (videoFile.size / (1024 * 1024)) > maxSizeMB) {
      setSizeError(`Video exceeds TikTok's ${maxSizeMB}MB size limit.`);
    } else {
      setSizeError(null);
    }
  }, [videoFile, maxSizeMB]);

  // Map user info to common AuthInfo type
  const authInfo: AuthInfo | null = userInfo ? {
     name: (userInfo as TikTokUserInfo).username || 'TikTok User',
     id: (userInfo as TikTokUserInfo).openId || undefined,
     imageUrl: (userInfo as TikTokUserInfo).avatarUrl || undefined,
     profileUrl: (userInfo as TikTokUserInfo).username 
       ? `https://www.tiktok.com/@${(userInfo as TikTokUserInfo).username}` 
       : 'https://www.tiktok.com/'
  } : null;

  const handleUploadClick = useCallback(async () => {
     if (!videoFile) {
         toast.error('No video file selected');
         return;
     }
     if (sizeError) {
         toast.error(sizeError);
         return;
     }

     setIsUploading(true);
     // Minimal settings for TikTok API
     const uploadSettings: UploadSettings = {
         title: videoFile.name, // Use filename as title placeholder
         description: '',
         visibility: 'private',
         tags: [],
         scheduledDate: null
     };
     await uploadSinglePlatform(platform, uploadSettings);
     setIsUploading(false);
  }, [platform, videoFile, uploadSinglePlatform, sizeError]);

  const handleResetClick = useCallback(() => {
      resetPlatformStatus(platform.id);
  }, [platform.id, resetPlatformStatus]);

  const currentStatus = uploadResult?.status || 'pending';
  const showSettingsArea = isAuthenticated && currentStatus === 'pending';
  const showStatusArea = isAuthenticated && currentStatus !== 'pending';

  const tikTokError = authError;

  return (
    <div className="space-y-4">
      <AuthStatusDisplay
        platformName="TikTok"
        platformIcon={TikTokIconComponent ? <TikTokIconComponent className="h-full w-full"/> : null}
        isAuthenticated={isAuthenticated}
        isLoading={isAuthLoading}
        authInfo={authInfo}
        error={tikTokError}
        onLogout={logout}
      />

      {isAuthenticated && (
        <div className="space-y-4">
          {showSettingsArea && (
              <div className="space-y-4">
                <VideoPreview 
                    videoFile={videoFile} 
                    videoPreviewUrl={videoPreviewUrl} 
                    hasSizeError={!!sizeError}
                    sizeErrorText={sizeError || undefined} 
                />
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <Info className="h-5 w-5 text-blue-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3 flex-1 md:flex md:justify-between">
                            <p className="text-sm text-blue-700">
                                This video will be sent to your TikTok Inbox. 
                                Open TikTok, check your notifications, and complete the posting process there (add caption, hashtags, etc.).
                            </p>
                        </div>
                    </div>
                </div>
              </div>
          )}

          {showStatusArea && (
            <PlatformUploadStatus 
              platformId="tiktok" 
              result={uploadResult} 
            />
          )}

           <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-4">
               {showSettingsArea ? (
                  <button
                     type="button"
                     onClick={handleUploadClick}
                     disabled={isAuthLoading || isUploading || !videoFile || !!sizeError}
                     className="flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                     {isUploading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending to Inbox...</>
                     ) : (
                        <><Upload className="mr-1.5 h-4 w-4" /> Send to TikTok Inbox</>
                     )}
                  </button>
               ) : showStatusArea ? (
                   <button
                     type="button"
                     onClick={handleResetClick}
                     className="flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                     <RotateCcw className="mr-1.5 h-4 w-4" /> Back
                  </button>
               ) : null }
           </div>
        </div>
      )}
    </div>
  );
};

export default TikTokSettings;