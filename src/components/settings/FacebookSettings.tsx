import React, { useState, useEffect, useCallback } from 'react';
import { useFacebookAuth } from '../../hooks/useFacebookAuth';
import AuthStatusDisplay from './AuthStatusDisplay';
import PlatformUploadStatus from './PlatformUploadStatus';
import {
  SelectedPlatform, 
  UploadSettings, 
  PlatformUploadResult, 
  AuthInfo, 
  FacebookPageInfo
} from '../../types'; 
import IconsByName from '../PlatformIcons';
import { Loader2, AlertTriangle, Upload, RotateCcw } from 'lucide-react';
import VideoPreview from './VideoPreview';
import toast from 'react-hot-toast';
import CommonSettingsForm from './CommonSettingsForm';

interface FacebookSettingsProps {
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

const FacebookSettings: React.FC<FacebookSettingsProps> = ({
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
    pages,
    error: authError,
    logout,
    fetchStatus,
  } = useFacebookAuth();

  const FacebookIconComponent = IconsByName['facebook'];

  const [isUploading, setIsUploading] = useState(false);

  const handlePageSelection = useCallback((pageId: string) => {
      onSettingsChange('selectedPageId', pageId); 
  }, [onSettingsChange]);

  useEffect(() => {
      if (!settings.selectedPageId && pages && pages.length > 0) {
          const firstPageId = pages[0].id;
          onSettingsChange('selectedPageId', firstPageId); 
      }
  }, [pages, settings.selectedPageId, onSettingsChange]);

  const authInfo: AuthInfo | null = userInfo ? {
     name: userInfo.name,
     id: userInfo.id,
     imageUrl: userInfo.picture?.data?.url,
     profileUrl: `https://facebook.com/${userInfo.id}`
  } : null;

  const handleUploadClick = useCallback(async () => {
      if (!videoFile) {
          toast.error('No video file selected');
          return;
      }
       if (!settings.selectedPageId) {
           toast.error('Please select a Facebook Page first.');
           return;
       }
       if (!settings.title) {
            toast.error('Please enter a video title.');
            return;
       }

      setIsUploading(true);
      const uploadSettings: UploadSettings = {
          title: settings.title,
          description: settings.description,
          selectedPageId: settings.selectedPageId,
          visibility: 'public', 
          tags: settings.tags,
          scheduledDate: null,
      };
      await uploadSinglePlatform(platform, uploadSettings);
      setIsUploading(false);
  }, [platform, settings, videoFile, uploadSinglePlatform]);

  const handleResetClick = useCallback(() => {
      resetPlatformStatus(platform.id);
  }, [platform.id, resetPlatformStatus]);

  const handleCommonFormChange = useCallback(<K extends keyof UploadSettings>(key: K, value: UploadSettings[K]) => {
      onSettingsChange(key, value);
  }, [onSettingsChange]);

  const currentStatus = uploadResult?.status || 'pending';
  const showSettingsArea = isAuthenticated && currentStatus === 'pending';
  const showStatusArea = isAuthenticated && currentStatus !== 'pending';

  return (
    <div className="space-y-4">
      <AuthStatusDisplay
        platformName="Facebook"
        platformIcon={FacebookIconComponent ? <FacebookIconComponent className="h-full w-full"/> : null}
        isAuthenticated={isAuthenticated}
        isLoading={isAuthLoading}
        authInfo={authInfo}
        error={authError}
        onLogout={logout}
      />

      {isAuthenticated && (
        <div className="space-y-4"> 
          {showSettingsArea ? (
            <div className="space-y-4">
              {/* === PAGE SELECTION AREA === */}
              <div className="space-y-2 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700">Select Facebook Page to Upload To</label>
                  {isAuthLoading ? (
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading your Facebook pages...</span>
                    </div>
                  ) : pages.length === 0 ? (
                    <div className="rounded-md bg-yellow-50 p-3">
                      <div className="flex">
                        <AlertTriangle className="mr-3 h-5 w-5 flex-shrink-0 text-yellow-400" />
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-yellow-800">No Facebook Pages Found</h3>
                          <p className="mt-1 text-xs text-yellow-700">
                            You need at least one Facebook Page to upload videos. Please create one or check your permissions.
                          </p>
                          <button
                            type="button"
                            onClick={() => fetchStatus()}
                            className="mt-2 inline-flex items-center rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-200"
                          >
                            Refresh Pages List
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
                      {pages.map((page: FacebookPageInfo) => (
                        <div key={page.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50">
                          <input
                            type="radio"
                            id={`fb-page-${page.id}`}
                            name="facebook-page"
                            value={page.id}
                            checked={settings.selectedPageId === page.id}
                            onChange={() => handlePageSelection(page.id)}
                            className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                          />
                          <label htmlFor={`fb-page-${page.id}`} className="flex flex-1 cursor-pointer items-center min-w-0">
                             {page.picture?.data?.url && (
                              <img 
                                src={page.picture.data.url} 
                                alt={page.name} 
                                className="mr-2 h-8 w-8 flex-shrink-0 rounded-md border border-gray-200"
                              />
                            )}
                            <span className="block flex-1 truncate text-sm font-medium text-gray-700">{page.name}</span>
                            <a 
                              href={`https://facebook.com/${page.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="ml-2 flex-shrink-0 text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              View
                            </a>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* === VIDEO PREVIEW === */}
              <VideoPreview 
                videoFile={videoFile} 
                videoPreviewUrl={videoPreviewUrl} 
              />

              {/* === RENDER COMMON SETTINGS FORM === */}
              <CommonSettingsForm
                 settings={settings}
                 onSettingsChange={handleCommonFormChange} 
                 platformId="facebook"
                 platformName="Facebook"
                 allowScheduling={false}
                 onCopySettings={onCopySettings}
              />
            </div>
          ) : null}

          {/* Show status only when not pending */}
          {showStatusArea && (
              <PlatformUploadStatus 
                platformId="facebook" 
                result={uploadResult} 
              />
          )}

           {/* Action Buttons Area */}
           <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-4">
               {showSettingsArea && (
                  <button
                     type="button"
                     onClick={handleUploadClick}
                     disabled={isAuthLoading || isUploading || !videoFile || !settings.selectedPageId}
                     className="flex items-center justify-center rounded-md bg-[#1877F2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0C63D4] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                     {isUploading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                     ) : (
                        <><Upload className="mr-1.5 h-4 w-4" /> Upload to Facebook</>
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

export default FacebookSettings;