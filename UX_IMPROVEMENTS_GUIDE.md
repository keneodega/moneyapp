# UX Improvements Guide

This document outlines the new UX improvements that have been implemented: skeleton loaders, toast notifications, and confirmation dialogs.

## Components Added

### 1. Toast Notifications (`src/components/ui/Toast.tsx`)

A toast notification system for displaying success, error, info, and warning messages.

**Usage:**
```tsx
import { useToast } from '@/components/ui';

function MyComponent() {
  const toast = useToast();

  const handleAction = async () => {
    try {
      // ... perform action
      toast.showToast('Action completed successfully', 'success');
    } catch (error) {
      toast.showToast('Action failed', 'error');
    }
  };
}
```

**Toast Types:**
- `success` - Green, checkmark icon
- `error` - Red, X icon
- `warning` - Yellow, warning icon
- `info` - Blue, info icon

**Features:**
- Auto-dismisses after 5 seconds (configurable)
- Slide-in animation from right
- Manual dismiss with close button
- Accessible (ARIA labels, live regions)

### 2. Skeleton Loaders (`src/components/ui/Skeleton.tsx`)

Skeleton loaders to replace "Loading..." text with visual placeholders.

**Components:**
- `Skeleton` - Basic skeleton with variants (text, circular, rectangular)
- `SkeletonText` - Multi-line text skeleton
- `SkeletonCard` - Card-shaped skeleton
- `SkeletonList` - List item skeletons
- `SkeletonTable` - Table skeleton

**Usage:**
```tsx
import { SkeletonCard, SkeletonList } from '@/components/ui';

if (loading) {
  return (
    <div>
      <SkeletonCard />
      <SkeletonList items={5} />
    </div>
  );
}
```

**Features:**
- Pulse animation (default)
- Wave animation option
- Customizable width/height
- Accessible (aria-busy, aria-live)

### 3. Confirmation Dialog (`src/components/ui/ConfirmDialog.tsx`)

A modal confirmation dialog for destructive actions (delete, etc.).

**Usage:**
```tsx
import { useConfirmDialog } from '@/components/ui';

function MyComponent() {
  const confirmDialog = useConfirmDialog();

  const handleDelete = () => {
    confirmDialog.showConfirm({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        // Perform delete action
        await deleteItem();
      },
    });
  };
}
```

**Features:**
- Modal overlay with backdrop blur
- Danger variant for destructive actions
- Loading state during async operations
- Keyboard accessible (ESC to close)
- Click outside to cancel

## Implementation Status

### ✅ Completed

1. **Core Components Created:**
   - Toast notification system
   - Skeleton loader components
   - Confirmation dialog component

2. **Providers Added to Layout:**
   - `ToastProvider` wraps the app
   - `ConfirmDialogProvider` wraps the app

3. **Pages Updated:**
   - `master-budgets/page.tsx` - Full implementation example
   - `dashboard/BudgetDashboard.tsx` - Skeleton loaders
   - `dashboard/SubscriptionsDashboard.tsx` - Skeleton loaders
   - `dashboard/TransactionsDashboard.tsx` - Skeleton loaders

### 📋 To Do (Apply to Other Pages)

The following pages should be updated to use these new components:

1. **Skeleton Loaders:**
   - `settings/master-budgets/page.tsx`
   - `months/[id]/budgets/select/page.tsx`
   - Any other pages with "Loading..." text

2. **Toast Notifications:**
   - All form submissions (create, update)
   - All error handling
   - Replace inline error messages with toasts

3. **Confirmation Dialogs:**
   - All delete actions (replace `confirm()` calls)
   - Destructive actions (archive, deactivate, etc.)

## Migration Guide

### Replacing "Loading..." Text

**Before:**
```tsx
if (loading) {
  return <div>Loading...</div>;
}
```

**After:**
```tsx
import { SkeletonCard, SkeletonList } from '@/components/ui';

if (loading) {
  return (
    <div>
      <SkeletonCard />
      <SkeletonList items={3} />
    </div>
  );
}
```

### Adding Toast Notifications

**Before:**
```tsx
try {
  await saveData();
  setError(null);
} catch (err) {
  setError(err.message);
}
```

**After:**
```tsx
import { useToast } from '@/components/ui';

const toast = useToast();

try {
  await saveData();
  toast.showToast('Saved successfully', 'success');
} catch (err) {
  toast.showToast(err.message, 'error');
}
```

### Replacing confirm() with Confirmation Dialog

**Before:**
```tsx
if (confirm('Delete this item?')) {
  await deleteItem();
}
```

**After:**
```tsx
import { useConfirmDialog } from '@/components/ui';

const confirmDialog = useConfirmDialog();

confirmDialog.showConfirm({
  title: 'Delete Item',
  message: 'Are you sure you want to delete this item?',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  variant: 'danger',
  onConfirm: async () => {
    await deleteItem();
  },
});
```

## Best Practices

1. **Skeleton Loaders:**
   - Match the skeleton shape to the actual content layout
   - Use appropriate skeleton components (Card, List, Table)
   - Show skeletons immediately when loading starts

2. **Toast Notifications:**
   - Use success toasts for completed actions
   - Use error toasts for failures
   - Keep messages concise and actionable
   - Don't show toasts for every minor action

3. **Confirmation Dialogs:**
   - Use for destructive actions (delete, archive)
   - Provide clear, specific messages
   - Use danger variant for irreversible actions
   - Show loading state during async operations

## Accessibility

All components include:
- ARIA labels and roles
- Keyboard navigation support
- Screen reader announcements
- Focus management

## Animation Styles

New animations added to `globals.css`:
- `animate-slide-in-right` - Toast slide-in
- `animate-scale-in` - Dialog scale-in
- `animate-shimmer` - Skeleton shimmer effect
