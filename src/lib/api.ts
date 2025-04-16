import axios from 'axios';

// Create an axios instance with default configs
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // This allows cookies/auth headers to be sent with requests
});

// Add a request interceptor to add authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Clear auth data and redirect to login page if unauthorized
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      
      // If not already on login page, redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: async (name: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },
  
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    
    if (response.data.success) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('auth_user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },
  
  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
  
  resetPassword: async (token: string, password: string) => {
    const response = await api.post(`/auth/reset-password/${token}`, { password });
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// Project API
export const projectAPI = {
  getProjects: async () => {
    const response = await api.get('/projects');
    return response.data;
  },
  
  createProject: async (name: string, description: string) => {
    const response = await api.post('/projects', { name, description });
    return response.data;
  },
  
  getProject: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },
  
  updateProject: async (projectId: string, data: { name?: string; description?: string }) => {
    const response = await api.put(`/projects/${projectId}`, data);
    return response.data;
  },
  
  deleteProject: async (projectId: string) => {
    const response = await api.delete(`/projects/${projectId}`);
    return response.data;
  },
  
  addUserToProject: async (projectId: string, emailOrUserId: string, accessType: 'editor' | 'viewer') => {
    // Make sure emailOrUserId is not undefined
    if (!emailOrUserId) {
      throw new Error('Email or userId is required for adding a user to a project');
    }
    
    // Check if the parameter is an email (contains @) or a userId
    const isEmail = emailOrUserId.includes('@');
    const payload = isEmail 
      ? { email: emailOrUserId, accessType } 
      : { userId: emailOrUserId, accessType };
      
    const response = await api.post(`/projects/${projectId}/users`, payload);
    return response.data;
  },
  
  removeUserFromProject: async (projectId: string, userId: string) => {
    const response = await api.delete(`/projects/${projectId}/users/${userId}`);
    return response.data;
  },
  
  requestAccess: async (projectId: string, message: string) => {
    const response = await api.post(`/projects/${projectId}/request-access`, { message });
    return response.data;
  },
  
  getAccessRequests: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/access-requests`);
    return response.data;
  },
  
  handleAccessRequest: async (projectId: string, requestId: string, status: 'approved' | 'rejected', accessType?: 'editor' | 'viewer') => {
    const response = await api.put(`/projects/${projectId}/access-requests/${requestId}`, { 
      status,
      accessType 
    });
    return response.data;
  },
  
  generateShareLink: async (projectId: string, expiration?: number) => {
    const response = await api.post(`/projects/${projectId}/share`, { expiration });
    return response.data;
  }
};

// Version API
export const versionAPI = {
  getVersions: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/versions`);
    
    // Add validation and data transformation
    if (response.data && response.data.success && response.data.data) {
      // Debug log the raw version data
      console.log('Raw version data from API:', response.data.data);
      
      // Process approved versions
      if (Array.isArray(response.data.data.approved)) {
        response.data.data.approved = response.data.data.approved.map(version => {
          // Make sure creatorName is set
          if (!version.creatorName && version.uploadedBy) {
            if (typeof version.uploadedBy === 'object' && version.uploadedBy.name) {
              version.creatorName = version.uploadedBy.name;
            } else if (typeof version.uploadedBy === 'string') {
              // If we only have ID, set a placeholder
              version.creatorName = 'User';
            }
          }
          
          console.log('Processed approved version:', { 
            id: version.id || version._id,
            creatorName: version.creatorName,
            uploadedBy: version.uploadedBy
          });
          
          return version;
        });
      }
      
      // Process pending versions
      if (Array.isArray(response.data.data.pending)) {
        response.data.data.pending = response.data.data.pending.map(version => {
          // Make sure creatorName is set
          if (!version.creatorName && version.uploadedBy) {
            if (typeof version.uploadedBy === 'object' && version.uploadedBy.name) {
              version.creatorName = version.uploadedBy.name;
            } else if (typeof version.uploadedBy === 'string') {
              // If we only have ID, set a placeholder
              version.creatorName = 'User';
            }
          }
          
          console.log('Processed pending version:', { 
            id: version.id || version._id,
            creatorName: version.creatorName,
            uploadedBy: version.uploadedBy
          });
          
          return version;
        });
      }
    }
    
    return response.data;
  },
  
  getUploadUrl: async (projectId: string, fileName: string, fileType: string) => {
    const response = await api.get(`/projects/${projectId}/versions/upload-url`, {
      params: { fileName, fileType }
    });
    return response.data;
  },
  
  createVersion: async (projectId: string, versionData: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    notes?: string;
    key: string;
  }) => {
    const response = await api.post(`/projects/${projectId}/versions`, versionData);
    return response.data;
  },
  
  getVersion: async (projectId: string, versionId: string) => {
    try {
      // First try to get the version data from the API
      const response = await api.get(`/projects/${projectId}/versions/${versionId}`);
      
      if (response.data && response.data.success && response.data.data) {
        // Log the file URL we got
        console.log('Version file URL from API:', response.data.data.fileUrl);
        return response.data;
      }
      
      throw new Error('Invalid response format from server');
    } catch (apiError) {
      console.error('API error getting version:', apiError);
      
      // Fallback approach - try to get all versions and find this one
      try {
        const allVersionsResponse = await api.get(`/projects/${projectId}/versions`);
        
        if (allVersionsResponse.data && allVersionsResponse.data.success) {
          // Search through all versions
          const allVersions = [
            ...(allVersionsResponse.data.data.approved || []),
            ...(allVersionsResponse.data.data.pending || [])
          ];
          
          const version = allVersions.find(v => v.id === versionId || v._id === versionId);
          
          if (version) {
            console.log('Found version in all versions list:', version);
            return {
              success: true,
              data: version
            };
          }
        }
      } catch (fallbackError) {
        console.error('Fallback approach also failed:', fallbackError);
      }
      
      // Ultimate fallback - return an error that will be handled by the UI
      console.error('All approaches to get version failed, returning error');
      return {
        success: false,
        message: 'Could not retrieve file information'
      };
    }
  },
  
  updateVersionStatus: async (projectId: string, versionId: string, status: 'approved' | 'rejected', notes?: string) => {
    const response = await api.put(`/projects/${projectId}/versions/${versionId}/status`, { status, notes });
    return response.data;
  },
  
  deleteVersion: async (projectId: string, versionId: string) => {
    const response = await api.delete(`/projects/${projectId}/versions/${versionId}`);
    return response.data;
  },
  
  revertToVersion: async (projectId: string, versionId: string) => {
    const response = await api.post(`/projects/${projectId}/versions/${versionId}/revert`);
    return response.data;
  },
  
  uploadFile: async (url: string, file: File) => {
    // Validate the URL
    if (!url || url === 'undefined' || url.includes('/undefined')) {
      console.error('Invalid upload URL:', url);
      throw new Error('Invalid upload URL. The signed URL is malformed or missing.');
    }
    
    // This is a direct upload to S3 using the pre-signed URL
    try {
      // Use fetch API instead of axios for better CORS handling
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return { status: response.status, statusText: response.statusText };
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw error;
    }
  },

  // Alternative: Upload directly to the backend which will handle S3 upload
  uploadFileViaServer: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/projects/${projectId}/versions/upload-file`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading file via server:', error);
      throw error;
    }
  }
};

// Notification API
export const notificationAPI = {
  getNotifications: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },
  
  // Deletes the notification
  markAsRead: async (notificationId: string) => {
    const response = await api.put(`/notifications/${notificationId}`);
    return response.data;
  },
  
  // Deletes all notifications
  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  }
};

// User API
export const userAPI = {
  searchUsers: async (email: string) => {
    const response = await api.get('/users/search', {
      params: { email }
    });
    return response.data;
  },
  
  updateProfile: async (data: { name?: string; profilePicture?: string }) => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },
  
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/users/password', { currentPassword, newPassword });
    return response.data;
  }
};

export default {
  auth: authAPI,
  projects: projectAPI,
  versions: versionAPI,
  notifications: notificationAPI,
  users: userAPI
}; 