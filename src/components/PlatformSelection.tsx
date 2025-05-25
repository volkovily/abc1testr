import { useEffect } from 'react';
import { Check, Info, ArrowLeft, Lock } from 'lucide-react';
import { Platform, SelectedPlatform } from '../types';
import { useVideo } from '../context/VideoContext';
import IconsByName from './PlatformIcons';
import toast from 'react-hot-toast';
import { useYouTubeAuth } from '../hooks/useYouTubeAuth';
import { useTikTokAuth } from '../hooks/useTikTokAuth';
import { useFacebookAuth } from '../hooks/useFacebookAuth';
import { useTwitterAuth } from '../hooks/useTwitterAuth';

interface PlatformSelectionProps {
  platforms: Platform[];
  selectedPlatforms: SelectedPlatform[];
  onSelect: (platformId: string, isAuthenticated?: boolean) => void;
  onDeselect: (platformId: string) => void;
  onNext: () => void;
  isActive: boolean;
  onBack?: () => void;
  requireVideoSource?: boolean; // new prop
}

// Helper function to render platform icons
const renderPlatformIcon = (iconName: string) => {
  const IconComponent = IconsByName[iconName];
  return IconComponent ? (
    <IconComponent className="h-full w-full object-contain" />
  ) : (
    <Info className="h-6 w-6 text-gray-400" />
  );
};

const PlatformSelection = ({
  platforms,
  selectedPlatforms,
  onSelect,
  onDeselect,
  onNext,
  isActive,
  onBack,
  requireVideoSource = true // default true for video, false for post
}: PlatformSelectionProps) => {
  const { videoFile } = useVideo();
  
  const { isAuthenticated: isYouTubeAuthenticated, login: loginYouTube, logout: logoutYouTube } = useYouTubeAuth();
  const { isAuthenticated: isTikTokAuthenticated, login: loginTikTok, logout: logoutTikTok } = useTikTokAuth();
  const { isAuthenticated: isFacebookAuthenticated, login: loginFacebook, logout: logoutFacebook } = useFacebookAuth();
  const { isAuthenticated: isTwitterAuthenticated, login: loginTwitter, logout: logoutTwitter } = useTwitterAuth();

  const hasVideoSource = !!videoFile;

  useEffect(() => {
    // React to auth changes if needed for side effects
  }, [isYouTubeAuthenticated, isTikTokAuthenticated, isFacebookAuthenticated, isTwitterAuthenticated]);
  
  const getAuthStatus = (platformId: string): boolean => {
    if (platformId === 'youtube') return isYouTubeAuthenticated;
    if (platformId === 'tiktok') return isTikTokAuthenticated;
    if (platformId === 'facebook') return isFacebookAuthenticated;
    if (platformId === 'twitter') return isTwitterAuthenticated;
    return false;
  };
  
  const handleAuthenticate = async (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;

    let loginFunction: (() => Promise<void> | void) | null = null;

    if (platformId === 'tiktok') {
      loginFunction = loginTikTok;
    } else if (platformId === 'facebook') {
      loginFunction = loginFacebook;
    } else if (platformId === 'youtube') {
      loginFunction = loginYouTube;
    } else if (platformId === 'twitter') {
      loginFunction = loginTwitter;
    } else {
       toast.error(`Authentication for ${platform.name} not implemented.`);
       return;
    }
    
    if (!loginFunction) {
      toast.error(`Login function not found for ${platform.name}.`);
      return;
    }
    
    const loadingToast = toast.loading(`Connecting to ${platform.name}...`);
    
    try {
      await loginFunction();
      toast.dismiss(loadingToast);
      // Re-check auth status after login attempt (hooks might update asynchronously)
      setTimeout(() => {
        const nowAuthenticated = getAuthStatus(platformId);
        if (nowAuthenticated && !isPlatformSelected(platformId)) {
            onSelect(platformId, true); // Auto-select after successful connection
        }
      }, 100); // Small delay
    } catch (error: any) {
      console.error(`Error authenticating with ${platformId}:`, error);
      toast.dismiss(loadingToast); // Error toast handled by hooks
    }
  };
  
  const handleDisconnect = (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;

    let logoutFunction: (() => void) | null = null;
    if (platformId === 'youtube') logoutFunction = logoutYouTube;
    else if (platformId === 'tiktok') logoutFunction = logoutTikTok;
    else if (platformId === 'facebook') logoutFunction = logoutFacebook;
    else if (platformId === 'twitter') logoutFunction = logoutTwitter;
    
    if (logoutFunction) {
       logoutFunction();
       if (isPlatformSelected(platformId)) {
         onDeselect(platformId); // Deselect when disconnecting
       }
    } else {
       toast.error(`Disconnect for ${platform.name} not implemented.`);
    }
  };

  const isPlatformSelected = (platformId: string) => {
    return selectedPlatforms.some(p => p.id === platformId);
  };

  const isPlatformAuthenticated = (platformId: string): boolean => {
    return getAuthStatus(platformId);
  };

  const handleTogglePlatform = (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;

    const requiresAuth = platform.requiresAuth;
    const isAuthenticated = isPlatformAuthenticated(platformId);

    // If it requires auth and is not authenticated, the card isn't clickable for selection
    if (requiresAuth && !isAuthenticated) {
      return;
    }

    // Toggle selection if authenticated or doesn't require auth
    if (isPlatformSelected(platformId)) {
      onDeselect(platformId);
    } else {
      onSelect(platformId, requiresAuth ? isAuthenticated : undefined);
    }
  };

  const displayPlatforms = platforms;

  // Exit early if the component is not active
  if (!isActive) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between">
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
              <h2 className="text-sm font-medium text-gray-800">Select Content Platforms</h2>
           </div>
        </div>
      </div>

      <div className="relative pb-16">
        <div className="p-4">
          <div className="mb-3 flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {displayPlatforms.length} platform{displayPlatforms.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {displayPlatforms.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {displayPlatforms.map((platform) => {
                const isSelected = isPlatformSelected(platform.id);
                const isAuthenticated = isPlatformAuthenticated(platform.id);
                const requiresAuth = platform.requiresAuth;
                const isDisabled = requiresAuth && !isAuthenticated;

                return (
                  <div
                    key={platform.id}
                    className={`group relative flex flex-col rounded-md border transition-all ${
                      isSelected && !isDisabled
                        ? 'border-indigo-300 bg-indigo-50/50'
                        : isDisabled
                        ? 'border-gray-200 bg-gray-100 opacity-70 cursor-not-allowed'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div
                      className={`relative p-2 ${!isDisabled ? 'cursor-pointer' : ''}`}
                      onClick={!isDisabled ? () => handleTogglePlatform(platform.id) : undefined}
                    >
                      <div className="flex items-center">
                        <div className={`mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-white p-1 shadow-sm ${
                          isDisabled ? 'opacity-60' : ''
                        }`}>
                          {renderPlatformIcon(platform.iconName)}
                        </div>
                        <div className="overflow-hidden">
                          <h3 className={`truncate text-sm font-medium ${
                            isDisabled ? 'text-gray-500' : 'text-gray-800'
                          }`}>
                            {platform.name}
                          </h3>
                        </div>

                        <div className="absolute right-1.5 top-1.5 flex items-center space-x-1">
                          {requiresAuth && !isAuthenticated && (
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-500" title="Connection required">
                              <Lock className="h-2.5 w-2.5" />
                            </div>
                          )}

                          {!isDisabled && (
                            <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-gray-300 bg-white text-transparent group-hover:border-gray-400'
                            }`} title={isSelected ? 'Selected' : 'Select'}>
                              <Check className="h-2.5 w-2.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {requiresAuth && (
                      <div className="mt-auto border-t border-gray-200 p-1.5">
                        {isAuthenticated ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDisconnect(platform.id); }}
                            className="w-full rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
                            title={`Disconnect ${platform.name}`}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAuthenticate(platform.id); }}
                            className="w-full rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                            title={`Connect ${platform.name}`}
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md bg-gray-50 p-6 text-center">
              <Info className="mb-2 h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-500">No platforms available to select.</p>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-start space-x-1">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <p className="text-xs text-gray-500">
              Select platforms to continue
            </p>
          </div>
          <button
            type="button"
            onClick={onNext}
            disabled={selectedPlatforms.length === 0 || (requireVideoSource && !hasVideoSource)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors shadow-sm ${
              selectedPlatforms.length === 0 || (requireVideoSource && !hasVideoSource)
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlatformSelection;
