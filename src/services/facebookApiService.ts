import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

// --- Pages --- 

export interface FacebookPage {
    id: string;
    name: string;
    access_token: string;
    category?: string;
    picture?: {
        data: {
            url: string;
        }
    };
}

export const getFacebookPages = async (sessionId?: string): Promise<FacebookPage[] | { error: string }> => {
    try {
        const headers: Record<string, string> = {};
        if (sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        
        const response = await axios.get(`${API_URL}/api/facebook/pages`, { headers });
        
        if (!response.data || !response.data.pages) {
            return { error: 'Pages data missing in response' };
        }
        
        return response.data.pages;
    } catch (error) {
        console.error('Error fetching Facebook pages:', error);
        let errorMessage = 'Failed to fetch Facebook pages';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { error: errorMessage };
    }
};

// --- Video Upload --- 

interface FacebookVideoUploadSuccessResponse {
    videoId: string;
    videoUrl: string;
}

interface FacebookVideoUploadErrorResponse {
    error: string;
}

type FacebookVideoUploadApiResponse = FacebookVideoUploadSuccessResponse | FacebookVideoUploadErrorResponse;

export interface FacebookVideoUploadOptions {
    title: string;
    description?: string;
    selectedPageId: string;
}

export const uploadFacebookVideo = async (
    videoFile: File,
    options: FacebookVideoUploadOptions,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void
): Promise<FacebookVideoUploadSuccessResponse | { error: string }> => {
    if (!options.selectedPageId) {
        return { error: 'Facebook Page ID is required' };
    }

    const formData = new FormData();
    formData.append('videoFile', videoFile);
    formData.append('title', options.title);
    
    if (options.description) {
        formData.append('description', options.description);
    }
    
    formData.append('selectedPageId', options.selectedPageId);

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'multipart/form-data',
        };
        
        if (sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        
        const response = await axios.post<FacebookVideoUploadApiResponse>(
            `${API_URL}/api/facebook/upload`,
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
        console.error('Error uploading Facebook video:', error);
        let errorMessage = 'Failed to upload Facebook video';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { error: errorMessage };
    }
};

// --- Photo Upload --- 

interface FacebookPhotoUploadSuccessResponse {
    photoId: string;
    postId?: string;
}

interface FacebookPhotoUploadErrorResponse {
    error: string;
}

type FacebookPhotoUploadApiResponse = FacebookPhotoUploadSuccessResponse | FacebookPhotoUploadErrorResponse;

export interface FacebookPhotoUploadOptions {
    pageId: string;
    message?: string;
    published?: boolean;
    scheduledPublishTime?: number;
}

export const uploadFacebookPhoto = async (
    photoFile: File,
    options: FacebookPhotoUploadOptions,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void
): Promise<FacebookPhotoUploadSuccessResponse | { error: string }> => {
    if (!options.pageId) {
        return { error: 'Facebook Page ID is required' };
    }

    const formData = new FormData();
    formData.append('photo', photoFile);
    formData.append('pageId', options.pageId);
    
    if (options.message) {
        formData.append('message', options.message);
    }
    
    if (options.published !== undefined) {
        formData.append('published', options.published.toString());
    }
    
    if (options.scheduledPublishTime) {
        formData.append('scheduledPublishTime', options.scheduledPublishTime.toString());
    }

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'multipart/form-data',
        };
        
        if (sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        
        const response = await axios.post<FacebookPhotoUploadApiResponse>(
            `${API_URL}/api/facebook/photo`,
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
        console.error('Error uploading Facebook photo:', error);
        let errorMessage = 'Failed to upload Facebook photo';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { error: errorMessage };
    }
};

// --- Post Creation --- 

interface FacebookPostSuccessResponse {
    postId: string;
}

interface FacebookPostErrorResponse {
    error: string;
}

type FacebookPostApiResponse = FacebookPostSuccessResponse | FacebookPostErrorResponse;

export interface FacebookPostOptions {
    pageId: string;
    message: string;
    link?: string;
    published?: boolean;
    scheduledPublishTime?: number;
}

export const createFacebookPost = async (
    options: FacebookPostOptions,
    sessionId?: string
): Promise<FacebookPostSuccessResponse | { error: string }> => {
    if (!options.pageId) {
        return { error: 'Facebook Page ID is required' };
    }

    if (!options.message) {
        return { error: 'Message is required' };
    }

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        
        if (sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        
        const response = await axios.post<FacebookPostApiResponse>(
            `${API_URL}/api/facebook/post`,
            options,
            { headers }
        );

        if ('error' in response.data) {
            return { error: response.data.error };
        }

        return response.data;
    } catch (error) {
        console.error('Error creating Facebook post:', error);
        let errorMessage = 'Failed to create Facebook post';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { error: errorMessage };
    }
}; 