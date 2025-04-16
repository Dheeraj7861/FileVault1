import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

interface Notification {
  _id: string;
  message: string;
  read: boolean;
  type: string;
  createdAt: string | Date;
  project?: string;
  version?: string;
  fromUser?: any;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  requestPermission: () => void;
  permissionStatus: NotificationPermission | null;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  requestPermission: () => {},
  permissionStatus: null
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with an empty array to avoid "not a function" errors
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);
  // Track shown notification IDs to avoid duplicates
  const [shownNotifications, setShownNotifications] = useState<string[]>([]);
  // Track unread count separately
  const [unreadCount, setUnreadCount] = useState<number>(0);
  
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);
  
  // Request notification permission
  const requestPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setPermissionStatus(permission);
        if (permission === 'granted') {
          toast({
            title: 'Notifications enabled',
            description: 'You will now receive notifications for project updates.'
          });
        }
      });
    } else {
      toast({
        title: 'Notifications not supported',
        description: 'Your browser does not support web notifications.',
        variant: 'destructive'
      });
    }
  };
  
  // Fetch notifications
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const response = await notificationAPI.getNotifications();
        console.log('Notifications API response:', response);
        
        if (response.success && response.data) {
          // Based on the backend controller, we know exactly where the notifications are
          if (response.data.notifications && Array.isArray(response.data.notifications)) {
            console.log(`Found ${response.data.notifications.length} notifications`);
            setNotifications(response.data.notifications);
            
            // Use the server-provided unread count if available
            if (typeof response.data.unreadCount === 'number') {
              setUnreadCount(response.data.unreadCount);
            } else {
              // Fall back to calculating it from the notifications array
              const unreadNotifications = response.data.notifications.filter(n => !n.read);
              setUnreadCount(unreadNotifications.length);
            }
          } else {
            console.warn('Unexpected response structure:', response.data);
            setNotifications([]);
            setUnreadCount(0);
          }
        } else {
          setError('Failed to fetch notifications');
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setError('Failed to fetch notifications');
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotifications();
    
    // Set up polling for new notifications every 30 seconds
    const intervalId = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(intervalId);
  }, [isAuthenticated]);
  
  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await notificationAPI.markAsRead(notificationId);
      if (response.success) {
        // Find notification and check if it was previously unread
        const notificationToUpdate = notifications.find(n => n._id === notificationId);
        const wasUnread = notificationToUpdate && !notificationToUpdate.read;
        
        // Remove the notification from state entirely
        setNotifications(prev => 
          prev.filter(n => n._id !== notificationId)
        );
        
        // If notification was unread, update the unread count
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        
        console.log(`Removed notification ${notificationId}`);
      }
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  }, [notifications]);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await notificationAPI.markAllAsRead();
      if (response.success) {
        // Clear all notifications
        setNotifications([]);
        
        // Reset unread count to 0
        setUnreadCount(0);
        
        console.log('Removed all notifications');
      }
    } catch (error) {
      console.error('Error removing all notifications:', error);
    }
  }, []);
  
  // Show web notification for new notifications
  useEffect(() => {
    if (!Array.isArray(notifications) || !notifications.length || permissionStatus !== 'granted') return;
    
    // Get any new unread notifications that haven't been shown yet
    const unreadNotifications = notifications.filter(
      n => !n.read && !shownNotifications.includes(n._id)
    );
    
    if (unreadNotifications.length > 0) {
      // Sort notifications by date (newest first) and get the most recent
      const sortedNotifications = [...unreadNotifications].sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      const latestNotification = sortedNotifications[0];
      
      // Mark this notification as shown
      setShownNotifications(prev => [...prev, latestNotification._id]);
      
      try {
        const webNotification = new Notification('Project Nexus', {
          body: latestNotification.message,
          icon: '/logo.png' // Make sure this path exists
        });
        
        // Handle click on notification
        webNotification.onclick = () => {
          // Focus on window and navigate to the notification's link if available
          window.focus();
          if (latestNotification.link) {
            window.location.href = latestNotification.link;
          }
          
          // Mark as read when clicked
          markAsRead(latestNotification._id);
          
          // Close the notification
          webNotification.close();
        };
        
        // Clean up on unmount or when dependencies change
        return () => {
          webNotification.close();
        };
      } catch (error) {
        console.error('Error creating web notification:', error);
      }
    }
  }, [notifications, permissionStatus, shownNotifications, markAsRead]);
  
  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        markAsRead,
        markAllAsRead,
        requestPermission,
        permissionStatus
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}; 