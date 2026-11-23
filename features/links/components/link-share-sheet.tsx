import { Sheet, SheetHeader } from "@/components/layout/sheet";

type LinkShareSheetProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
};

function LinkShareSheet({ open, title, children, onOpenChange }: LinkShareSheetProps) {
  return (
    <Sheet
      fitContent
      fixedHeader
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetHeader title={title} />
      {children}
    </Sheet>
  );
}

export { LinkShareSheet };
export type { LinkShareSheetProps };
