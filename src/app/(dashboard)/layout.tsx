import { Navigation } from '@/components/layout/Navigation';
import { ExportOptionsDialogProvider } from '@/components/ui/ExportOptionsDialog';
import { FundGoalDialogProvider } from '@/components/ui/FundGoalDialog';
import { TransferDialogProvider } from '@/components/ui/TransferDialog';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExportOptionsDialogProvider>
      <FundGoalDialogProvider>
        <TransferDialogProvider>
          <div className="min-h-screen flex flex-col">
            <Navigation />
            <main className="flex-1">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </div>
            </main>
          </div>
        </TransferDialogProvider>
      </FundGoalDialogProvider>
    </ExportOptionsDialogProvider>
  );
}
