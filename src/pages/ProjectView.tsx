import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { db, Timestamp } from '@/lib/firebase';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, UploadCloud, Eye, Users, Settings, FileText, UserPlus, Edit2, UserMinus, X, AlertCircle, HistoryIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { projectAPI, versionAPI, userAPI } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Project {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  creatorName: string;
  createdAt: { toDate: () => Date };
  updatedAt: { toDate: () => Date };
  accessLevel: 'view' | 'edit' | 'owner';
  versions?: ProjectVersion[];
}

interface ProjectVersion {
  id: string;
  versionNumber: number;
  createdBy: string;
  creatorName: string;
  createdAt: { toDate: () => Date };
  fileUrl: string;
  comments: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface Collaborator {
  _id: string;
  name?: string;
  email?: string;
  profilePicture?: string;
  accessType: 'creator' | 'editor' | 'viewer';
  // The user property can be either an object or a string ID
  user?: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  } | string;
}

// Add a helper function to safely get the version ID at the top of the component, after the interface definitions
// Safely get version ID accounting for both id and _id properties
const getVersionId = (version: any): string | undefined => {
  if (!version) return undefined;
  
  // Mongodb sometimes uses _id, while our client might expect id
  const versionId = version.id || version._id;
  
  if (!versionId) {
    console.error('Missing version ID:', version);
  }
  
  return versionId;
};

const ProjectView = () => {
  
  const { projectId } = useParams<{ projectId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Helper functions to extract user data
  const getUserName = (user: Collaborator): string => {
    if (user.name) return user.name;
    if (user.user && typeof user.user === 'object' && user.user.name) return user.user.name;
    return 'Unknown User';
  };
  
  const getUserEmail = (user: Collaborator): string => {
    if (user.email) return user.email;
    if (user.user && typeof user.user === 'object' && user.user.email) return user.user.email;
    return 'No email available';
  };
  
  const getUserInitials = (user: Collaborator): string => {
    const name = getUserName(user);
    if (!name || name === 'Unknown User') return 'UN';
    return name.substring(0, 2).toUpperCase();
  };
  
  const [uploading, setUploading] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [newVersionComment, setNewVersionComment] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [accessType, setAccessType] = useState<'editor' | 'viewer'>('viewer');
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [accessRequestMessage, setAccessRequestMessage] = useState('');
  const [isAccessRequestDialogOpen, setIsAccessRequestDialogOpen] = useState(false);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [isHandlingAccessRequest, setIsHandlingAccessRequest] = useState(false);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  const [versionToRevert, setVersionToRevert] = useState<any>(null);

  // Fetch project data
  const { 
    data: projectData,
    isLoading: projectLoading,
    isError: projectError 
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectId ? projectAPI.getProject(projectId) : null,
    enabled: !!projectId && !!currentUser
  });

  // Fetch project versions
  const {
    data: versionsData,
    isLoading: versionsLoading,
    isError: versionsError
  } = useQuery({
    queryKey: ['versions', projectId],
    queryFn: () => projectId ? versionAPI.getVersions(projectId) : null,
    enabled: !!projectId && !!currentUser
  });

  // Fetch project collaborators
  const {
    data: collaboratorsData,
    isLoading: collaboratorsLoading,
    isError: collaboratorsError
  } = useQuery({
    queryKey: ['collaborators', projectId],
    queryFn: () => projectId ? projectAPI.getProject(projectId) : null,
    enabled: !!projectId && !!currentUser
  });

  // Extract project and versions data
  const project = projectData?.data || null;
  const accessLevel = projectData?.accessLevel || 'view';
  
  // Fix permission handling - ensure we correctly process the accessLevel
  const canEdit = accessLevel === 'creator' || accessLevel === 'owner' || accessLevel === 'editor';
  const isOwner = accessLevel === 'creator' || accessLevel === 'owner';
  
  console.log('Project access level:', accessLevel, 'canEdit:', canEdit, 'isOwner:', isOwner);
  
  // Move access requests query here, after isOwner is defined
  const {
    data: accessRequestsData,
    isLoading: accessRequestsLoading,
    isError: accessRequestsError
  } = useQuery({
    queryKey: ['accessRequests', projectId],
    queryFn: () => projectId ? projectAPI.getAccessRequests(projectId) : null,
    enabled: !!projectId && !!currentUser && isOwner
  });

  // Create version mutation
  const createVersionMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        console.error('Missing projectId during createVersionMutation');
        throw new Error('Project ID is missing. Please try refreshing the page.');
      }
      
      if (!selectedFile || !currentUser) {
        console.error('Missing selectedFile or currentUser during createVersionMutation');
        throw new Error('File or user authentication is missing');
      }
      
      try {
        console.log('Starting server-side file upload...');
        
        // Upload file directly to our backend which will handle S3 upload
        const uploadResponse = await versionAPI.uploadFileViaServer(projectId, selectedFile);
        
        console.log('Server upload response:', uploadResponse);
        
        if (!uploadResponse.success || !uploadResponse.data) {
          console.error('Invalid upload response:', uploadResponse);
          throw new Error('Failed to upload file to server');
        }
        
        const { fileUrl, key, fileName, fileSize, fileType } = uploadResponse.data;
        
        // Create version in database
        return versionAPI.createVersion(projectId, {
          fileUrl,
          fileName: fileName || selectedFile.name,
          fileSize: fileSize || selectedFile.size,
          fileType: fileType || selectedFile.type,
          notes: newVersionComment,
          key
        });
      } catch (error) {
        console.error('Error in file upload process:', error);
        throw error;
      }
    },
    onSuccess: () => {
      setIsUploadDialogOpen(false);
      setNewVersionComment('');
      setSelectedFile(null);
      
      // Invalidate versions query to refetch
      queryClient.invalidateQueries({ queryKey: ['versions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      
      toast({
        title: 'Version uploaded successfully',
        description: 'Your new version has been submitted'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to upload version',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Approve version mutation
  const approveVersionMutation = useMutation({
    mutationFn: (versionId: string) => {
      if (!projectId) return Promise.reject('No project ID');
      return versionAPI.updateVersionStatus(projectId, versionId, 'approved');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      
        toast({
        title: 'Version approved',
        description: 'The version has been approved successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to approve version',
        description: error.response?.data?.message || 'Please try again later',
          variant: 'destructive'
        });
    }
  });

  // Reject version mutation
  const rejectVersionMutation = useMutation({
    mutationFn: (versionId: string) => {
      if (!projectId) return Promise.reject('No project ID');
      return versionAPI.updateVersionStatus(projectId, versionId, 'rejected');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', projectId] });
      
      toast({
        title: 'Version rejected',
        description: 'The version has been rejected'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to reject version',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Revert to version mutation
  const revertVersionMutation = useMutation({
    mutationFn: (versionId: string) => {
      if (!projectId) return Promise.reject('No project ID');
      return versionAPI.revertToVersion(projectId, versionId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['versions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      
      toast({
        title: 'Reverted to version',
        description: `Successfully reverted to version ${data.data.currentVersion} and deleted ${data.data.deletedVersions} newer versions`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to revert version',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Add user to project mutation
  const addUserMutation = useMutation({
    mutationFn: ({ email, accessType }: { email: string; accessType: 'editor' | 'viewer' }) => {
      if (!projectId) return Promise.reject('No project ID');
      return projectAPI.addUserToProject(projectId, email, accessType);
    },
    onSuccess: () => {
      setIsAddUserDialogOpen(false);
      setCollaboratorEmail('');
      setAccessType('viewer');
      setSearchResults([]);
      
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] });
      
      toast({
        title: 'User added successfully',
        description: 'The user has been given access to this project'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add user',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Change user access mutation
  const changeAccessMutation = useMutation({
    mutationFn: ({ userId, accessType, email }: { userId: string; accessType: 'editor' | 'viewer'; email: string }) => {
      if (!projectId) return Promise.reject('No project ID');
      
      if (!email) {
        console.error('User email is missing:', { userId, accessType });
      toast({
          title: 'Error changing access',
          description: 'User email is missing. Please try refreshing the page.',
          variant: 'destructive'
        });
        return Promise.reject('User email is missing');
      }
      
      console.log(`Changing access for user ${userId} (${email}) to ${accessType}`);
      
      // Use email instead of userId - backend API expects email
      return projectAPI.addUserToProject(projectId, email, accessType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] });
      
      toast({
        title: 'Access level updated',
        description: 'The user\'s access level has been changed'
      });
    },
    onError: (error: any) => {
      console.error('Error changing access:', error);
      toast({
        title: 'Failed to update access',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => {
      if (!projectId) return Promise.reject('No project ID');
      return projectAPI.removeUserFromProject(projectId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] });
      
      toast({
        title: 'User removed',
        description: 'The user has been removed from this project'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove user',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Search users
  const searchUsers = async (email: string) => {
    if (!email.trim()) return;
    
    try {
      setIsSearching(true);
      const response = await userAPI.searchUsers(email);
      setSearchResults(response.data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: 'Failed to search users',
        description: 'Please try again later',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadVersion = () => {
    if (!selectedFile) {
      toast({
        title: 'File required',
        description: 'Please select a file to upload',
        variant: 'destructive'
      });
      return;
    }
    
    if (!projectId) {
      toast({
        title: 'Project not found',
        description: 'Unable to upload file: project ID is missing',
        variant: 'destructive'
      });
      return;
    }
    
    createVersionMutation.mutate();
  };

  const handleAddUser = () => {
    if (!collaboratorEmail.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return;
    }
    
    addUserMutation.mutate({ email: collaboratorEmail, accessType });
  };
      
  const handleChangeAccess = (userId: string, newAccessType: 'editor' | 'viewer', userEmail: string) => {
    if (!userEmail) {
      console.error('User email is missing:', { userId, newAccessType });
      toast({
        title: 'Error changing access',
        description: 'User email is missing. Please try refreshing the page.',
        variant: 'destructive'
      });
      return;
    }
    
    console.log(`Changing access for user ${userId} (${userEmail}) to ${newAccessType}`);
    
    // Pass both userId and email to the mutation
    changeAccessMutation.mutate({ 
      userId, 
      accessType: newAccessType,
      email: userEmail 
    });
  };

  const handleRemoveUser = (userId: string) => {
    removeUserMutation.mutate(userId);
  };

  const formatDate = (date: Date | { toDate: () => Date } | string): string => {
    try {
      let dateObj: Date;
      
      if (!date) {
        console.warn('Received undefined or null date');
        return 'Unknown date';
      }
      
      // Handle different date formats
      if (typeof date === 'string') {
        // If it's a string, parse it
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        // If it's already a Date object
        dateObj = date;
      } else if (typeof date.toDate === 'function') {
        // If it's a Firebase Timestamp with toDate() function
        dateObj = date.toDate();
      } else {
        // Fallback
        console.warn('Unknown date format:', date);
        dateObj = new Date(date as any);
      }
      
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Add a function to handle opening files in a new tab
  const handleOpenFile = async (fileUrl: string, versionId: string | undefined) => {
    if (!fileUrl || !projectId || !versionId) {
      toast({
        title: 'File not available',
        description: 'The file information is missing or invalid',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      // Set loading state for this file
      setLoadingFiles(prev => ({ ...prev, [versionId]: true }));
      
      // Debug logs
      console.log('Opening file URL (original):', fileUrl);
      console.log('Version ID:', versionId);
      
      // Get the current version from either approved or pending versions
      const currentVersion = [...(versionsData?.data?.approved || []), ...(versionsData?.data?.pending || [])]
        .find(v => getVersionId(v) === versionId);
      console.log('Current version:', currentVersion);
      console.log('File key (if available):', currentVersion?.key);
      
      // Extract version lists with better debugging
      console.log('All versions data from API:', versionsData?.data);
      
      // First approach: Use direct S3 URL construction if we have a key pattern in the URL
      if (fileUrl.includes('amazonaws.com') || fileUrl.includes('/project-nexus-files/')) {
        // Either extract the key from URL or create a direct S3 URL
        let s3Url = fileUrl;
        
        // Try to extract the key if it's in the URL
        const keyMatch = fileUrl.match(/project-nexus-files\/(.+)$/);
        if (keyMatch && keyMatch[1]) {
          const key = keyMatch[1];
          // Construct a direct S3 URL
          s3Url = `https://project-nexus-files.s3.amazonaws.com/${key}`;
        }
        
        console.log('Using direct S3 URL:', s3Url);
        window.open(s3Url, '_blank');
        
        toast({
          title: 'File opened',
          description: 'If the file does not appear, check your browser\'s popup settings',
        });
        return;
      }
      
      // Second approach: Try to use the URL directly if it's complete
      if (fileUrl && (fileUrl.startsWith('https://') || fileUrl.startsWith('http://'))) {
        console.log('Opening URL directly:', fileUrl);
        window.open(fileUrl, '_blank');
        
        toast({
          title: 'File opened',
          description: 'If the file does not appear, check your browser\'s popup settings',
        });
        return;
      }
      
      // Final approach: Try to get a fresh URL from the server
      try {
        const response = await versionAPI.getVersion(projectId, versionId);
        
        if (response.success && response.data && response.data.fileUrl) {
          console.log('Using server-provided URL:', response.data.fileUrl);
          window.open(response.data.fileUrl, '_blank');
          
          toast({
            title: 'File opened',
            description: 'If the file does not appear, check your browser\'s popup settings',
          });
        } else {
          throw new Error('Failed to get signed URL for file');
        }
      } catch (serverError) {
        console.error('Server error getting version:', serverError);
        
        // Display a more helpful error message
        toast({
          title: 'Server connection issue',
          description: 'Unable to connect to the server. Please check if the backend server is running properly.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error opening file:', error);
      
      toast({
        title: 'Error opening file',
        description: 'There was a problem opening the file. Try again later.',
        variant: 'destructive'
      });
    } finally {
      // Clear loading state
      setLoadingFiles(prev => ({ ...prev, [versionId]: false }));
    }
  };

  // Add access request mutation
  const requestAccessMutation = useMutation({
    mutationFn: (message: string) => {
      if (!projectId) return Promise.reject('No project ID');
      setIsRequestingAccess(true);
      return projectAPI.requestAccess(projectId, message);
    },
    onSuccess: () => {
      setIsAccessRequestDialogOpen(false);
      setAccessRequestMessage('');
      
      toast({
        title: 'Request sent',
        description: 'Your request for editor access has been sent to the project creator',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send request',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    },
    onSettled: () => {
      setIsRequestingAccess(false);
    }
  });

  // Add function to handle requesting access
  const handleRequestAccess = () => {
    if (!accessRequestMessage.trim()) {
      toast({
        title: 'Message required',
        description: 'Please provide a brief message explaining why you need editor access',
        variant: 'destructive'
      });
      return;
    }
    
    requestAccessMutation.mutate(accessRequestMessage);
  };

  // Add mutations for handling access requests
  const handleAccessRequestMutation = useMutation({
    mutationFn: ({ requestId, status, accessType }: { requestId: string; status: 'approved' | 'rejected'; accessType?: 'editor' | 'viewer' }) => {
      if (!projectId) return Promise.reject('No project ID');
      setIsHandlingAccessRequest(true);
      return projectAPI.handleAccessRequest(projectId, requestId, status, accessType);
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['accessRequests', projectId] });
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] });
      
      toast({
        title: 'Access request updated',
        description: 'The access request has been processed successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to process request',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    },
    onSettled: () => {
      setIsHandlingAccessRequest(false);
    }
  });

  // Handle approving or rejecting access requests
  const handleAccessRequest = (requestId: string, status: 'approved' | 'rejected', accessType?: 'editor' | 'viewer') => {
    handleAccessRequestMutation.mutate({ requestId, status, accessType });
  };

  // Extract version lists
  const approvedVersions = versionsData?.data?.approved || [];
  const pendingVersions = versionsData?.data?.pending || [];
  const allVersions = [...pendingVersions, ...approvedVersions];
  
  // Extract collaborators from project data
  const collaborators = collaboratorsData?.data?.accessibleBy || [];
  
  // Debug collaborator structure
  console.log('ALL COLLABORATORS:', collaborators);

  // Add debug logging in useEffect to check version data structure
  useEffect(() => {
    if (versionsData?.data) {
      console.log('Debug - All versions data:', versionsData.data);
      
      // Log creator name info for all versions
      const allVersionsList = [
        ...(versionsData.data.approved || []),
        ...(versionsData.data.pending || [])
      ];
      
      console.log('Debug - Version creator names:');
      allVersionsList.forEach(v => {
        console.log(`Version ${v.versionNumber || 'unknown'} (${v.id}):`, {
          creatorName: v.creatorName, 
          uploadedBy: v.uploadedBy,
          createdBy: v.createdBy
        });
      });
    }
  }, [versionsData]);

  // Function to handle opening the revert confirmation dialog
  const handleRevertClick = (version: any) => {
    setVersionToRevert(version);
    setIsRevertDialogOpen(true);
  };

  // Function to confirm revert action
  const confirmRevert = () => {
    if (!versionToRevert) return;

    const versionId = getVersionId(versionToRevert);
    if (versionId) {
      revertVersionMutation.mutate(versionId);
    } else {
      toast({
        title: 'Error reverting version',
        description: 'Version ID is missing',
        variant: 'destructive'
      });
    }
    
    setIsRevertDialogOpen(false);
  };

  if (projectLoading) {
    return (
      <Layout>
        <div className="container py-8 max-w-7xl mx-auto">
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (projectError || !project) {
    return (
      <Layout>
        <div className="container py-8 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium">Project not found</h3>
            <p className="text-muted-foreground mt-2">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button className="mt-4" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6 max-w-7xl mx-auto">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">
              {project.description}
            </p>
          </div>
          
          <div className="flex space-x-2 mt-4 md:mt-0">
            {canEdit === false && accessLevel === 'viewer' && (
              <Dialog open={isAccessRequestDialogOpen} onOpenChange={setIsAccessRequestDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Request Editor Access
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Editor Access</DialogTitle>
                    <DialogDescription>
                      Send a request to the project creator for editor privileges, which will allow you to upload new versions.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="requestMessage">Message</Label>
                      <Textarea
                        id="requestMessage"
                        placeholder="Briefly explain why you need editor access..."
                        value={accessRequestMessage}
                        onChange={(e) => setAccessRequestMessage(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button 
                      onClick={handleRequestAccess}
                      disabled={isRequestingAccess || !accessRequestMessage.trim()}
                    >
                      {isRequestingAccess ? 'Sending...' : 'Send Request'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            
            {canEdit && (
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
              <UploadCloud className="h-4 w-4 mr-2" />
              Upload New Version
            </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload New Version</DialogTitle>
                    <DialogDescription>
                      Upload a new version of this project. Files can be PDFs, images, or other supported formats.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="file">File</Label>
                      <Input 
                        id="file" 
                        type="file" 
                        onChange={handleFileChange}
                      />
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="comments">Comments</Label>
                      <Textarea
                        id="comments"
                        placeholder="Add any notes about this version"
                        value={newVersionComment}
                        onChange={(e) => setNewVersionComment(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      onClick={handleUploadVersion}
                      disabled={createVersionMutation.isPending || !selectedFile}
                    >
                      {createVersionMutation.isPending ? (
                        <span key="uploading-text">Uploading...</span>
                      ) : (
                        <span key="upload-icon">
                          <UploadCloud className="h-4 w-4 mr-2" />
                          Upload Version
                        </span>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        
        <Tabs defaultValue="versions" className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="versions">
              <Eye className="h-4 w-4 mr-2" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="collaborators">
              <Users className="h-4 w-4 mr-2" />
              Collaborators
            </TabsTrigger>
            {isOwner && (
              <>
                <TabsTrigger value="requests">
                  <FileText className="h-4 w-4 mr-2" />
                  Access Requests
                </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
              </>
            )}
          </TabsList>
          
          <TabsContent value="versions" className="space-y-6">
            {versionsLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : versionsError ? (
              <div className="text-center py-6">
                <p className="text-destructive">Error loading versions. Please try again later.</p>
              </div>
            ) : allVersions.length > 0 ? (
              <div className="space-y-4">
                {isOwner && pendingVersions.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Pending Approval</h3>
                    <div className="space-y-4">
                      {pendingVersions.map(version => (
                <Card key={version.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Version {version.versionNumber}</CardTitle>
                        <CardDescription>
                                  Uploaded by {version.creatorName} on {formatDate(version.createdAt)}
                        </CardDescription>
                      </div>
                              <div className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Pending
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{version.comments}</p>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                const versionId = getVersionId(version);
                                if (versionId) {
                                  handleOpenFile(version.fileUrl, versionId);
                                } else {
                                  toast({
                                    title: 'Error opening file',
                                    description: 'Version ID is missing',
                                    variant: 'destructive'
                                  });
                                }
                              }}
                              disabled={loadingFiles[version.id] || loadingFiles[version._id]}
                            >
                              {loadingFiles[version.id] || loadingFiles[version._id] ? (
                                <div key="loading-spinner">
                                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent" />
                                  Loading...
                                </div>
                              ) : (
                                <div key="file-text-icon">
                                  <FileText className="h-4 w-4 mr-2" />
                      View File
                                </div>
                              )}

                              
                    </Button>
                    
                      <div className="flex space-x-2">
                        <Button 
                          variant="default" 
                          onClick={() => {
                            const versionId = getVersionId(version);
                            console.log('Approving version:', version);
                            console.log('Using version ID:', versionId);
                            
                            if (versionId) {
                              approveVersionMutation.mutate(versionId);
                            } else {
                              toast({
                                title: 'Error approving version',
                                description: 'Version ID is missing',
                                variant: 'destructive'
                              });
                            }
                          }}
                          disabled={approveVersionMutation.isPending}
                        >
                          Approve
                        </Button>
                              <Button 
                                variant="destructive"
                                onClick={() => {
                                  const versionId = getVersionId(version);
                                  console.log('Rejecting version:', version);
                                  console.log('Using version ID:', versionId);
                                  
                                  if (versionId) {
                                    rejectVersionMutation.mutate(versionId);
                                  } else {
                                    toast({
                                      title: 'Error rejecting version',
                                      description: 'Version ID is missing',
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                disabled={rejectVersionMutation.isPending}
                              >
                          Reject
                        </Button>
                      </div>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                      </div>
                    )}
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Approved Versions</h3>
                  <div className="space-y-4">
                    {approvedVersions.map(version => (
                      <Card key={version.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>Version {version.versionNumber}</CardTitle>
                              <CardDescription>
                                Uploaded by {version.creatorName} on {formatDate(version.createdAt)}
                              </CardDescription>
                            </div>
                            <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Approved
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{version.comments}</p>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              const versionId = getVersionId(version);
                              if (versionId) {
                                handleOpenFile(version.fileUrl, versionId);
                              } else {
                                toast({
                                  title: 'Error opening file',
                                  description: 'Version ID is missing',
                                  variant: 'destructive'
                                });
                              }
                            }}
                            disabled={loadingFiles[version.id] || loadingFiles[version._id]}
                          >
                            {loadingFiles[version.id] || loadingFiles[version._id] ? (
                              <div key="loading-spinner">
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent" />
                                Loading...
                              </div>
                            ) : (
                              <div key="file-text-icon">
                                <FileText className="h-4 w-4 mr-2" />
                                View File
                              </div>
                            )}
                          </Button>
                          {isOwner && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleRevertClick(version)}
                              disabled={revertVersionMutation.isPending}
                              className="ml-2"
                            >
                              <HistoryIcon className="h-3.5 w-3.5 mr-1" />
                              Revert to this version
                            </Button>
                    )}
                  </CardFooter>
                </Card>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <UploadCloud className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No versions yet</h3>
                <p className="text-muted-foreground">
                  {canEdit 
                    ? "Upload the first version to get started" 
                    : "There are no versions available for this project yet"}
                </p>
                {canEdit && (
                  <Button className="mt-4" onClick={() => setIsUploadDialogOpen(true)}>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Upload Version
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="collaborators" className="space-y-6">
            {collaboratorsLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : collaboratorsError ? (
              <div className="text-center py-6">
                <p className="text-destructive">Error loading collaborators. Please try again later.</p>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Project Collaborators</h2>
                  {isOwner && (
                    <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Collaborator
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add User to Project</DialogTitle>
                          <DialogDescription>
                            Add a user by email address and set their access level
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="flex gap-2">
                              <Input 
                                id="email" 
                                type="email" 
                                placeholder="user@example.com"
                                value={collaboratorEmail}
                                onChange={(e) => setCollaboratorEmail(e.target.value)}
                              />
                              <Button 
                                variant="outline" 
                                onClick={() => searchUsers(collaboratorEmail)}
                                disabled={isSearching || !collaboratorEmail.trim()}
                              >
                                Search
                              </Button>
                            </div>
                          </div>
                          
                          {searchResults.length > 0 && (
                            <div className="border rounded-md p-3 space-y-2">
                              <p className="text-sm font-medium">Search Results:</p>
                              {searchResults.map(user => (
                                <div 
                                  key={user._id} 
                                  className="flex items-center justify-between p-2 hover:bg-muted rounded-md cursor-pointer"
                                  onClick={() => setCollaboratorEmail(user.email)}
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={user.profilePicture} alt={user.name} />
                                      <AvatarFallback>{user.name ? user.name.substring(0, 2).toUpperCase() : 'UN'}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="text-sm font-medium">{user.name}</p>
                                      <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <Label htmlFor="accessLevel">Access Level</Label>
                            <Select defaultValue={accessType} onValueChange={(value) => setAccessType(value as 'editor' | 'viewer')}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select access level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer (can only view)</SelectItem>
                                <SelectItem value="editor">Editor (can upload versions)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button 
                            onClick={handleAddUser}
                            disabled={addUserMutation.isPending || !collaboratorEmail.trim()}
                          >
                            Add User
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                {collaborators.length > 0 ? (
                  <div className="space-y-4">
                    {collaborators.map((user: Collaborator) => {
                      // Add debug logging to see what's in the user object
                      console.log('Collaborator:', user);
                      
                      // Skip rendering if user object is invalid
                      if (!user || !user._id) {
                        console.error('Invalid user object:', user);
                        return null;
                      }
                      
                      return (
                        <Card key={user._id}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={user.profilePicture} alt={user.name || 'User'} />
                                  <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <CardTitle className="text-lg">{getUserName(user)}</CardTitle>
                                  <CardDescription>{getUserEmail(user)}</CardDescription>
                                </div>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                user.accessType === 'creator' 
                                  ? 'bg-purple-100 text-purple-800' 
                                  : user.accessType === 'editor'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}>
                                {user.accessType === 'creator' ? 'Owner' : 
                                 user.accessType === 'editor' ? 'Editor' : 'Viewer'}
                              </div>
                            </div>
                          </CardHeader>
                          
                          {isOwner && user.accessType !== 'creator' && (
                            <CardFooter className="pt-2">
                              <div className="flex justify-end gap-2 w-full">
                                {user.accessType === 'viewer' ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      // Add debug info
                                      console.log('User object for Make Editor:', user);
                                      
                                      // Get email using helper
                                      const userEmail = getUserEmail(user);
                                      
                                      handleChangeAccess(user._id, 'editor', userEmail);
                                    }}
                                    disabled={changeAccessMutation.isPending}
                                  >
                                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                                    Make Editor
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      // Add debug info
                                      console.log('User object for Make Viewer:', user);
                                      
                                      // Get email using helper
                                      const userEmail = getUserEmail(user);
                                      
                                      handleChangeAccess(user._id, 'viewer', userEmail);
                                    }}
                                    disabled={changeAccessMutation.isPending}
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    Make Viewer
                                  </Button>
                                )}
                              </div>
                            </CardFooter>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-muted/20 rounded-lg">
              <Users className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No collaborators yet</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {isOwner 
                        ? "Add team members to collaborate on this project" 
                        : "This project doesn't have any collaborators yet"}
                    </p>
                    {isOwner && (
                      <Button className="mt-4" onClick={() => setIsAddUserDialogOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                  Add Collaborator
                </Button>
              )}
            </div>
                )}
              </div>
            )}
          </TabsContent>
          
          {isOwner && (
            <TabsContent value="requests">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Access Requests</h2>
                </div>
                
                {accessRequestsLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : accessRequestsError ? (
                  <div className="text-center py-6">
                    <p className="text-destructive">Error loading access requests. Please try again later.</p>
                  </div>
                ) : accessRequestsData?.data?.length > 0 ? (
                  <div className="space-y-4">
                    {accessRequestsData.data.map((request: any) => (
                      <Card key={request._id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={request.user.profilePicture} alt={request.user.name || 'User'} />
                                <AvatarFallback>{request.user.name ? request.user.name.substring(0, 2).toUpperCase() : 'UN'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="text-lg">{request.user.name}</CardTitle>
                                <CardDescription>{request.user.email}</CardDescription>
                              </div>
                            </div>
                            <div className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {request.requestType === 'editor' ? 'Editor Request' : 'Access Request'}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">
                            "{request.message}"
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Requested on {formatDate(request.requestedAt)}
                          </p>
                        </CardContent>
                        <CardFooter>
                          <div className="flex justify-end gap-2 w-full">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleAccessRequest(request._id, 'approved', 'viewer')}
                              disabled={isHandlingAccessRequest}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Make Viewer
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => handleAccessRequest(request._id, 'approved', 'editor')}
                              disabled={isHandlingAccessRequest}
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" />
                              Make Editor
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleAccessRequest(request._id, 'rejected')}
                              disabled={isHandlingAccessRequest}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-muted/20 rounded-lg">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No pending requests</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      When users request access to this project, they will appear here
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
          
          {isOwner && (
            <TabsContent value="settings">
              <div className="text-center py-12">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">Project Settings</h3>
                <p className="text-muted-foreground">
                  Configure project settings and preferences
                </p>
                <div className="mt-6 flex justify-center space-x-4">
                  <Button variant="outline">
                    Edit Project Details
                  </Button>
                  <Button variant="destructive">
                    Delete Project
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
      
      {/* Revert Version Confirmation Dialog */}
      {versionToRevert && (
        <Dialog open={isRevertDialogOpen} onOpenChange={setIsRevertDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <AlertCircle className="h-5 w-5 text-destructive mr-2" />
                Confirm Revert to Version
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to revert to version {versionToRevert.versionNumber}? 
                This will <span className="font-semibold text-destructive">permanently delete</span> all 
                versions newer than this one. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/50 p-3 rounded-md my-2">
              <p className="text-sm font-medium">Version {versionToRevert.versionNumber}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Uploaded by {versionToRevert.creatorName} on {formatDate(versionToRevert.createdAt)}
              </p>
              {versionToRevert.comments && (
                <p className="text-sm mt-2 border-t pt-2">{versionToRevert.comments}</p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsRevertDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmRevert}
                disabled={revertVersionMutation.isPending}
              >
                {revertVersionMutation.isPending ? 'Reverting...' : 'Revert to this version'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
};

export default ProjectView;
