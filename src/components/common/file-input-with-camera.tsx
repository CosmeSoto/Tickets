/**
 * FileInputWithCamera
 *
 * Wrapper sobre <input type="file"> que en dispositivos móviles con cámara
 * ofrece dos opciones: tomar foto directamente o seleccionar desde galería/archivos.
 *
 * En desktop: comportamiento normal (un solo botón).
 *
 * Uso:
 *   <FileInputWithCamera
 *     inputRef={fileInputRef}
 *     cameraInputRef={cameraInputRef}
 *     accept="image/*,.pdf,.doc"
 *     multiple
 *     onChange={handleFiles}
 *     onCameraChange={handleFiles}
 *   >
 *     {({ openFile, openCamera, showCamera }) => (
 *       <>
 *         <Button onClick={openFile}>Adjuntar archivo</Button>
 *         {showCamera && <Button onClick={openCamera}>Tomar foto</Button>}
 *       </>
 *     )}
 *   </FileInputWithCamera>
 */

'use client'

import { useRef } from 'react'
import { useFileCapture } from '@/hooks/common/use-file-capture'

interface FileInputWithCameraProps {
  /** accept para el input de archivos normales */
  accept?: string
  /** Si permite múltiples archivos */
  multiple?: boolean
  /** Handler cuando se seleccionan archivos normales o desde galería */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Handler cuando se toma una foto (por defecto usa el mismo onChange) */
  onCameraChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Render prop: recibe funciones para abrir cada input y si mostrar cámara */
  children: (props: {
    openFile: () => void
    openCamera: () => void
    showCamera: boolean
  }) => React.ReactNode
}

export function FileInputWithCamera({
  accept = 'image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx',
  multiple = false,
  onChange,
  onCameraChange,
  children,
}: FileInputWithCameraProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const { showCameraOption } = useFileCapture()

  const openFile = () => fileInputRef.current?.click()
  const openCamera = () => cameraInputRef.current?.click()

  return (
    <>
      {/* Input normal — galería / explorador de archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          onChange(e)
          // Reset para permitir seleccionar el mismo archivo de nuevo
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
        className="hidden"
      />

      {/* Input de cámara — solo se renderiza en móvil con cámara */}
      {showCameraOption && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          onChange={(e) => {
            ;(onCameraChange ?? onChange)(e)
            if (cameraInputRef.current) cameraInputRef.current.value = ''
          }}
          className="hidden"
        />
      )}

      {children({ openFile, openCamera, showCamera: showCameraOption })}
    </>
  )
}
