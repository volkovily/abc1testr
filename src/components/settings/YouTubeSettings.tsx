import React, { useCallback, useState } from 'react';
import { useYouTubeAuth } from '../../hooks/useYouTubeAuth';
import AuthStatusDisplay from './AuthStatusDisplay';
import CommonSettingsForm from './CommonSettingsForm';
import VideoPreview from './VideoPreview';
import PlatformUploadStatus from './PlatformUploadStatus';
import {
  SelectedPlatform, 
  PlatformUploadResult, 
  UploadSettings,
  AuthInfo
} from '../../types';
import IconsByName from '../PlatformIcons';
import { Upload, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface YouTubeSettingsProps {
  platform: SelectedPlatform;
  settings: UploadSettings;
  onSettingsChange: <K extends keyof UploadSettings>(key: K, value: UploadSettings[K]) => void;
  videoFile: File | null;
  videoPreviewUrl: string | null;
  uploadResult: PlatformUploadResult | undefined;
  onCopySettings?: () => void;
  renderEmbed?: (platformId: string, result: PlatformUploadResult) => React.ReactNode;
  uploadSinglePlatform: (platform: SelectedPlatform, settings: UploadSettings) => Promise<void>;
  resetPlatformStatus: (platformId: string) => void;
}

const YouTubeSettings: React.FC<YouTubeSettingsProps> = ({
  platform,
  settings,
  onSettingsChange,
  videoFile,
  videoPreviewUrl,
  uploadResult,
  onCopySettings,
  renderEmbed,
  uploadSinglePlatform,
  resetPlatformStatus
}) => {
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    userInfo,
    error: authError,
    logout
  } = useYouTubeAuth();
  
  const [isUploading, setIsUploading] = useState(false);

  const authInfo: AuthInfo | null = userInfo ? {
     name: userInfo.title,
     id: userInfo.id,
     imageUrl: userInfo.thumbnailUrl,
     profileUrl: `https://www.youtube.com/channel/${userInfo.id}`
  } : null;

  const handleUploadClick = useCallback(async () => {
     if (!videoFile) {
         toast.error('No video file selected');
         return;
     }
     if (!settings.title) {
        toast.error('Please enter a video title.');
        return;
     }
     if (settings.visibility === 'scheduled' && !settings.scheduledDate) {
        toast.error('Please select a publishing date for scheduled video.');
        return;
     }

     setIsUploading(true);
     const uploadSettings: UploadSettings = {
         ...settings,
         scheduledDate: settings.scheduledDate || null,
     };
     await uploadSinglePlatform(platform, uploadSettings);
     setIsUploading(false);
  }, [platform, settings, videoFile, uploadSinglePlatform]);

  const handleResetClick = useCallback(() => {
      resetPlatformStatus(platform.id);
  }, [platform.id, resetPlatformStatus]);

  const currentStatus = uploadResult?.status || 'pending';
  const showSettingsArea = isAuthenticated && currentStatus === 'pending';
  const showStatusArea = isAuthenticated && currentStatus !== 'pending';

  const YouTubeIconComponent = IconsByName['youtube'];

  return (
    <div className="space-y-4">
      <AuthStatusDisplay
        platformName="YouTube"
        platformIcon={YouTubeIconComponent ? <YouTubeIconComponent className="h-full w-full"/> : null}
        isAuthenticated={isAuthenticated}
        isLoading={isAuthLoading}
        authInfo={authInfo}
        error={authError}
        onLogout={logout}
      />

      {isAuthenticated && (
         <div className="space-y-4"> 
            {showSettingsArea && (
               <VideoPreview 
                 videoFile={videoFile} 
                 videoPreviewUrl={videoPreviewUrl}
               />
            )}

            {showSettingsArea && (
               <CommonSettingsForm
                 settings={settings}
                 onSettingsChange={onSettingsChange}
                 platformId="youtube"
                 platformName="YouTube"
                 allowScheduling={true}
                 onCopySettings={onCopySettings}
               />
            )}

            {showStatusArea && (
              <PlatformUploadStatus 
                 platformId="youtube" 
                 result={uploadResult} 
                 renderEmbed={renderEmbed}
              />
            )}

            <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-4">
               {showSettingsArea && (
                  <button
                     type="button"
                     onClick={handleUploadClick}
                     disabled={isAuthLoading || isUploading || !videoFile || !settings.title || (settings.visibility === 'scheduled' && !settings.scheduledDate)}
                     className="flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                     {isUploading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                     ) : (
                        <><Upload className="mr-1.5 h-4 w-4" /> Upload to YouTube</>
                     )}
                  </button>
               )}
               {showStatusArea && (
                  <button
                     type="button"
                     onClick={handleResetClick}
                     className="flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                     <RotateCcw className="mr-1.5 h-4 w-4" /> Back to Settings
                  </button>
               )}
            </div>
        </div>
      )}
    </div>
  );
};

export default YouTubeSettings;