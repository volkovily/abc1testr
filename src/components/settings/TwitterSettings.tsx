import React, { useState, useCallback } from 'react';
import { useTwitterAuth } from '../../hooks/useTwitterAuth';
import AuthStatusDisplay from './AuthStatusDisplay';
import PlatformUploadStatus from './PlatformUploadStatus';
import IconsByName from '../PlatformIcons';
import { SelectedPlatform, UploadSettings, PlatformUploadResult, AuthInfo } from '../../types';
import { Loader2, Upload, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import VideoPreview from './VideoPreview';
import CommonSettingsForm from './CommonSettingsForm';

interface TwitterSettingsProps {
  platform: SelectedPlatform;
  settings: UploadSettings;
  onSettingsChange: <K extends keyof UploadSettings>(key: K, value: UploadSettings[K]) => void;
  videoFile: File | null;
  videoPreviewUrl: string | null;
  uploadResult: PlatformUploadResult | undefined;
  uploadSinglePlatform: (platform: SelectedPlatform, settings: UploadSettings) => Promise<void>;
  resetPlatformStatus: (platformId: string) => void;
  onCopySettings?: () => void;
}

const TwitterSettings: React.FC<TwitterSettingsProps> = ({
  platform,
  settings,
  onSettingsChange,
  videoFile,
  videoPreviewUrl,
  uploadResult,
  uploadSinglePlatform,
  resetPlatformStatus,
  onCopySettings
}) => {
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    userInfo,
    error: authError,
    logout
  } = useTwitterAuth();

  const TwitterIconComponent = IconsByName['Twitter'];
  const [isUploading, setIsUploading] = useState(false);

  const authInfo: AuthInfo | null = userInfo ? {
    name: userInfo.name,
    id: userInfo.id,
    imageUrl: userInfo.avatarUrl,
    profileUrl: userInfo.username ? `https://twitter.com/${userInfo.username}` : undefined
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
    setIsUploading(true);
    await uploadSinglePlatform(platform, settings);
    setIsUploading(false);
  }, [platform, videoFile, settings, uploadSinglePlatform]);

  const handleResetClick = useCallback(() => {
    resetPlatformStatus(platform.id);
  }, [platform.id, resetPlatformStatus]);

  const currentStatus = uploadResult?.status || 'pending';
  const showSettingsArea = isAuthenticated && currentStatus === 'pending';
  const showStatusArea = isAuthenticated && currentStatus !== 'pending';

  return (
    <div className="space-y-4">
      <AuthStatusDisplay
        platformName="Twitter"
        platformIcon={TwitterIconComponent ? <TwitterIconComponent className="h-full w-full"/> : null}
        isAuthenticated={isAuthenticated}
        isLoading={isAuthLoading}
        authInfo={authInfo}
        error={authError}
        onLogout={logout}
      />

      {isAuthenticated && (
        <div className="space-y-4">
          {showSettingsArea && (
            <>
              <VideoPreview 
                videoFile={videoFile} 
                videoPreviewUrl={videoPreviewUrl} 
              />
              <CommonSettingsForm
                settings={settings}
                onSettingsChange={onSettingsChange}
                platformId="twitter"
                platformName="Twitter"
                allowScheduling={false}
                onCopySettings={onCopySettings}
              />
            </>
          )}

          {/* Show status only when not pending */}
          {showStatusArea && (
            <PlatformUploadStatus 
              platformId="twitter" 
              result={uploadResult} 
            />
          )}

          {/* Action Buttons Area */}
          <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-4">
            {showSettingsArea && (
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={isAuthLoading || isUploading || !videoFile}
                className="flex items-center justify-center rounded-md bg-[#1da1f2] px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="mr-1.5 h-4 w-4" /> Upload to Twitter</>
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

export default TwitterSettings;
