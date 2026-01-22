import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

interface ConfirmDialogOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmDialogContextType {
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType>({
  showConfirm: async () => false,
})

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmDialogOptions | null>(null)
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null)

  const showConfirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    setDialog(options)
    return new Promise((resolve) => {
      setResolveRef(() => resolve)
    })
  }, [])

  const handleConfirm = () => {
    resolveRef?.(true)
    setDialog(null)
    setResolveRef(null)
  }

  const handleCancel = () => {
    resolveRef?.(false)
    setDialog(null)
    setResolveRef(null)
  }

  return (
    <ConfirmDialogContext.Provider value={{ showConfirm }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3">
              {dialog.danger && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{dialog.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{dialog.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {dialog.cancelText || 'キャンセル'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={clsx(
                  'px-4 py-2 text-sm font-medium text-white rounded-lg',
                  dialog.danger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                {dialog.confirmText || '確認'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  )
}

export const useConfirmDialog = () => useContext(ConfirmDialogContext)
