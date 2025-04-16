import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { projectAPI } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Edit, Eye, Trash2, Search, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from '@/components/ui/use-toast';

interface Project {
  _id: string;
  name: string;
  description: string;
  creator: any;
  currentVersion?: any;
  createdAt: string;
  updatedAt: string;
  accessLevel?: 'creator' | 'editor' | 'viewer';
}

const Dashboard = () => {
  const { currentUser, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch projects query
  const {
    data: projectsData,
    isLoading,
    isError,
    refetch: refetchProjects
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.getProjects(),
    enabled: !!currentUser,
    staleTime: 1000 * 30, // 30 seconds - refresh much more frequently
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 3
  });

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh user data to ensure token is valid
      await refreshUserData();
      // Refresh projects
      await refetchProjects();
      toast({
        title: 'Projects refreshed',
        description: 'Project list has been updated',
      });
    } catch (error) {
      toast({
        title: 'Refresh failed',
        description: 'Failed to refresh projects',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Effect to refresh projects when returning to the dashboard
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      refetchProjects();
    }
  }, [location.pathname, refetchProjects]);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (projectData: { name: string; description: string }) => 
      projectAPI.createProject(projectData.name, projectData.description),
    onSuccess: () => {
      // Reset form
      setNewProjectName('');
      setNewProjectDescription('');
      setIsCreateDialogOpen(false);
      
      // Invalidate projects query to refetch
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      // Force refetch projects immediately
      refetchProjects();
      
      toast({
        title: 'Project created successfully',
        description: 'You can now start adding files'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create project',
        description: error.response?.data?.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Extract projects from response
  const projects = projectsData?.data || {};
  const ownedProjects = projects.owned || [];
  const editableProjects = projects.editable || [];
  const viewableProjects = projects.viewable || [];
  const allProjects = projects.all || [];

  // Filter projects based on search query
  const filteredProjects = (projects: Project[]) => {
    if (!searchQuery) return projects;
    
    return projects.filter(project => 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const createNewProject = () => {
    if (!newProjectName.trim()) {
      toast({
        title: 'Project name is required',
        variant: 'destructive'
      });
      return;
    }
    
    createProjectMutation.mutate({
      name: newProjectName,
      description: newProjectDescription
    });
  };

  const renderProjectCard = (project: Project) => (
    <Card key={project._id} className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle>{project.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {project.description || 'No description'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center mb-2">
            <span className="mr-1">Created by:</span>
            <span className="font-medium">{project.creator?.name || 'Unknown'}</span>
          </div>
          <div className="flex items-center mb-2">
            <span className="mr-1">Access:</span>
            <span className={`font-medium ${
              project.accessLevel === 'creator' 
                ? 'text-green-600' 
                : project.accessLevel === 'editor'
                ? 'text-blue-600'
                : 'text-gray-600'
            }`}>
              {project.accessLevel === 'creator' ? 'Owner' : 
               project.accessLevel === 'editor' ? 'Editor' : 'Viewer'}
            </span>
          </div>
          <div>
            <span className="mr-1">Updated:</span>
            <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-3 flex gap-2 border-t">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate(`/project/${project._id}`)}
        >
          {project.accessLevel === 'viewer' ? (
            <><Eye className="mr-2 h-4 w-4" /> View</>
          ) : (
            <><Edit className="mr-2 h-4 w-4" /> Edit</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleManualRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search projects..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : isError ? (
          <div className="text-center p-6 bg-destructive/10 rounded-lg">
            <p className="text-destructive">Error loading projects. Please try again later.</p>
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Projects ({allProjects.length})</TabsTrigger>
              <TabsTrigger value="owned">My Projects ({ownedProjects.length})</TabsTrigger>
              <TabsTrigger value="editable">Can Edit ({editableProjects.length})</TabsTrigger>
              <TabsTrigger value="viewable">Can View ({viewableProjects.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              {filteredProjects(allProjects).length === 0 ? (
                <div className="text-center p-6 bg-muted rounded-lg">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No projects found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Try a different search term' : 'Create a new project to get started'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects(allProjects).map(renderProjectCard)}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="owned" className="space-y-4">
              {filteredProjects(ownedProjects).length === 0 ? (
                <div className="text-center p-6 bg-muted rounded-lg">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No projects found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Try a different search term' : 'Create a new project to get started'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects(ownedProjects).map(renderProjectCard)}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="editable" className="space-y-4">
              {filteredProjects(editableProjects).length === 0 ? (
                <div className="text-center p-6 bg-muted rounded-lg">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No projects found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Try a different search term' : 'You have no projects with edit access'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects(editableProjects).map(renderProjectCard)}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="viewable" className="space-y-4">
              {filteredProjects(viewableProjects).length === 0 ? (
                <div className="text-center p-6 bg-muted rounded-lg">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No projects found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Try a different search term' : 'You have no projects with view access'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects(viewableProjects).map(renderProjectCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a new project to start collaborating and sharing files.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                placeholder="Enter project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Input
                id="project-description"
                placeholder="Enter project description (optional)"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={createNewProject}
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Creating...
                </>
              ) : (
                <>Create Project</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Dashboard;
