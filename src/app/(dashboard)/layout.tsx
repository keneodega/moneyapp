import { Navigation } from '@/components/layout/Navigation';
import { ExportOptionsDialogProvider } from '@/components/ui/ExportOptionsDialog';
import { FundGoalDialogProvider } from '@/components/ui/FundGoalDialog';
import { DrawdownGoalDialogProvider } from '@/components/ui/DrawdownGoalDialog';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExportOptionsDialogProvider>
      <FundGoalDialogProvider>
        <DrawdownGoalDialogProvider>
          <div className="min-h-screen flex flex-col">
            <Navigation />
            <main className="flex-1">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </div>
            </main>
          </div>
        </DrawdownGoalDialogProvider>
      </FundGoalDialogProvider>
    </ExportOptionsDialogProvider>
  );
}
