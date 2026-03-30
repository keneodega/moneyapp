import { Navigation } from '@/components/layout/Navigation';
import { ExportOptionsDialogProvider } from '@/components/ui/ExportOptionsDialog';
import { ReportExportDialogProvider } from '@/components/ui/ReportExportDialog';
import { FundGoalDialogProvider } from '@/components/ui/FundGoalDialog';
import { TransferDialogProvider } from '@/components/ui/TransferDialog';
import { AIAssistantProvider, AIAssistantButton } from '@/components/ai';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExportOptionsDialogProvider>
      <ReportExportDialogProvider>
        <FundGoalDialogProvider>
          <TransferDialogProvider>
            <AIAssistantProvider>
              <div className="min-h-screen flex flex-col">
                <Navigation />
                <main className="flex-1">
                  <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
                    {children}
                  </div>
                </main>
              </div>
              <AIAssistantButton />
            </AIAssistantProvider>
          </TransferDialogProvider>
        </FundGoalDialogProvider>
      </ReportExportDialogProvider>
    </ExportOptionsDialogProvider>
  );
}
