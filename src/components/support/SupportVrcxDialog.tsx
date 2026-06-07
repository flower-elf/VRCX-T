import { useTranslation } from 'react-i18next';

import { SupportVrcxCard } from '@/components/support/SupportVrcxCard';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/ui/shadcn/dialog';

export function SupportVrcxDialog({ open, onOpenChange }: any) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('support_vrcx.title')}</DialogTitle>
                    <DialogDescription>
                        {t('support_vrcx.description')}
                    </DialogDescription>
                </DialogHeader>
                <SupportVrcxCard showHeader={false} />
                <DialogFooter showCloseButton />
            </DialogContent>
        </Dialog>
    );
}
