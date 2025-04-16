
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  FileUp, 
  Lock, 
  Share2, 
  History, 
  Users, 
  Bell, 
  CheckCircle, 
  ChevronRight
} from 'lucide-react';

const Landing = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-primary">NexusShare</span>
            </Link>
          </div>
          <nav className="hidden md:flex gap-6 items-center">
            <Link to="/#features" className="text-sm font-medium hover:underline underline-offset-4">
              Features
            </Link>
            <Link to="/#how-it-works" className="text-sm font-medium hover:underline underline-offset-4">
              How It Works
            </Link>
            <Link to="/login" className="text-sm font-medium hover:underline underline-offset-4">
              Login
            </Link>
            <Link to="/signup">
              <Button>Sign Up</Button>
            </Link>
          </nav>
          <div className="md:hidden flex items-center">
            <Link to="/login" className="mr-4">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/signup">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-white to-gray-50">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                  Seamless File Versioning & Collaboration
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl">
                  Keep track of your project versions, collaborate with team members, and share your work securely with NexusShare.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link to="/signup">
                  <Button size="lg" className="w-full">
                    Get Started
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
            <div className="mx-auto lg:mr-0 flex items-center justify-center">
              <img
                alt="Dashboard Preview"
                className="aspect-video overflow-hidden rounded-xl object-cover object-center border shadow-lg"
                src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=600&fit=crop"
                width="550"
                height="310"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 lg:py-32" id="features">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground">
                Features
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Everything You Need for File Management
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                NexusShare provides all the tools you need to manage, track, collaborate, and share your projects.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <History className="h-8 w-8 text-primary" />
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Keep track of up to 6 previous versions of your projects, with easy access to review older iterations.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Users className="h-8 w-8 text-primary" />
                <CardTitle>User Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Control who can view and edit your projects with granular permission settings and access management.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <CheckCircle className="h-8 w-8 text-primary" />
                <CardTitle>Version Approval</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Project owners can review and approve new versions before they're added to the project.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Share2 className="h-8 w-8 text-primary" />
                <CardTitle>Shareable Links</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Generate links to share your projects and specific versions with others, with full control over access.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Bell className="h-8 w-8 text-primary" />
                <CardTitle>Real-time Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Get notified instantly about project updates, version approvals, and access requests.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Lock className="h-8 w-8 text-primary" />
                <CardTitle>Secure Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Your files are stored securely and accessible only to those you've granted permission.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/30" id="how-it-works">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground">
                How It Works
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Simple, Powerful File Management
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                NexusShare makes it easy to manage your files and collaborate with your team.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3 mt-12">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <FileUp className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold">1. Upload Your Files</h3>
              <p className="text-muted-foreground">
                Create a project and upload your files. NexusShare keeps track of all versions.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Users className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold">2. Invite Collaborators</h3>
              <p className="text-muted-foreground">
                Add team members with specific permissions to view or edit your projects.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Share2 className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold">3. Share Your Work</h3>
              <p className="text-muted-foreground">
                Generate shareable links to securely distribute your files with clients and stakeholders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-primary text-primary-foreground">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                Ready to Start Collaborating?
              </h2>
              <p className="mx-auto max-w-[600px] text-primary-foreground/80 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Join thousands of teams who use NexusShare to manage their projects efficiently.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="w-full">
                  Sign Up Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t bg-white py-6">
        <div className="container flex flex-col items-center justify-center gap-4 px-4 md:flex-row md:justify-between md:px-6">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-lg font-bold">
              NexusShare
            </Link>
          </div>
          <p className="text-center text-sm text-muted-foreground md:text-left">
            © {new Date().getFullYear()} NexusShare. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link to="/" className="text-sm hover:underline underline-offset-4">
              Terms
            </Link>
            <Link to="/" className="text-sm hover:underline underline-offset-4">
              Privacy
            </Link>
            <Link to="/" className="text-sm hover:underline underline-offset-4">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
