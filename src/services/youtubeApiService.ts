import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

// --- Video Upload --- 

interface YouTubeUploadSuccessResponse {
    message: string;
    videoId: string;
    videoUrl: string;
}

interface YouTubeUploadErrorResponse {
    error: string;
}

type YouTubeUploadApiResponse = YouTubeUploadSuccessResponse | YouTubeUploadErrorResponse;

export interface YouTubeUploadOptions {
    title: string;
    description?: string;
    tags?: string[];
    visibility: 'public' | 'private' | 'unlisted' | 'scheduled';
    scheduledDate?: Date;
}

export const uploadYouTubeVideo = async (
    videoFile: File,
    options: YouTubeUploadOptions,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void
): Promise<YouTubeUploadSuccessResponse | { error: string }> => {
    const formData = new FormData();
    formData.append('videoFile', videoFile);
    formData.append('title', options.title);
    
    if (options.description) {
        formData.append('description', options.description);
    }
    
    if (options.tags && options.tags.length > 0) {
        formData.append('tags', options.tags.join(','));
    }
    
    formData.append('visibility', options.visibility);
    
    if (options.visibility === 'scheduled' && options.scheduledDate) {
        formData.append('scheduledDate', options.scheduledDate.toISOString());
    }

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'multipart/form-data',
        };
        
        if (sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        
        const response = await axios.post<YouTubeUploadApiResponse>(
            `${API_URL}/api/youtube/upload`,
            formData,
            {
                headers,
                onUploadProgress: (progressEvent) => {
                    if (onUploadProgress && progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onUploadProgress(percentCompleted);
                    }
                }
            }
        );

        if ('error' in response.data) {
            return { error: response.data.error };
        }

        return response.data;
    } catch (error) {
        console.error('Error uploading YouTube video:', error);
        let errorMessage = 'Failed to upload YouTube video';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { error: errorMessage };
    }
}; 