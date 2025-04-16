import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Bell, Check, FileText, Users, AlertTriangle, Trash } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/contexts/NotificationContext';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';

interface NotificationCenterProps {
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const { 
    notifications, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    unreadCount,
    requestPermission,
    permissionStatus
  } = useNotifications();
  
  const navigate = useNavigate();

  const formatDate = (timestamp: { toDate: () => Date } | Date | string) => {
    try {
      let date: Date;
      
      if (!timestamp) {
        return 'Unknown date';
      }
      
      // Handle different timestamp formats
      if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else {
        console.warn('Unknown timestamp format:', timestamp);
        date = new Date(timestamp as any);
      }
      
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Function to get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_version':
      case 'version_approved':
      case 'version_rejected':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'access_granted':
      case 'access_requested':
        return <Users className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  // Handler for notification click
  const handleNotificationClick = (notification: any) => {
    // Navigate to link if available
    if (notification.link) {
      navigate(notification.link);
      onClose(); // Close the notification center
      // Mark as read
      markAsRead(notification._id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between py-4 border-b px-4">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              Dismiss all
            </Button>
          )}
          {permissionStatus !== 'granted' && (
            <Button variant="outline" size="sm" onClick={requestPermission}>
              Enable notifications
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-grow">
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No notifications</h3>
              <p className="text-sm text-muted-foreground mt-2">
                When you receive notifications, they will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(notification => (
                <div 
                  key={notification._id}
                  className={`border rounded-md p-3 ${
                    notification.read ? 'bg-muted/20' : 'bg-muted/5'
                  } ${notification.link ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                  onClick={() => notification.link && handleNotificationClick(notification)}
                >
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <div className="flex items-start">
                        <div className="mr-3 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${!notification.read ? 'font-medium' : 'text-muted-foreground'}`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.createdAt ? formatDate(notification.createdAt) : 'Just now'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification._id);
                      }}
                    >
                      {notification.read ? (
                        <Trash className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

/* Original implementation commented out for later use
import React, { useEffect, useState } from 'react';
import { auth, db, Timestamp } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Check, X, Bell } from 'lucide-react';

interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: {
    toDate: () => Date;
  };
  projectId?: string;
  versionId?: string;
  type: 'version_upload' | 'version_approved' | 'version_rejected' | 'access_request' | 'access_granted';
}

interface NotificationCenterProps {
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Use our simplified mock function directly instead of relying on Firebase import syntax
    const userDocRef = `users/${user.uid}`;
    
    // This is a simplified version - in a real app, you'd fetch from a notifications subcollection
    const unsubscribe = db.onSnapshot(userDocRef, (doc: any) => {
      if (doc.exists) {
        const userData = doc.data();
        const userNotifications = userData.notifications || [];
        setNotifications(userNotifications);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (notificationId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = `users/${user.uid}`;
    
    // Find the notification to update
    const notificationToUpdate = notifications.find(n => n.id === notificationId);
    if (!notificationToUpdate) return;
    
    // Create an updated version
    const updatedNotification = { ...notificationToUpdate, read: true };
    
    // Remove the old notification and add the updated one
    await db.updateDoc(userDocRef, {
      notifications: db.arrayRemove(notificationToUpdate)
    });
    
    await db.updateDoc(userDocRef, {
      notifications: [...notifications.filter(n => n.id !== notificationId), updatedNotification]
    });
  };

  const removeNotification = async (notificationId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = `users/${user.uid}`;
    
    // Find the notification to remove
    const notificationToRemove = notifications.find(n => n.id === notificationId);
    if (!notificationToRemove) return;
    
    // Remove the notification
    await db.updateDoc(userDocRef, {
      notifications: db.arrayRemove(notificationToRemove)
    });
  };

  const formatDate = (timestamp: { toDate: () => Date } | Date | string) => {
    try {
      let date: Date;
      
      if (!timestamp) {
        return 'Unknown date';
      }
      
      // Handle different timestamp formats
      if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else {
        console.warn('Unknown timestamp format:', timestamp);
        date = new Date(timestamp as any);
      }
      
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between py-4 border-b">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-grow">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 h-40">
            <Bell className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="font-medium">No notifications yet</h3>
            <p className="text-sm text-muted-foreground">
              You'll be notified when there's activity on your projects
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-muted/50 transition-colors ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-4">
                    <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.createdAt ? formatDate(notification.createdAt) : 'Just now'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeNotification(notification.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {notifications.length > 0 && (
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" size="sm" onClick={() => {}}>
            Mark all as read
          </Button>
        </div>
      )}
    </div>
  );
};
*/
