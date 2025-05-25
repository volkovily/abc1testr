import React from 'react';
import { Video } from 'lucide-react';

interface VideoPreviewProps {
  videoFile: File | null;
  videoPreviewUrl: string | null;
  hasSizeError?: boolean;
  sizeErrorText?: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoFile,
  videoPreviewUrl,
  hasSizeError = false,
  sizeErrorText = 'Video size limit exceeded for this platform.'
}) => {
  if (!videoFile) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <Video className="mb-2 h-8 w-8 text-gray-400" />
        <p className="text-sm text-gray-500">No video selected</p>
      </div>
    );
  }

  const sizeMB = (videoFile.size / (1024 * 1024));

  return (
    <div className={`rounded-md border p-3 ${hasSizeError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center">
          <Video className="mr-2 h-5 w-5 flex-shrink-0 text-gray-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-700">{videoFile.name}</p>
            <p className="text-xs text-gray-500">
              {sizeMB.toFixed(2)} MB
              {hasSizeError && (
                <span className="ml-1 font-medium text-red-600">
                  ({sizeErrorText})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
      
      {videoPreviewUrl && (
        <div className="relative mt-3 max-w-sm mx-auto">
          <div className="aspect-video">
            <video
              src={videoPreviewUrl}
              className="h-full w-full rounded bg-black"
              controls
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPreview; 