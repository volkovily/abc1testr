import { useState, FormEvent, useEffect, useRef, ChangeEvent } from 'react';
import { Loader2, Video, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useVideo } from '../context/VideoContext';

interface VideoUploadFormProps {
  onSubmit: () => void;
}

const VideoUploadForm = ({ onSubmit }: VideoUploadFormProps) => {
  const [isValidating, setIsValidating] = useState(false);
  const { setVideoFile, videoFile } = useVideo();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  // Restore selected file from context if available (for back button navigation)
  useEffect(() => {
    if (videoFile) {
      setSelectedFile(videoFile);
      const url = URL.createObjectURL(videoFile);
      setVideoPreview(url);
      setIsPreviewExpanded(true);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      // Clear local state if context file is cleared (e.g., via reset)
      setSelectedFile(null);
      setVideoPreview('');
      setIsPreviewExpanded(false);
    }
  }, [videoFile]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setSelectedFile(null);
      setVideoPreview('');
      setIsPreviewExpanded(false);
      return;
    }

    const file = files[0];
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a valid video file');
      setSelectedFile(null);
      setVideoPreview('');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
    setIsPreviewExpanded(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error('Please select a video file');
      return;
    }
    
    setIsValidating(true);
    
    try {
      setVideoFile(selectedFile);
      onSubmit();
      toast.success('Video file selected successfully');
    } catch (error) {
      toast.error('Failed to process video file');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-800">Video Upload</h2>
      </div>

      <form onSubmit={handleSubmit} className="relative pb-16">
        <div className="p-4">
          {/* File Upload Section */}
          <div className="mb-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-gray-400">
              <div className="flex items-center mb-1">
                <Upload className="h-5 w-5 text-gray-400 mr-1.5" />
                <p className="text-sm font-medium text-gray-700">
                  {selectedFile ? selectedFile.name : 'Drag and drop a video file, or click to select'}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <p className="text-xs text-gray-500">
                  Supported formats: MP4, MOV, AVI
                </p>
                <label
                  htmlFor="file-upload"
                  className="flex-shrink-0 rounded-md bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                >
                  Select File
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
            {selectedFile && (
              <p className="mt-1 text-xs text-green-600">
                ✓ {selectedFile.name} selected ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Video preview */}
          <div>
            <div className="mb-2 flex items-center">
              <div className="flex items-center space-x-1">
                <Video className="h-3.5 w-3.5 text-gray-500" />
                <h3 className="text-xs font-medium text-gray-700">Video Preview</h3>
              </div>
            </div>
            <div 
              className={`relative overflow-hidden rounded-md border border-gray-200 bg-gray-50 transition-all duration-300 ${
                isPreviewExpanded ? 'aspect-video' : 'h-24'
              } w-full`}
            >
              {videoPreview ? (
                <video 
                  src={videoPreview} 
                  className="absolute inset-0 h-full w-full" 
                  controls={isPreviewExpanded}
                ></video>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <Video className="mb-1 h-6 w-6 text-gray-300" />
                  <p className="text-xs text-gray-400">Upload a video to see preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Sticky footer with action button */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-between items-center shadow-sm">
          <p className="text-xs text-gray-500">
            Upload a video to continue
          </p>
          <button
            type="submit"
            disabled={isValidating || !selectedFile}
            className={`flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition ${
              isValidating || !selectedFile
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Validating...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VideoUploadForm;
