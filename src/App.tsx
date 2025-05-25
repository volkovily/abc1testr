import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

import VideoUploadForm from './components/VideoUploadForm';
import PlatformSelection from './components/PlatformSelection';
import VideoSettings, { DEFAULT_COMMON_SETTING, DEFAULT_FACEBOOK_SETTING } from './components/VideoSettings';
import ContentTypeSelection from './components/ContentTypeSelection';
import PostFlow from './components/PostFlow';

import { VideoProvider, useVideo } from './context/VideoContext';
import { UserAuthProvider } from './context/UserAuthContext';
import platforms from './data/platforms';
import { SelectedPlatform } from './types';
import Header from './components/Header';

function App() {
  const [contentType, setContentType] = useState<'video'|'post'|null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SelectedPlatform[]>([]);
  
  const startPost = () => setContentType('post');
  const startVideo = () => {
    setContentType('video');
    setCurrentStep(1);
  };
  
  const handleVideoSubmit = () => {
    setCurrentStep(2);
  };
  
  const handlePlatformSelect = (platformId: string, isAuthenticated?: boolean) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;
    
    if (selectedPlatforms.some(p => p.id === platformId)) {
      return;
    }
    
    const defaultSettings = platformId === 'facebook' 
        ? { ...DEFAULT_FACEBOOK_SETTING } 
        : { ...DEFAULT_COMMON_SETTING };

    setSelectedPlatforms(prev => [
      ...prev, 
      { 
        id: platform.id, 
        name: platform.name,
        iconName: platform.iconName,
        settings: defaultSettings, 
        isAuthenticated: isAuthenticated 
      }
    ]);
  };
  
  const handlePlatformDeselect = (platformId: string) => {
    setSelectedPlatforms(prev => prev.filter(p => p.id !== platformId));
  };
  
  const handlePlatformsSubmit = () => {
    if (selectedPlatforms.length === 0) {
      toast.error("Please select at least one platform");
      return;
    }
    setCurrentStep(3);
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-center" />
      
      <Header />

      <main className="flex-1 py-6 mb-8">
        <div className="mx-auto max-w-2xl px-4">
          {contentType === null && <ContentTypeSelection onSelect={type => type === 'video' ? startVideo() : startPost()} />}
          {contentType === 'post' && <PostFlow />}
          
          {contentType === 'video' && (
            <div className="space-y-6">
              {currentStep === 1 && (
                <VideoUploadForm onSubmit={handleVideoSubmit} />
              )}
              {currentStep === 2 && (
                <PlatformSelection
                  platforms={platforms}
                  selectedPlatforms={selectedPlatforms}
                  onSelect={handlePlatformSelect}
                  onDeselect={handlePlatformDeselect}
                  onNext={handlePlatformsSubmit}
                  isActive={true}
                  onBack={currentStep > 1 ? goBack : undefined}
                />
              )}
              {currentStep === 3 && (
                <VideoSettings selectedPlatforms={selectedPlatforms} isActive={true} onBack={goBack} />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AppWithProvider() {
  return (
    <UserAuthProvider>
      <VideoProvider>
        <App />
      </VideoProvider>
    </UserAuthProvider>
  );
}