# Project Nexus-share

A collaborative file versioning and sharing platform that enables teams to work on projects together.

## Features

- **User Authentication**
  - Sign up, login, and password reset functionality
  - JWT-based authentication

- **Project Management**
  - Create and manage projects
  - Control access levels (creator, editor, viewer)
  - Share projects via secure links

- **File Versioning**
  - Upload and view file versions
  - Approve/reject versions (for project creators)
  - Revert to previous versions

- **Collaboration**
  - Add users to projects with different access levels
  - Request access to existing projects
  - Real-time notifications

## Tech Stack

### Frontend
- React with TypeScript
- Vite build tool
- TailwindCSS with ShadcnUI components
- React Router for navigation
- TanStack Query for data fetching
- Socket.io client for real-time features

### Backend
- Node.js with Express.js
- MongoDB database
- JWT authentication with Passport.js
- AWS S3 for file storage
- Socket.io for real-time features

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB or MongoDB Atlas account
- AWS account with S3 bucket (for file storage)

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/project-nexus.git
   cd project-nexus
   ```

2. Install frontend dependencies
   ```
   npm install
   ```

3. Install backend dependencies
   ```
   cd backend
   npm install
   ```

4. Create environment files
   - Copy `.env.example` to `.env` in the backend directory
   - Set up your environment variables

   Frontend (in project root):
   ```
   echo "VITE_API_URL=http://localhost:5000/api" > .env.local
   echo "VITE_SOCKET_URL=http://localhost:5000" >> .env.local
   ```

### Running the Application

1. Start the backend
   ```
   cd backend
   npm run dev
   ```

2. In a new terminal, start the frontend
   ```
   npm run dev
   ```

3. Access the application at `http://localhost:5173`

## API Documentation

The API provides the following endpoints:

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password/:token` - Reset password
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - Get all projects for user
- `POST /api/projects` - Create a new project
- `GET /api/projects/:id` - Get project by ID
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/share` - Generate share link
- `POST /api/projects/:id/request-access` - Request access to project
- `POST /api/projects/:id/users` - Add user to project
- `DELETE /api/projects/:id/users/:userId` - Remove user from project

### Versions
- `GET /api/projects/:id/versions` - Get all versions for project
- `POST /api/projects/:id/versions` - Create a new version
- `GET /api/projects/:id/versions/:versionId` - Get version details
- `PUT /api/projects/:id/versions/:versionId/status` - Approve/reject version
- `DELETE /api/projects/:id/versions/:versionId` - Delete version
- `GET /api/projects/:id/versions/upload-url` - Get signed URL for file upload
- `POST /api/projects/:id/versions/:versionId/revert` - Revert to a previous version

### Users
- `GET /api/users/search` - Search users by email
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/password` - Change password

### Notifications
- `GET /api/notifications` - Get all notifications
- `PUT /api/notifications/:id` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
