import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationCenter } from '@/components/NotificationCenter';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';

export const NotificationIndicator: React.FC = () => {
  const { unreadCount, permissionStatus, requestPermission } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-80 sm:w-96 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>View and manage your notifications</SheetDescription>
        </SheetHeader>
        <NotificationCenter onClose={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}; 