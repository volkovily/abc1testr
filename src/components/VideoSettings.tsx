import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { useVideo } from '../context/VideoContext';
import {
  SelectedPlatform,
  UploadSettings,
} from '../types'; 
import IconsByName from './PlatformIcons';
import toast from 'react-hot-toast';

import { useYouTubeAuth } from '../hooks/useYouTubeAuth';
import { useTikTokAuth } from '../hooks/useTikTokAuth';
import { useFacebookAuth } from '../hooks/useFacebookAuth';
import { useVideoUploader } from '../hooks/useVideoUploader';

import YouTubeSettings from './settings/YouTubeSettings';
import TikTokSettings from './settings/TikTokSettings';
import FacebookSettings from './settings/FacebookSettings';
import TwitterSettings from './settings/TwitterSettings';

type AllPlatformSettings = Record<string, UploadSettings>;

interface VideoSettingsProps {
  selectedPlatforms: SelectedPlatform[];
  isActive: boolean;
  onBack?: () => void;
}

export const DEFAULT_COMMON_SETTING: UploadSettings = {
  title: '',
  description: '',
  visibility: 'public',
  tags: [],
  scheduledDate: null,
};

export const DEFAULT_FACEBOOK_SETTING: UploadSettings = {
    ...DEFAULT_COMMON_SETTING,
    selectedPageId: ''
};

const VideoSettings: React.FC<VideoSettingsProps> = ({ 
  selectedPlatforms,
  isActive, 
  onBack,
}) => {
  const { videoFile } = useVideo();
  const [platformSettings, setPlatformSettings] = useState<AllPlatformSettings>({});
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const {
    uploadSinglePlatform,
    platformResults, 
    resetPlatformStatus,
  } = useVideoUploader();

  const handleSettingChange = useCallback((platformId: string, key: keyof UploadSettings, value: any) => {
    setPlatformSettings(prev => ({
      ...prev,
      [platformId]: {
        ...(prev[platformId] || (platformId === 'facebook' ? DEFAULT_FACEBOOK_SETTING : DEFAULT_COMMON_SETTING)),
        [key]: value,
      },
    }));
  }, []);

  useEffect(() => {
    const newSettings: AllPlatformSettings = {};
    selectedPlatforms.forEach(platform => {
      if (!platformSettings[platform.id]) {
         if (platform.id === 'facebook') {
             newSettings[platform.id] = { ...DEFAULT_FACEBOOK_SETTING };
         } else {
             newSettings[platform.id] = { ...DEFAULT_COMMON_SETTING };
         }
      } else {
         newSettings[platform.id] = platformSettings[platform.id];
      }
    });
    if (Object.keys(newSettings).some(id => !platformSettings[id])) {
      setPlatformSettings(prev => ({ ...prev, ...newSettings }));
    }
    
    if (!activePlatform || !selectedPlatforms.some(p => p.id === activePlatform)) {
      setActivePlatform(selectedPlatforms[0]?.id || null);
    }
    // Depend only on selectedPlatforms stringified IDs to avoid loop with settings initialization
  }, [JSON.stringify(selectedPlatforms.map(p => p.id))]); 

  // Generate video preview URL & auto-fill title
  useEffect(() => {
    let objectUrl: string | null = null;
    if (videoFile) {
      objectUrl = URL.createObjectURL(videoFile);
      setVideoPreviewUrl(objectUrl);

      // Auto-fill title from filename if title is empty for the *initial* active platform
      const initialActivePlatformId = selectedPlatforms[0]?.id;
      if (initialActivePlatformId && platformSettings[initialActivePlatformId]) {
          const currentSettings = platformSettings[initialActivePlatformId];
          if (!currentSettings.title) { 
              const nameWithoutExtension = videoFile.name.split('.').slice(0, -1).join('.');
              const formattedName = nameWithoutExtension.replace(/[-_]/g, ' ');
              handleSettingChange(initialActivePlatformId, 'title', formattedName);
          }
      }
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setVideoPreviewUrl(null);
      }
    };
    // Depend on videoFile and handleSettingChange. platformSettings dependency removed to prevent loops on title auto-fill.
  }, [videoFile, handleSettingChange, selectedPlatforms]); 

  // --- Event Handlers --- 

  // Handler for CommonSettingsForm changes (now UploadSettings keys)
  const handleCommonSettingsChange = useCallback(<K extends keyof UploadSettings>(key: K, value: UploadSettings[K]) => {
      if (activePlatform) {
          // Update using the generic handler, ensuring type safety
          handleSettingChange(activePlatform, key, value);
      }
  }, [activePlatform, handleSettingChange]);

  // Renamed for clarity - Handles changes specific to Facebook settings
  const handleFacebookSettingsChange = useCallback(
    <K extends keyof UploadSettings>(key: K, value: UploadSettings[K]) => {
       if (activePlatform === 'facebook') {
           handleSettingChange(activePlatform, key, value);
       }
   }, 
   [activePlatform, handleSettingChange]
  );

  // Copy settings from active platform to others
  const copySettingsToAll = useCallback(() => {
    if (!activePlatform) return;
    
    const sourceSettings = platformSettings[activePlatform];
    if (!sourceSettings) return;

    const updateToast = toast.loading('Copying settings...')
    setPlatformSettings(prev => {
      const newSettings = { ...prev };
      selectedPlatforms.forEach(platform => {
         if (platform.id !== activePlatform) { 
              const defaultSetting = platform.id === 'facebook' ? DEFAULT_FACEBOOK_SETTING : DEFAULT_COMMON_SETTING;
              newSettings[platform.id] = { 
                 ...(prev[platform.id] || defaultSetting),
                 // Copy only common UploadSettings fields
                 title: sourceSettings.title,
                 description: sourceSettings.description,
                 visibility: sourceSettings.visibility, 
                 tags: [...(sourceSettings.tags || [])], 
                 scheduledDate: sourceSettings.scheduledDate,
                 // Preserve platform-specific fields like selectedPageId for Facebook
                 selectedPageId: platform.id === 'facebook' ? (prev[platform.id]?.selectedPageId || '') : undefined
              };
         }
      });
      return newSettings;
    });
    toast.success('Settings copied to other platforms.', { id: updateToast });

  }, [activePlatform, platformSettings, selectedPlatforms]);

  // --- Helper Functions --- 

  const renderPlatformIcon = (iconName: string) => {
    const IconComponent = IconsByName[iconName];
    return IconComponent ? (
      <IconComponent className="h-full w-full" />
    ) : (
      <Info className="h-full w-full text-gray-700" />
    );
  };

  // --- Render Logic --- 

  if (!isActive) return null;

  const currentActivePlatformData = selectedPlatforms.find(p => p.id === activePlatform);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-3 flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Go back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 className="text-sm font-medium text-gray-800">Configure Upload Settings</h2>
        </div>
      </div>
      
      <div className="p-4">
        {selectedPlatforms.length > 0 ? (
          <div className="flex flex-col space-y-4">
            {/* Platform tabs navigation */} 
            <div className="overflow-x-auto border-b border-gray-200">
              <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                {selectedPlatforms.map(platform => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => setActivePlatform(platform.id)}
                    className={`flex items-center whitespace-nowrap border-b-2 px-2 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${ 
                      activePlatform === platform.id
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                    aria-current={activePlatform === platform.id ? 'page' : undefined}
                  >
                    <div className="mr-1.5 h-5 w-5 flex-shrink-0 overflow-hidden rounded-sm">
                      {renderPlatformIcon(platform.iconName)}
                    </div>
                    <span>{platform.name}</span>
                    {platformResults[platform.id]?.status && platformResults[platform.id]?.status !== 'pending' && (
                        <span className={`ml-1.5 h-2 w-2 rounded-full ${ 
                            platformResults[platform.id]?.status === 'success' ? 'bg-green-400' : 
                            platformResults[platform.id]?.status === 'error' ? 'bg-red-400' : 
                            'bg-blue-400'
                        }`}></span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
            
            {/* Content for the active tab */} 
            <div className="min-h-[200px]">
                {/* Render component only if activePlatform is valid and settings exist */}
                {currentActivePlatformData && activePlatform && platformSettings[activePlatform] ? (
                    <> 
                        {activePlatform === 'youtube' && (
                            <YouTubeSettings
                                platform={currentActivePlatformData}
                                settings={platformSettings[activePlatform]}
                                onSettingsChange={handleCommonSettingsChange}
                                videoFile={videoFile}
                                videoPreviewUrl={videoPreviewUrl}
                                uploadResult={platformResults.youtube}
                                onCopySettings={copySettingsToAll}
                                uploadSinglePlatform={uploadSinglePlatform}
                                resetPlatformStatus={resetPlatformStatus}
                                renderEmbed={(platformId, result) => 
                                   result.videoId ? (
                                     <div className="mt-3 aspect-video w-full overflow-hidden rounded-md border border-gray-200 bg-black">
                                       <iframe
                                         width="100%"
                                         height="100%"
                                         src={`https://www.youtube.com/embed/${result.videoId}`}
                                         title="YouTube video player"
                                         frameBorder="0"
                                         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                         allowFullScreen
                                       ></iframe>
                                     </div>
                                   ) : null
                                }
                            />
                        )}
                        {activePlatform === 'tiktok' && (
                            <TikTokSettings
                                platform={currentActivePlatformData}
                                videoFile={videoFile}
                                videoPreviewUrl={videoPreviewUrl}
                                uploadResult={platformResults.tiktok}
                                uploadSinglePlatform={uploadSinglePlatform}
                                resetPlatformStatus={resetPlatformStatus}
                            />
                        )}
                        {activePlatform === 'facebook' && (
                            <FacebookSettings
                                platform={currentActivePlatformData} 
                                settings={platformSettings[activePlatform]}
                                onSettingsChange={handleFacebookSettingsChange}
                                videoFile={videoFile}
                                videoPreviewUrl={videoPreviewUrl}
                                uploadResult={platformResults.facebook}
                                uploadSinglePlatform={uploadSinglePlatform} 
                                resetPlatformStatus={resetPlatformStatus} 
                                onCopySettings={copySettingsToAll}
                            />
                        )}
                        {activePlatform === 'twitter' && (
                            <TwitterSettings
                                platform={currentActivePlatformData}
                                settings={platformSettings[activePlatform]}
                                onSettingsChange={handleCommonSettingsChange}
                                videoFile={videoFile}
                                videoPreviewUrl={videoPreviewUrl}
                                uploadResult={platformResults.twitter}
                                uploadSinglePlatform={uploadSinglePlatform}
                                resetPlatformStatus={resetPlatformStatus}
                                onCopySettings={copySettingsToAll}
                            />
                        )}
                        {/* Add other platforms here */}
                    </>
                ) : !activePlatform ? ( // Handle case where no platform is selected
                    <div className="flex h-full items-center justify-center text-gray-500">Select a platform tab.</div>
                ) : ( // Handle loading/missing settings case (optional)
                    <div className="flex h-full items-center justify-center text-gray-500">Loading settings...</div>
                )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-md bg-gray-50 p-6 text-center">
            <Info className="mb-2 h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-500">No platforms selected.</p>
            <p className="mt-1 text-xs text-gray-400">Go back to select platforms to upload to.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoSettings;

