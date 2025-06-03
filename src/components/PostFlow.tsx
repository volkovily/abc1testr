import React, { useState } from 'react';
import PlatformSelection from './PlatformSelection';
import PlatformUploadStatus from './settings/PlatformUploadStatus';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useFacebookAuth } from '../hooks/useFacebookAuth';
import { useTwitterAuth } from '../hooks/useTwitterAuth';
import AuthStatusDisplay from './settings/AuthStatusDisplay';
import IconsByName from './PlatformIcons';
import { usePostPublisher } from '../hooks/usePostPublisher';
import platformsList from '../data/platforms';
import { SelectedPlatform } from '../types';
import FacebookPostForm from './post/FacebookPostForm';
import TwitterPostForm from './post/TwitterPostForm';

const PostFlow: React.FC = () => {
  const postPlatforms = platformsList.filter(p => p.id === 'facebook' || p.id === 'twitter');
  const [step, setStep] = useState<'select'|'compose'>('select');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SelectedPlatform[]>([]);
  const { publishSingle, results } = usePostPublisher();
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const handleSelect = (platformId: string, isAuthenticated?: boolean) => {
    const platform = postPlatforms.find(p => p.id === platformId);
    if (platform) {
      setSelectedPlatforms(prev => {
        if (prev.some(p => p.id === platformId)) return prev;
        return [
          ...prev,
          {
            ...platform,
            settings: {
              title: '',
              description: '',
              visibility: 'public',
              tags: [],
              scheduledDate: null
            },
            isAuthenticated
          }
        ];
      });
      setActivePlatform(prev => prev || platformId);
    }
  };
  const handleDeselect = (platformId: string) => {
    setSelectedPlatforms(prev => prev.filter(p => p.id !== platformId));
    setActivePlatform(prev => (prev === platformId ? (selectedPlatforms.length > 1 ? selectedPlatforms.find(p => p.id !== platformId)?.id || null : null) : prev));
  };
  const handlePostSubmit = (payload: any) => {
    if (activePlatform) {
      const platform = selectedPlatforms.find(p => p.id === activePlatform);
      if (platform) {
        publishSingle(platform, payload);
      }
    }
  };
  const { isAuthenticated: isFacebookAuth, isLoading: isFacebookLoading, userInfo: facebookUserInfo, error: facebookError, logout: facebookLogout } = useFacebookAuth();
  const { isAuthenticated: isTwitterAuth, isLoading: isTwitterLoading, userInfo: twitterUserInfo, error: twitterError, logout: twitterLogout } = useTwitterAuth();
  const FacebookIcon = IconsByName['facebook'];
  const TwitterIcon = IconsByName['twitter'];
  const facebookAuthInfo = facebookUserInfo
    ? { name: facebookUserInfo.name, id: facebookUserInfo.id, imageUrl: facebookUserInfo.picture?.data?.url, profileUrl: `https://facebook.com/${facebookUserInfo.id}` }
    : null;
  const twitterAuthInfo = twitterUserInfo
    ? { name: twitterUserInfo.name, id: twitterUserInfo.id, imageUrl: twitterUserInfo.avatarUrl, profileUrl: twitterUserInfo.username ? `https://twitter.com/${twitterUserInfo.username}` : undefined }
    : null;

  if (step === 'select') {
    return (
      <PlatformSelection
        platforms={postPlatforms}
        selectedPlatforms={selectedPlatforms}
        onSelect={handleSelect}
        onDeselect={handleDeselect}
        onNext={() => setStep('compose')}
        isActive={true}
        requireVideoSource={false}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center">
        <button onClick={() => setStep('select')} className="mr-3 flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-medium text-gray-800">Configure Post Settings</h2>
      </div>
      <div className="p-4 space-y-4">
        <div className="overflow-x-auto border-b border-gray-200">
          <nav className="-mb-px flex space-x-2" aria-label="Tabs">
            {selectedPlatforms.map(platform => (
              <button
                key={platform.id}
                type="button"
                onClick={() => setActivePlatform(platform.id)}
                className={`flex items-center whitespace-nowrap border-b-2 px-2 py-2 text-sm font-medium transition ${activePlatform === platform.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                aria-current={activePlatform === platform.id ? 'page' : undefined}
              >
                <div className="mr-1.5 h-5 w-5 flex-shrink-0 overflow-hidden rounded-sm">
                  {IconsByName[platform.iconName] && React.createElement(IconsByName[platform.iconName], { className: 'h-full w-full' })}
                </div>
                <span>{platform.name}</span>
              </button>
            ))}
          </nav>
        </div>
        {activePlatform === 'facebook' && (
          <AuthStatusDisplay
            platformName="Facebook"
            platformIcon={FacebookIcon ? <FacebookIcon className="h-full w-full"/> : null}
            isAuthenticated={isFacebookAuth}
            isLoading={isFacebookLoading}
            authInfo={facebookAuthInfo}
            error={facebookError}
            onLogout={facebookLogout}
          />
        )}
        {activePlatform === 'twitter' && (
          <AuthStatusDisplay
            platformName="Twitter"
            platformIcon={TwitterIcon ? <TwitterIcon className="h-full w-full"/> : null}
            isAuthenticated={isTwitterAuth}
            isLoading={isTwitterLoading}
            authInfo={twitterAuthInfo}
            error={twitterError}
            onLogout={twitterLogout}
          />
        )}
        <div className="min-h-[200px]">
          {activePlatform && (() => {
            const result = results[activePlatform];
            if (!result || result.status === 'pending') {
              if (activePlatform === 'facebook') {
                return <FacebookPostForm onSubmit={handlePostSubmit} isSubmitting={false} />;
              }
              if (activePlatform === 'twitter') {
                return <TwitterPostForm onSubmit={handlePostSubmit} isSubmitting={false} />;
              }
              return null;
            }
            return (
              <React.Fragment>
                <PlatformUploadStatus 
                  platformId={activePlatform} 
                  result={result} 
                />
                {result && (
                  <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        results[activePlatform] = { ...result, status: 'pending', progress: 0, error: undefined };
                        setActivePlatform(null); setTimeout(() => setActivePlatform(activePlatform), 0);
                      }}
                      className="flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" /> Back to Settings
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default PostFlow;
