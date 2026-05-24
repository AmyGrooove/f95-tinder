import { useCallback, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { SessionState } from '../f95/types'
import {
  buildAiTastePromptText,
  buildAiTasteSampleFile,
  parseAiTasteProfileJson,
} from '../f95/aiTasteProfile'
import type {
  AiTasteProfileFile,
  AiTasteSampleMode,
} from '../f95/aiTasteProfile'
import { downloadJsonFile, readFileAsText } from '../f95/utils'

type AiTasteProfileModalProps = {
  sessionState: SessionState
  tagsMap: Record<string, string>
  prefixesMap: Record<string, string>
  onApplyProfile: (profile: AiTasteProfileFile) => void
  onClose: () => void
}

const getSampleModeDescription = (sampleMode: AiTasteSampleMode) => {
  if (sampleMode === 'full') {
    return 'В файл попадут все доступные размеченные игры и полная статистика.'
  }

  return 'В файл попадут самые важные лайки, дизлайки и компактная статистика.'
}

const readAiProfileFile = async (file: File) => {
  const fileText = await readFileAsText(file)
  return parseAiTasteProfileJson(fileText)
}

const AiTasteProfileModal = ({
  sessionState,
  tagsMap,
  prefixesMap,
  onApplyProfile,
  onClose,
}: AiTasteProfileModalProps) => {
  const [sampleMode, setSampleMode] = useState<AiTasteSampleMode>('best')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const resetMessages = useCallback(() => {
    setStatusMessage(null)
    setErrorMessage(null)
  }, [])

  const handleDownloadSample = useCallback(() => {
    resetMessages()
    const sampleFile = buildAiTasteSampleFile(
      sessionState,
      tagsMap,
      prefixesMap,
      sampleMode,
    )
    const fileName = `f95-tinder-ai-taste-sample-${sampleMode}.json`
    downloadJsonFile(fileName, sampleFile)
    setStatusMessage('JSON с выборкой скачан. Теперь прикрепи его в чат вместе с промтом.')
  }, [prefixesMap, resetMessages, sampleMode, sessionState, tagsMap])

  const handleCopyPrompt = useCallback(async () => {
    resetMessages()
    const promptText = buildAiTastePromptText()

    try {
      await navigator.clipboard.writeText(promptText)
      setStatusMessage('Промт скопирован. Вставь его в чат и прикрепи скачанный JSON.')
    } catch {
      setErrorMessage('Не удалось скопировать промт автоматически. Попробуй нажать кнопку еще раз.')
    }
  }, [resetMessages])

  const handleFile = useCallback(
    async (file: File) => {
      resetMessages()
      try {
        const profile = await readAiProfileFile(file)
        if (!profile) {
          setErrorMessage('Файл прочитан, но профиль не прошел проверку формата.')
          return
        }

        onApplyProfile(profile)
        onClose()
      } catch {
        setErrorMessage('Не удалось прочитать файл.')
      }
    },
    [onApplyProfile, onClose, resetMessages],
  )

  const handleFileInputChange = useCallback(() => {
    const fileInputElement = fileInputRef.current
    const file = fileInputElement?.files?.[0]
    if (!file || !fileInputElement) {
      return
    }

    void handleFile(file)
    fileInputElement.value = ''
  }, [handleFile])

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(false)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragActive(false)
      const file = event.dataTransfer.files?.[0]
      if (file) {
        void handleFile(file)
      }
    },
    [handleFile],
  )

  return (
    <div
      className="gameDetailsModalOverlay"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose()
        }
      }}
    >
      <div className="gameDetailsModal aiTasteModal">
        <div className="gameDetailsModalHeader">
          <div className="gameDetailsModalTitleWrap">
            <div className="gameDetailsModalTitle">Поправить вкусы через промт</div>
            <div className="gameDetailsModalMeta">
              Скачай выборку, отправь ее в чат с промтом и импортируй JSON-профиль обратно.
            </div>
          </div>
          <div className="gameDetailsModalActions">
            <button className="button" type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>

        <div className="gameDetailsModalBody aiTasteModalBody">
          <div className="aiTasteStepCard">
            <div className="aiTasteStepHeader">
              <div className="aiTasteStepBadge">1</div>
              <div>
                <div className="aiTasteStepTitle">Скачать выборку</div>
                <div className="aiTasteStepMeta">
                  {getSampleModeDescription(sampleMode)}
                </div>
              </div>
            </div>

            <div className="aiTasteModeGrid">
              <label className="aiTasteModeOption">
                <input
                  type="radio"
                  name="aiTasteSampleMode"
                  checked={sampleMode === 'best'}
                  onChange={() => setSampleMode('best')}
                />
                <span>
                  <strong>Лучшее</strong>
                  <small>Компактный файл для обычного обновления вкуса.</small>
                </span>
              </label>
              <label className="aiTasteModeOption">
                <input
                  type="radio"
                  name="aiTasteSampleMode"
                  checked={sampleMode === 'full'}
                  onChange={() => setSampleMode('full')}
                />
                <span>
                  <strong>Полный</strong>
                  <small>Максимум данных, но файл может быть заметно больше.</small>
                </span>
              </label>
            </div>

            <button className="button buttonPrimary" type="button" onClick={handleDownloadSample}>
              Скачать JSON с выборкой
            </button>
          </div>

          <div className="aiTasteStepCard">
            <div className="aiTasteStepHeader">
              <div className="aiTasteStepBadge">2</div>
              <div>
                <div className="aiTasteStepTitle">Скопировать промт</div>
                <div className="aiTasteStepMeta">
                  В чате прикрепи скачанный файл и вставь этот промт.
                </div>
              </div>
            </div>

            <button className="button" type="button" onClick={handleCopyPrompt}>
              Скопировать промт
            </button>
          </div>

          <div className="aiTasteStepCard">
            <div className="aiTasteStepHeader">
              <div className="aiTasteStepBadge">3</div>
              <div>
                <div className="aiTasteStepTitle">Импортировать результат</div>
                <div className="aiTasteStepMeta">
                  Перетащи JSON-файл профиля или выбери его вручную. После успешного импорта окно закроется.
                </div>
              </div>
            </div>

            <div
              className={`aiTasteDropZone ${isDragActive ? 'aiTasteDropZoneActive' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="aiTasteDropTitle">Перетащи JSON-файл профиля</div>
              <div className="aiTasteStepMeta">или выбери файл вручную</div>
              <button
                className="button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Выбрать файл
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={handleFileInputChange}
              />
            </div>
          </div>

          {statusMessage ? <div className="noticeMessage">{statusMessage}</div> : null}
          {errorMessage ? <div className="appCrashMessage">{errorMessage}</div> : null}
        </div>
      </div>
    </div>
  )
}

export { AiTasteProfileModal }
