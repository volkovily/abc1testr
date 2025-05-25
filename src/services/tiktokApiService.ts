import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

// --- Status --- 

interface TikTokStatus {
    isAuthenticated: boolean;
    openId?: string;
    error?: string;
}

export const getTikTokStatus = async (sessionId?: string): Promise<TikTokStatus> => {
    try {
        const headers: Record<string, string> = {};
        if (sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        
        const response = await axios.get<TikTokStatus>(`${API_URL}/api/tiktok/status`, { headers });
        return response.data;
    } catch (error) {
        console.error('Error fetching TikTok status:', error);
        let errorMessage = 'Failed to fetch TikTok status';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { isAuthenticated: false, error: errorMessage };
    }
};

// --- User Info --- 

// Expected structure from backend
interface TikTokUserInfoResponse {
    data?: {
        user: {
            open_id: string;
            display_name: string;
            avatar_url: string;
        };
    };
    error?: {
        code: string | number;
        message: string;
        log_id: string;
    };
}

// Cleaner type for the hook
export interface ProcessedTikTokUserInfo {
    openId: string;
    username: string;
    avatarUrl: string | null;
}

// Fetch user info via backend
export const getTikTokUserInfo = async (sessionId?: string): Promise<ProcessedTikTokUserInfo | { error: string }> => {
    try {
        const headers: Record<string, string> = {};
        if (sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        
        const response = await axios.get<TikTokUserInfoResponse>(`${API_URL}/api/tiktok/userinfo`, { headers });

        if (response.data.error && response.data.error.code !== 'ok') {
            console.error('Backend reported TikTok API error:', response.data.error);
            return { error: response.data.error.message || 'Failed to fetch user info from backend' };
        }

        if (!response.data.data?.user) {
             console.error('User data missing in backend response');
             return { error: 'User data missing in response' };
        }

        const user = response.data.data.user;
        return {
            openId: user.open_id,
            username: user.display_name,
            avatarUrl: user.avatar_url || null
        };

    } catch (error) {
        console.error('Error fetching TikTok user info via backend:', error);
        let errorMessage = 'Failed to fetch user info from backend';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { error: errorMessage };
    }
};

// --- Video Upload --- 

// Define structure for successful upload response from backend
interface TikTokUploadSuccessResponse {
    message: string;
    details?: any; // Include any success details from TikTok via backend
}

// Define structure for error response from backend
interface TikTokUploadErrorResponse {
    error: string;
}

// Type for the combined response
type TikTokUploadApiResponse = TikTokUploadSuccessResponse | TikTokUploadErrorResponse;

// Function to upload video via backend
export const uploadTikTokVideo = async (
    videoFile: File,
    sessionId?: string,
    title?: string,
    description?: string,
    onUploadProgress?: (progress: number) => void // Optional progress callback
): Promise<TikTokUploadSuccessResponse | { error: string }> => {
    
    const formData = new FormData();
    formData.append('videoFile', videoFile); 
    
    // Add title and description if provided
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'multipart/form-data',
        };
        
        if (sessionId) {
            headers['Authorization'] = `Bearer ${sessionId}`;
        }
        
        const response = await axios.post<TikTokUploadApiResponse>(
            `${API_URL}/api/tiktok/upload`,
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

        // Check if the backend returned an error structure
        if ('error' in response.data) { 
            console.error('Backend reported TikTok upload error:', response.data.error);
            return { error: response.data.error };
        }

        // Assume success if no error property
        return response.data; // Contains { message, details? }

    } catch (error) {
        console.error('Error calling backend TikTok upload endpoint:', error);
        let errorMessage = 'Failed to send video to TikTok via backend';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { error: errorMessage };
    }
};
