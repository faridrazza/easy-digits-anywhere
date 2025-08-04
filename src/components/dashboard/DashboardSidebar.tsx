import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Home, FileText, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface DashboardSidebarProps {
  activeTab: 'home' | 'files';
  onTabChange: (tab: 'home' | 'files') => void;
}

export default function DashboardSidebar({ activeTab, onTabChange }: DashboardSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const sidebarItems = [
    {
      id: 'home' as const,
      label: 'होम / Home',
      icon: Home,
      description: 'डैशबोर्ड होम / Dashboard Home'
    },
    {
      id: 'files' as const,
      label: 'फाइलें / Files',
      icon: FileText,
      description: 'सभी फाइलें / All Files'
    }
  ];

  const SidebarContent = () => (
    <div className="space-y-2">
      {sidebarItems.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            className={cn(
              "w-full justify-start h-auto p-3",
              activeTab === item.id 
                ? "bg-gradient-to-r from-primary to-primary-glow text-white" 
                : "hover:bg-muted"
            )}
            onClick={() => {
              onTabChange(item.id);
              setIsMobileMenuOpen(false);
            }}
          >
            <Icon className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">{item.label}</div>
              <div className="text-xs opacity-80">{item.description}</div>
            </div>
          </Button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 border-r bg-background/80 backdrop-blur-sm">
        <div className="flex-1 p-6">
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-2">नेवीगेशन / Navigation</h2>
            <p className="text-sm text-muted-foreground">अपने डैशबोर्ड को नेवीगेट करें / Navigate your dashboard</p>
          </div>
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-background/80 backdrop-blur-sm"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed top-0 left-0 h-full w-64 bg-background border-r z-50 p-6">
            <div className="mb-8 mt-16">
              <h2 className="text-lg font-semibold mb-2">नेवीगेशन / Navigation</h2>
              <p className="text-sm text-muted-foreground">अपने डैशबोर्ड को नेवीगेट करें / Navigate your dashboard</p>
            </div>
            <SidebarContent />
          </div>
        </>
      )}
    </>
  );
}